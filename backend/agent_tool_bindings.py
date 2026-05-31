"""Helpers for agent ↔ custom tool many-to-many bindings."""

from uuid import UUID

from fastapi import HTTPException
from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession

import models


async def validate_tool_ids_for_org(
    db: AsyncSession, org_id: UUID, tool_ids: list[UUID]
) -> None:
    if not tool_ids:
        return

    stmt = select(models.CustomTool.id).where(
        models.CustomTool.org_id == org_id,
        models.CustomTool.id.in_(tool_ids),
    )
    result = await db.execute(stmt)
    found = {row[0] for row in result.all()}
    missing = set(tool_ids) - found
    if missing:
        raise HTTPException(
            status_code=400,
            detail="One or more selected tools do not belong to this organization.",
        )


async def sync_agent_tool_bindings(
    db: AsyncSession, agent_id: UUID, org_id: UUID, tool_ids: list[UUID]
) -> None:
    await validate_tool_ids_for_org(db, org_id, tool_ids)

    await db.execute(
        delete(models.AgentToolBinding).where(
            models.AgentToolBinding.agent_id == agent_id
        )
    )

    for tool_id in tool_ids:
        db.add(
            models.AgentToolBinding(agent_id=agent_id, tool_id=tool_id)
        )


async def get_tool_ids_for_agent(db: AsyncSession, agent_id: UUID) -> list[UUID]:
    stmt = select(models.AgentToolBinding.tool_id).where(
        models.AgentToolBinding.agent_id == agent_id
    )
    result = await db.execute(stmt)
    return [row[0] for row in result.all()]


async def get_bound_agents_for_tool(
    db: AsyncSession, tool_id: UUID, org_id: UUID
) -> list[models.AgentDefinition]:
    stmt = (
        select(models.AgentDefinition)
        .join(
            models.AgentToolBinding,
            models.AgentToolBinding.agent_id == models.AgentDefinition.id,
        )
        .where(
            models.AgentToolBinding.tool_id == tool_id,
            models.AgentDefinition.org_id == org_id,
        )
    )
    result = await db.execute(stmt)
    return list(result.scalars().all())


async def ensure_tool_is_unbound(
    db: AsyncSession, tool_id: UUID, org_id: UUID, action: str = "modify"
) -> None:
    agents = await get_bound_agents_for_tool(db, tool_id, org_id)
    if not agents:
        return

    names = ", ".join(a.name for a in agents)
    raise HTTPException(
        status_code=409,
        detail=(
            f"Cannot {action} this tool while it is bound to agent(s): {names}. "
            "Unbind the tool from all agents first."
        ),
    )
