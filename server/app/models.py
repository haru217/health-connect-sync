from __future__ import annotations

from datetime import datetime
from typing import Any, Optional

from pydantic import BaseModel, Field


class DeviceRegistrationRequest(BaseModel):
    deviceName: Optional[str] = None
    appVersion: str


class DeviceRegistrationResponse(BaseModel):
    deviceId: str
    deviceToken: str


class RecordEnvelope(BaseModel):
    type: str
    recordId: Optional[str] = None
    recordKey: Optional[str] = None
    source: Optional[str] = None

    startTime: Optional[datetime] = None
    endTime: Optional[datetime] = None
    time: Optional[datetime] = None

    lastModifiedTime: Optional[datetime] = None
    unit: Optional[str] = None

    payload: dict[str, Any] = Field(default_factory=dict)


class SyncRequest(BaseModel):
    deviceId: str
    syncId: str
    syncedAt: datetime
    rangeStart: datetime
    rangeEnd: datetime
    records: list[RecordEnvelope]


class SyncResponse(BaseModel):
    accepted: bool
    upsertedCount: int
    skippedCount: int


class ErrorResponse(BaseModel):
    error: str
    message: str
    requestId: Optional[str] = None
