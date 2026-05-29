from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from database import get_db
import models
import schemas
from security import require_organization

router = APIRouter(prefix="/tools", tags=["Custom Tools"])

@router.post("", response_model=schemas.CustomToolResponse)
async def create_custom_tool(
    tool: schemas.CustomToolCreate, 
    current_user: models.User = Depends(require_organization),
    db: AsyncSession = Depends(get_db)
):
    db_tool = models.CustomTool(
        org_id=current_user.org_id, 
        name=tool.name.replace(" ", "_").lower(),
        description=tool.description,
        python_code=tool.python_code
    )
    db.add(db_tool)
    await db.commit()
    await db.refresh(db_tool)
    return db_tool

@router.get("", response_model=list[schemas.CustomToolResponse])
async def list_custom_tools(
    current_user: models.User = Depends(require_organization), 
    db: AsyncSession = Depends(get_db)
):
    stmt = select(models.CustomTool).where(models.CustomTool.org_id == current_user.org_id)
    result = await db.execute(stmt)
    return result.scalars().all()

@router.put("/{tool_id}", response_model=schemas.CustomToolResponse)
async def update_custom_tool(
    tool_id: str,
    tool_data: schemas.CustomToolCreate,
    current_user: models.User = Depends(require_organization),
    db: AsyncSession = Depends(get_db)
):
    stmt = select(models.CustomTool).where(
        (models.CustomTool.id == tool_id) & (models.CustomTool.org_id == current_user.org_id)
    )
    result = await db.execute(stmt)
    tool = result.scalars().first()

    if not tool:
        raise HTTPException(status_code=404, detail="Custom tool not found.")
    
    tool.name = tool_data.name.replace(" ", "_").lower()
    tool.description = tool_data.description
    tool.python_code = tool_data.python_code

    await db.commit()
    await db.refresh(tool)
    return tool

@router.delete("/{tool_id}")
async def delete_custom_tool(
    tool_id: str,
    current_user: models.User = Depends(require_organization),
    db: AsyncSession = Depends(get_db)
):
    stmt = select(models.CustomTool).where(
        (models.CustomTool.id == tool_id) & (models.CustomTool.org_id == current_user.org_id)
    )
    result = await db.execute(stmt)
    tool = result.scalars().first()

    if not tool:
        raise HTTPException(status_code=404, detail="Custom tool not found.")
    
    await db.delete(tool)
    await db.commit()
    
    return {"message": "Custom tool deleted successfully."}