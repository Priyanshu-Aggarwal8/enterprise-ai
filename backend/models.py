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
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    organization = relationship("Organization")

class User(Base):
    __tablename__ = "users"

    uid = Column(String, primary_key=True, index=True)
    email = Column(String, unique=True, index=True, nullable=False)
    
    org_id = Column(UUID(as_uuid=True), ForeignKey("organizations.id", ondelete="CASCADE"), nullable=True)
    
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    organization = relationship("Organization")