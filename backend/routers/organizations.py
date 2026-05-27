from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from typing import List
from database import get_db
import models
import schemas
import security

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

@router.post("/{org_id}/secrets", response_model=schemas.SecretResponse)
async def add_organization_secret(org_id: str, secret: schemas.SecretCreate, db: AsyncSession = Depends(get_db)):
    encrypted = security.encrypt_key(secret.raw_api_key)
    preview = security.generate_key_preview(secret.raw_api_key)
    
    db_secret = models.OrganizationSecret(
        org_id=org_id,
        provider=secret.provider,
        encrypted_key=encrypted,
        key_preview=preview
    )
    
    db.add(db_secret)
    await db.commit()
    await db.refresh(db_secret)
    
    return db_secret