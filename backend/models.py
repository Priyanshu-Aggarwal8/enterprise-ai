import uuid
from sqlalchemy import Column, String, ForeignKey, DateTime, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship
from database import Base
from pgvector.sqlalchemy import Vector

class Organization(Base):
    __tablename__ = "organizations"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name = Column(String, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    spaces = relationship("Space", back_populates="organization", cascade="all, delete-orphan")
    secret = relationship("OrganizationSecret", back_populates="organization", uselist=False, cascade="all, delete-orphan")
    documents = relationship("DocumentChunk", back_populates="organization", cascade="all, delete-orphan")
    custom_tools = relationship("CustomTool", back_populates="organization", cascade="all, delete-orphan")
    agents = relationship("AgentDefinition", back_populates="organization", cascade="all, delete-orphan")
    users = relationship("User", back_populates="organization", cascade="all, delete-orphan")

class Space(Base):
    __tablename__ = "spaces"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    org_id = Column(UUID(as_uuid=True), ForeignKey("organizations.id"), nullable=False)
    name = Column(String, nullable=False)
    access_level = Column(String, default="private")
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    organization = relationship("Organization", back_populates="spaces")

class OrganizationSecret(Base):
    __tablename__ = "organization_secrets"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    org_id = Column(UUID(as_uuid=True), ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False, unique=True)
    provider = Column(String, nullable=False) 
    encrypted_key = Column(String, nullable=False)
    key_preview = Column(String, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    organization = relationship("Organization")

class DocumentChunk(Base):
    __tablename__ = "document_chunks"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    org_id = Column(UUID(as_uuid=True), ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False)
    filename = Column(String, nullable=False)
    content = Column(Text, nullable=False)
    
    embedding = Column(Vector(384), nullable=False)
    
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    organization = relationship("Organization")

class CustomTool(Base):
    __tablename__ = "custom_tools"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    org_id = Column(UUID(as_uuid=True), ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False)
    name = Column(String, nullable=False)
    description = Column(String, nullable=False)
    python_code = Column(Text, nullable=False)
    risk_tier = Column(String, nullable=False, default="unknown")
    sandbox_status = Column(String, nullable=False, default="pending")
    sandbox_report = Column(Text, nullable=True)
    requires_approval = Column(String, nullable=False, default="false")
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    organization = relationship("Organization")

class AgentToolBinding(Base):
    __tablename__ = "agent_tool_bindings"

    agent_id = Column(
        UUID(as_uuid=True),
        ForeignKey("agent_definitions.id", ondelete="CASCADE"),
        primary_key=True,
    )
    tool_id = Column(
        UUID(as_uuid=True),
        ForeignKey("custom_tools.id", ondelete="CASCADE"),
        primary_key=True,
    )

class AgentDefinition(Base):
    __tablename__ = "agent_definitions"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    org_id = Column(UUID(as_uuid=True), ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False)
    name = Column(String, nullable=False)
    purpose = Column(String, nullable=False)
    system_prompt = Column(Text, nullable=False)
    model_name = Column(String, nullable=False, default="gemini-2.5-flash")
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    organization = relationship("Organization", back_populates="agents")
    tool_bindings = relationship(
        "AgentToolBinding",
        cascade="all, delete-orphan",
        passive_deletes=True,
    )

class User(Base):
    __tablename__ = "users"

    uid = Column(String, primary_key=True, index=True)
    email = Column(String, unique=True, index=True, nullable=False)
    
    org_id = Column(UUID(as_uuid=True), ForeignKey("organizations.id", ondelete="CASCADE"), nullable=True)
    
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    organization = relationship("Organization")


class SavedChat(Base):
    __tablename__ = "saved_chats"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    org_id = Column(UUID(as_uuid=True), ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False)
    agent_id = Column(UUID(as_uuid=True), ForeignKey("agent_definitions.id", ondelete="SET NULL"), nullable=True)
    session_id = Column(String, nullable=True)
    title = Column(String, nullable=False)
    content = Column(Text, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    organization = relationship("Organization")