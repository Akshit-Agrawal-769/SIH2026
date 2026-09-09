import uuid
from datetime import datetime
from sqlalchemy import Column, String, Float, Integer, BigInteger, DateTime, ForeignKey
from sqlalchemy.dialects.postgresql import UUID, JSONB
from geoalchemy2 import Geography
from sqlalchemy.orm import relationship
from app.db.session import Base

class Instrument(Base):
    __tablename__ = "instruments"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    external_id = Column(String(100), unique=True, nullable=False, index=True)
    platform_type = Column(String(50), nullable=False, index=True) # argo, glider, ctd, bgc
    location = Column(Geography(geometry_type="POINT", srid=4326), nullable=False)
    last_report = Column(DateTime(timezone=True), nullable=False, index=True)
    metadata_json = Column("metadata", JSONB, default=dict)
    created_at = Column(DateTime(timezone=True), default=datetime.utcnow)
    updated_at = Column(DateTime(timezone=True), default=datetime.utcnow, onupdate=datetime.utcnow)

    profiles = relationship("Profile", back_populates="instrument", cascade="all, delete-orphan")

class Profile(Base):
    __tablename__ = "profiles"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    instrument_id = Column(UUID(as_uuid=True), ForeignKey("instruments.id", ondelete="CASCADE"), nullable=False, index=True)
    cycle_number = Column(Integer, nullable=True)
    timestamp = Column(DateTime(timezone=True), nullable=False, index=True)
    latitude = Column(Float, nullable=False)
    longitude = Column(Float, nullable=False)
    max_depth = Column(Float, nullable=True)
    metadata_json = Column("metadata", JSONB, default=dict)
    created_at = Column(DateTime(timezone=True), default=datetime.utcnow)

    instrument = relationship("Instrument", back_populates="profiles")
    measurements = relationship("Measurement", back_populates="profile", cascade="all, delete-orphan")

class Measurement(Base):
    __tablename__ = "measurements"

    id = Column(BigInteger, primary_key=True, autoincrement=True)
    profile_id = Column(UUID(as_uuid=True), ForeignKey("profiles.id", ondelete="CASCADE"), nullable=False, index=True)
    depth = Column(Float, nullable=False)
    pressure = Column(Float, nullable=True)
    temperature = Column(Float, nullable=True)
    salinity = Column(Float, nullable=True)
    chlorophyll = Column(Float, nullable=True)
    oxygen = Column(Float, nullable=True)

    profile = relationship("Profile", back_populates="measurements")
