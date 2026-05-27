import uuid
from sqlalchemy import Column, String, ForeignKey, DateTime
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship
from database import Base

class Organization(Base):
    __tablename__ = "organizations"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name = Column(String, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    # Relationship to Spaces
    spaces = relationship("Space", back_populates="organization", cascade="all, delete-orphan")
    secret = relationship("OrganizationSecret", back_populates="organization", uselist=False, cascade="all, delete-orphan")

class Space(Base):
    __tablename__ = "spaces"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    org_id = Column(UUID(as_uuid=True), ForeignKey("organizations.id"), nullable=False)
    name = Column(String, nullable=False)
    access_level = Column(String, default="private")
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    # Relationship back to Organization
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