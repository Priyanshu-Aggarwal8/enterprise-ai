from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from database import get_db
import models
import schemas
from security import require_organization
from sqlalchemy import select, delete, update
from uuid import UUID

router = APIRouter(prefix="/chats", tags=["Chats"])

@router.post("", response_model=schemas.SavedChatResponse)
async def save_chat(
    payload: schemas.SavedChatCreate,
    current_user: models.User = Depends(require_organization),
    db: AsyncSession = Depends(get_db)
):
    chat = models.SavedChat(
        org_id=current_user.org_id,
        agent_id=payload.agent_id,
        session_id=payload.session_id,
        title=payload.title,
        content=payload.content
    )
    db.add(chat)
    await db.commit()
    await db.refresh(chat)
    return chat

@router.get("", response_model=list[schemas.SavedChatResponse])
async def list_chats(
    current_user: models.User = Depends(require_organization),
    db: AsyncSession = Depends(get_db)
):
    stmt = select(models.SavedChat).where(models.SavedChat.org_id == current_user.org_id).order_by(models.SavedChat.created_at.desc())
    result = await db.execute(stmt)
    rows = result.scalars().all()
    return rows

@router.put("/{chat_id}", response_model=schemas.SavedChatResponse)
async def update_chat(
    chat_id: UUID,
    payload: schemas.SavedChatCreate,
    current_user: models.User = Depends(require_organization),
    db: AsyncSession = Depends(get_db)
):
    stmt = select(models.SavedChat).where(models.SavedChat.id == chat_id, models.SavedChat.org_id == current_user.org_id)
    result = await db.execute(stmt)
    chat = result.scalar_one_or_none()
    if not chat:
        raise HTTPException(status_code=404, detail="Chat not found")
    chat.title = payload.title
    chat.content = payload.content
    await db.commit()
    await db.refresh(chat)
    return chat

@router.delete("/{chat_id}")
async def delete_chat(
    chat_id: UUID,
    current_user: models.User = Depends(require_organization),
    db: AsyncSession = Depends(get_db)
):
    stmt = select(models.SavedChat).where(models.SavedChat.id == chat_id, models.SavedChat.org_id == current_user.org_id)
    result = await db.execute(stmt)
    chat = result.scalar_one_or_none()
    if not chat:
        raise HTTPException(status_code=404, detail="Chat not found")
    await db.delete(chat)
    await db.commit()
    return {"message": "deleted"}
