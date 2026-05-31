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

class SecretUpdate(BaseModel):
    provider: Optional[str] = None
    raw_api_key: Optional[str] = None

class CustomToolCreate(BaseModel):
    name: str
    description: str
    python_code: str

class BoundAgentSummary(BaseModel):
    id: UUID
    name: str

    model_config = ConfigDict(from_attributes=True)


class CustomToolResponse(BaseModel):
    id: UUID
    name: str
    description: str
    python_code: str
    bound_agents: List[BoundAgentSummary] = []

    model_config = ConfigDict(from_attributes=True)

class AgentRunRequest(BaseModel):
    org_id: str
    prompt: str
    session_id: str
    agent_id: str

class AgentDefinitionCreate(BaseModel):
    name: str
    purpose: str
    system_prompt: str
    model_name: str = "gemini-2.5-flash"
    tool_ids: List[UUID] = []

class AgentDefinitionResponse(BaseModel):
    id: UUID
    name: str
    purpose: str
    system_prompt: str
    model_name: str
    tool_ids: List[UUID] = []
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)