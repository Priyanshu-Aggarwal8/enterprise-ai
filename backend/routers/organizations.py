from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from typing import List
from database import get_db
import models
import schemas

router = APIRouter(
    prefix="/organizations",
    tags=["Organizations"]
)

@router.post("/", response_model=schemas.OrganizationResponse)
async def create_organization(org: schemas.OrganizationCreate, db: AsyncSession = Depends(get_db)):
    db_org = models.Organization(name=org.name)
    
    db.add(db_org)
    await db.commit()
    
    await db.refresh(db_org)
    return db_org

@router.get("/", response_model=List[schemas.OrganizationResponse])
async def get_organizations(db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(models.Organization))
    
    orgs = result.scalars().all()
    return orgs