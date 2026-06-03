import json

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from database import get_db
import models
import schemas
from security import require_organization
from agent_tool_bindings import get_bound_agents_for_tool, ensure_tool_is_unbound
from tool_sandbox import validate_tool_for_save

router = APIRouter(prefix="/tools", tags=["Custom Tools"])


def _tool_requires_approval(tool: models.CustomTool) -> bool:
    return bool(tool.requires_approval)


def _tool_to_response(tool: models.CustomTool, bound_agents: list[models.AgentDefinition]) -> schemas.CustomToolResponse:
    return schemas.CustomToolResponse(
        id=tool.id,
        name=tool.name,
        description=tool.description,
        python_code=tool.python_code,
        risk_tier=tool.risk_tier or "unknown",
        sandbox_status=tool.sandbox_status or "pending",
        requires_approval=_tool_requires_approval(tool),
        sandbox_report=tool.sandbox_report,
        bound_agents=[
            schemas.BoundAgentSummary(id=a.id, name=a.name) for a in bound_agents
        ],
    )


def _apply_sandbox_metadata(tool: models.CustomTool, report) -> None:
    tool.risk_tier = report.risk_tier
    tool.sandbox_status = "passed" if report.passed else "failed"
    tool.sandbox_report = json.dumps(report.to_dict())
    tool.requires_approval = bool(report.requires_approval)


@router.post("/sandbox-test", response_model=schemas.ToolSandboxTestResponse)
async def sandbox_test_tool(
    payload: schemas.ToolSandboxTestRequest,
    current_user: models.User = Depends(require_organization),
):
    report = validate_tool_for_save(
        payload.python_code,
        payload.description,
        payload.test_input,
    )
    return schemas.ToolSandboxTestResponse(
        passed=report.passed,
        risk_tier=report.risk_tier,
        requires_approval=report.requires_approval,
        issues=report.issues,
        test_output=report.test_output,
        test_error=report.test_error,
        hints=report.hints,
    )


@router.post("", response_model=schemas.CustomToolResponse)
async def create_custom_tool(
    tool: schemas.CustomToolCreate,
    current_user: models.User = Depends(require_organization),
    db: AsyncSession = Depends(get_db),
):
    report = validate_tool_for_save(tool.python_code, tool.description)
    if not report.passed:
        raise HTTPException(
            status_code=400,
            detail={
                "message": "Tool failed sandbox validation. Fix issues and run sandbox test.",
                "sandbox": report.to_dict(),
            },
        )

    db_tool = models.CustomTool(
        org_id=current_user.org_id,
        name=tool.name.replace(" ", "_").lower(),
        description=tool.description,
        python_code=tool.python_code,
    )
    _apply_sandbox_metadata(db_tool, report)
    db.add(db_tool)
    await db.commit()
    await db.refresh(db_tool)
    return _tool_to_response(db_tool, [])


@router.get("", response_model=list[schemas.CustomToolResponse])
async def list_custom_tools(
    current_user: models.User = Depends(require_organization),
    db: AsyncSession = Depends(get_db),
):
    stmt = select(models.CustomTool).where(models.CustomTool.org_id == current_user.org_id)
    result = await db.execute(stmt)
    tools = result.scalars().all()

    responses = []
    for tool in tools:
        bound = await get_bound_agents_for_tool(db, tool.id, current_user.org_id)
        responses.append(_tool_to_response(tool, bound))
    return responses


@router.put("/{tool_id}", response_model=schemas.CustomToolResponse)
async def update_custom_tool(
    tool_id: str,
    tool_data: schemas.CustomToolCreate,
    current_user: models.User = Depends(require_organization),
    db: AsyncSession = Depends(get_db),
):
    stmt = select(models.CustomTool).where(
        (models.CustomTool.id == tool_id) & (models.CustomTool.org_id == current_user.org_id)
    )
    result = await db.execute(stmt)
    tool = result.scalars().first()

    if not tool:
        raise HTTPException(status_code=404, detail="Custom tool not found.")

    await ensure_tool_is_unbound(db, tool.id, current_user.org_id, action="update")

    report = validate_tool_for_save(tool_data.python_code, tool_data.description)
    if not report.passed:
        raise HTTPException(
            status_code=400,
            detail={
                "message": "Tool failed sandbox validation. Fix issues and run sandbox test.",
                "sandbox": report.to_dict(),
            },
        )

    tool.name = tool_data.name.replace(" ", "_").lower()
    tool.description = tool_data.description
    tool.python_code = tool_data.python_code
    _apply_sandbox_metadata(tool, report)

    await db.commit()
    await db.refresh(tool)
    bound = await get_bound_agents_for_tool(db, tool.id, current_user.org_id)
    return _tool_to_response(tool, bound)


@router.delete("/{tool_id}")
async def delete_custom_tool(
    tool_id: str,
    current_user: models.User = Depends(require_organization),
    db: AsyncSession = Depends(get_db),
):
    stmt = select(models.CustomTool).where(
        (models.CustomTool.id == tool_id) & (models.CustomTool.org_id == current_user.org_id)
    )
    result = await db.execute(stmt)
    tool = result.scalars().first()

    if not tool:
        raise HTTPException(status_code=404, detail="Custom tool not found.")

    await ensure_tool_is_unbound(db, tool.id, current_user.org_id, action="delete")

    await db.delete(tool)
    await db.commit()

    return {"message": "Custom tool deleted successfully."}
