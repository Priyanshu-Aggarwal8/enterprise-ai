import firebase_admin
from firebase_admin import credentials, auth
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from database import get_db
import models

cred = credentials.Certificate("firebase-adminsdk.json")
if not firebase_admin._apps:
    firebase_admin.initialize_app(cred)

security = HTTPBearer()

async def get_current_user(
    token: HTTPAuthorizationCredentials = Depends(security),
    db: AsyncSession = Depends(get_db)
):
    """Gatekeeper 1: Verifies Identity (Who are you?)"""
    try:
        decoded_token = auth.verify_id_token(token.credentials)
        uid = decoded_token.get("uid")
        
        if not uid:
            raise ValueError("Invalid token payload")
            
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired authentication token",
            headers={"WWW-Authenticate": "Bearer"},
        )

    stmt = select(models.User).where(models.User.uid == uid)
    result = await db.execute(stmt)
    user = result.scalars().first()

    if not user:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="User not registered in the Enterprise Platform"
        )
    
    return user


async def require_organization(current_user: models.User = Depends(get_current_user)):
    """Gatekeeper 2: Verifies Workspace (Do you have a desk here?)"""
    if not current_user.org_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You must create or join a workspace to perform this action."
        )
    return current_user