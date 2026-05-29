from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from firebase_admin import auth
from database import get_db
import models

router = APIRouter(prefix="/users", tags=["Users"])
security = HTTPBearer()

@router.post("/sync")
async def sync_user_account(
    token: HTTPAuthorizationCredentials = Depends(security),
    db: AsyncSession = Depends(get_db)
):
    try:
        decoded_token = auth.verify_id_token(token.credentials)
        uid = decoded_token.get("uid")
        email = decoded_token.get("email")
    except Exception:
        raise HTTPException(status_code=401, detail="Invalid Firebase token")

    stmt = select(models.User).where(models.User.uid == uid)
    result = await db.execute(stmt)
    user = result.scalars().first()

    if user:
        return {"message": "User synchronized", "org_id": str(user.org_id) if user.org_id else None}

    new_user = models.User(
        uid=uid,
        email=email,
        org_id=None
    )
    db.add(new_user)
    await db.commit()
    
    return {"message": "Account created", "org_id": None}