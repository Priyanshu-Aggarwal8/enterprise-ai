from pydantic import BaseModel, ConfigDict
from typing import List, Optional
from datetime import datetime
from uuid import UUID

class OrganizationCreate(BaseModel):
    name: str

class OrganizationResponse(BaseModel):
    id: UUID
    name: str
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)

class SecretCreate(BaseModel):
    provider: str
    raw_api_key: str

class SecretResponse(BaseModel):
    id: UUID
    provider: str
    key_preview: str
    
    model_config = ConfigDict(from_attributes=True)