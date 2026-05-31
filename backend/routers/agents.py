from fastapi import APIRouter, WebSocket, WebSocketDisconnect, Depends, HTTPException
from pydantic import BaseModel
import redis.asyncio as aioredis
import json
from config import settings
import worker
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from database import get_db
import models
import schemas
from security import require_organization
from agent_tool_bindings import (
    sync_agent_tool_bindings,
    get_tool_ids_for_agent,
)

router = APIRouter(
    prefix="/agents",
    tags=["Agents"]
)


class AgentRunRequest(BaseModel):
    org_id: str
    agent_id: str
    session_id: str
    prompt: str


def _agent_to_response(agent: models.AgentDefinition, tool_ids: list) -> schemas.AgentDefinitionResponse:
    return schemas.AgentDefinitionResponse(
        id=agent.id,
        name=agent.name,
        purpose=agent.purpose,
        system_prompt=agent.system_prompt,
        model_name=agent.model_name,
        tool_ids=tool_ids,
        created_at=agent.created_at,
    )


@router.post("", response_model=schemas.AgentDefinitionResponse)
async def create_agent_definition(
    agent: schemas.AgentDefinitionCreate,
    current_user: models.User = Depends(require_organization),
    db: AsyncSession = Depends(get_db),
):
    db_agent = models.AgentDefinition(
        org_id=current_user.org_id,
        name=agent.name.strip(),
        purpose=agent.purpose.strip(),
        system_prompt=agent.system_prompt.strip(),
        model_name=agent.model_name.strip() or "gemini-2.5-flash",
    )
    db.add(db_agent)
    await db.flush()

    await sync_agent_tool_bindings(
        db, db_agent.id, current_user.org_id, agent.tool_ids
    )

    await db.commit()
    await db.refresh(db_agent)
    tool_ids = await get_tool_ids_for_agent(db, db_agent.id)
    return _agent_to_response(db_agent, tool_ids)


@router.get("", response_model=list[schemas.AgentDefinitionResponse])
async def list_agent_definitions(
    current_user: models.User = Depends(require_organization),
    db: AsyncSession = Depends(get_db),
):
    stmt = select(models.AgentDefinition).where(
        models.AgentDefinition.org_id == current_user.org_id
    )
    result = await db.execute(stmt)
    agents = result.scalars().all()

    responses = []
    for agent in agents:
        tool_ids = await get_tool_ids_for_agent(db, agent.id)
        responses.append(_agent_to_response(agent, tool_ids))
    return responses


@router.post("/run")
async def run_agent(
    request: AgentRunRequest,
    current_user: models.User = Depends(require_organization),
    db: AsyncSession = Depends(get_db),
):
    if str(request.org_id) != str(current_user.org_id):
        raise HTTPException(
            status_code=403,
            detail="Unauthorized. You do not have permission to run agents for this organization.",
        )

    stmt = select(models.AgentDefinition).where(
        (models.AgentDefinition.id == request.agent_id)
        & (models.AgentDefinition.org_id == current_user.org_id)
    )
    result = await db.execute(stmt)
    if not result.scalars().first():
        raise HTTPException(status_code=404, detail="Agent not found for this organization.")

    task = worker.execute_agent.delay(
        prompt=request.prompt,
        org_id=request.org_id,
        session_id=request.session_id,
        agent_id=request.agent_id,
    )

    return {
        "message": "Agent execution queued successfully",
        "task_id": task.id,
    }


@router.websocket("/ws/{task_id}")
async def websocket_endpoint(websocket: WebSocket, task_id: str):
    await websocket.accept()

    redis_client = aioredis.from_url(settings.redis_url)
    pubsub = redis_client.pubsub()

    channel_name = f"channel_{task_id}"
    await pubsub.subscribe(channel_name)

    try:
        async for message in pubsub.listen():
            if message["type"] == "message":
                data = message["data"].decode("utf-8")

                await websocket.send_text(data)

                payload = json.loads(data)
                if payload.get("status") == "completed":
                    break

    except WebSocketDisconnect:
        print(f"Client disconnected from task {task_id}")
    finally:
        await pubsub.unsubscribe(channel_name)
        await redis_client.aclose()


@router.get("/{agent_id}", response_model=schemas.AgentDefinitionResponse)
async def get_agent_definition(
    agent_id: str,
    current_user: models.User = Depends(require_organization),
    db: AsyncSession = Depends(get_db),
):
    stmt = select(models.AgentDefinition).where(
        (models.AgentDefinition.id == agent_id)
        & (models.AgentDefinition.org_id == current_user.org_id)
    )
    result = await db.execute(stmt)
    agent = result.scalars().first()
    if not agent:
        raise HTTPException(status_code=404, detail="Agent not found.")
    tool_ids = await get_tool_ids_for_agent(db, agent.id)
    return _agent_to_response(agent, tool_ids)


@router.put("/{agent_id}", response_model=schemas.AgentDefinitionResponse)
async def update_agent_definition(
    agent_id: str,
    agent_data: schemas.AgentDefinitionCreate,
    current_user: models.User = Depends(require_organization),
    db: AsyncSession = Depends(get_db),
):
    stmt = select(models.AgentDefinition).where(
        (models.AgentDefinition.id == agent_id)
        & (models.AgentDefinition.org_id == current_user.org_id)
    )
    result = await db.execute(stmt)
    agent = result.scalars().first()
    if not agent:
        raise HTTPException(status_code=404, detail="Agent not found.")

    agent.name = agent_data.name.strip()
    agent.purpose = agent_data.purpose.strip()
    agent.system_prompt = agent_data.system_prompt.strip()
    agent.model_name = agent_data.model_name.strip() or "gemini-2.5-flash"

    await sync_agent_tool_bindings(
        db, agent.id, current_user.org_id, agent_data.tool_ids
    )

    await db.commit()
    await db.refresh(agent)
    tool_ids = await get_tool_ids_for_agent(db, agent.id)
    return _agent_to_response(agent, tool_ids)


@router.delete("/{agent_id}")
async def delete_agent_definition(
    agent_id: str,
    current_user: models.User = Depends(require_organization),
    db: AsyncSession = Depends(get_db),
):
    stmt = select(models.AgentDefinition).where(
        (models.AgentDefinition.id == agent_id)
        & (models.AgentDefinition.org_id == current_user.org_id)
    )
    result = await db.execute(stmt)
    agent = result.scalars().first()
    if not agent:
        raise HTTPException(status_code=404, detail="Agent not found.")

    await db.delete(agent)
    await db.commit()
    return {"message": "Agent deleted successfully."}
