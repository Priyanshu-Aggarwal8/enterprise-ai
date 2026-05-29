from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from database import get_db
import models
import schemas # Import schemas to handle incoming JSON correctly
import uuid
from security import get_current_user, require_organization 
from auth_utils import encrypt_api_key 

router = APIRouter(prefix="/organizations", tags=["Organizations"])

@router.get("")
async def get_organizations(
    current_user: models.User = Depends(get_current_user), # Use lenient gatekeeper
    db: AsyncSession = Depends(get_db)
):
    # If they have no org yet, return an empty list instead of a 403 error
    if not current_user.org_id:
        return []
        
    stmt = select(models.Organization).where(models.Organization.id == current_user.org_id)
    result = await db.execute(stmt)
    orgs = result.scalars().all()
    return orgs

@router.post("")
async def create_organization(
    org_data: schemas.OrganizationCreate, # Receives { "name": "..." } from Angular
    current_user: models.User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """THE MISSING ENDPOINT: Creates a brand new workspace."""
    if current_user.org_id:
        raise HTTPException(status_code=403, detail="Account is already permanently linked to an organization.")
    
    # 1. Create the new Organization
    new_org = models.Organization(
        id=uuid.uuid4(),
        name=org_data.name
    )
    db.add(new_org)
    
    # 2. Permanently link the user
    current_user.org_id = new_org.id
    db.add(current_user)
    
    await db.commit()
    return {"message": "Workspace created successfully.", "org_id": str(new_org.id)}

@router.post("/{org_id}/join")
async def join_organization(
    org_id: str,
    current_user: models.User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    if current_user.org_id:
        raise HTTPException(status_code=403, detail="Account is already permanently linked to an organization.")

    stmt = select(models.Organization).where(models.Organization.id == org_id)
    result = await db.execute(stmt)
    org = result.scalars().first()
    
    if not org:
        raise HTTPException(status_code=404, detail="Organization not found. Check the ID.")
        
    current_user.org_id = org.id
    db.add(current_user)
    await db.commit()
    
    return {"message": f"Successfully joined {org.name}", "org_id": str(org.id)}

@router.post("/{org_id}/secrets")
async def add_secret(
    org_id: str, 
    secret_data: schemas.SecretCreate, 
    current_user: models.User = Depends(require_organization), 
    db: AsyncSession = Depends(get_db)
):
    if str(current_user.org_id) != org_id:
        raise HTTPException(status_code=403, detail="Unauthorized. You do not belong to this organization.")
    
    encrypted_val = encrypt_api_key(secret_data.raw_api_key) 
    
    preview = f"{secret_data.raw_api_key[:4]}...{secret_data.raw_api_key[-4:]}" if len(secret_data.raw_api_key) > 8 else "****"
    
    new_secret = models.OrganizationSecret(
        org_id=current_user.org_id,
        provider=secret_data.provider,
        encrypted_key=encrypted_val,
        key_preview=preview  
    )
    
    db.add(new_secret)
    await db.commit()
    
    return {"message": "Key securely stored.", "key_preview": preview}

@router.get("/{org_id}/secrets", response_model=list[schemas.SecretResponse])
async def get_secrets(
    org_id: str,
    current_user: models.User = Depends(require_organization),
    db: AsyncSession = Depends(get_db)
):
    if str(current_user.org_id) != org_id:
        raise HTTPException(status_code=403, detail="Unauthorized. You do not belong to this organization.")
    
    stmt = select(models.OrganizationSecret).where(models.OrganizationSecret.org_id == org_id)
    result = await db.execute(stmt)
    return result.scalars().all()

@router.put("/{org_id}/secrets/{secret_id}")
async def update_secret(
    org_id: str,
    secret_id: str,
    secret_data: schemas.SecretUpdate,
    current_user: models.User = Depends(require_organization),
    db: AsyncSession = Depends(get_db)
):
    if str(current_user.org_id) != org_id:
        raise HTTPException(status_code=403, detail="Unauthorized. You do not belong to this organization.")
    
    stmt = select(models.OrganizationSecret).where(
        (models.OrganizationSecret.org_id == org_id) & (models.OrganizationSecret.id == secret_id)
    )
    result = await db.execute(stmt)
    secret = result.scalars().first()

    if not secret:
        raise HTTPException(status_code=404, detail="Secret not found.")
    
    if secret_data.provider:
        secret.provider = secret_data.provider
    if secret_data.raw_api_key:
        secret.encrypted_key = encrypt_api_key(secret_data.raw_api_key)
        secret.key_preview = f"{secret_data.raw_api_key[:4]}...{secret_data.raw_api_key[-4:]}" if len(secret_data.raw_api_key) > 8 else "****"
    
    await db.commit()
    await db.refresh(secret)
    return {"message": "Secret updated successfully.", "key_preview": secret.key_preview}

@router.delete("/{org_id}/secrets/{secret_id}")
async def delete_secret(
    org_id: str,
    secret_id: str,
    current_user: models.User = Depends(require_organization),
    db: AsyncSession = Depends(get_db)
):
    if str(current_user.org_id) != org_id:
        raise HTTPException(status_code=403, detail="Unauthorized. You do not belong to this organization.")
    
    stmt = select(models.OrganizationSecret).where(
        (models.OrganizationSecret.org_id == org_id) & (models.OrganizationSecret.id == secret_id)
    )
    result = await db.execute(stmt)
    secret = result.scalars().first()

    if not secret:
        raise HTTPException(status_code=404, detail="Secret not found.")
    
    await db.delete(secret)
    await db.commit()
    
    return {"message": "Secret deleted successfully."}