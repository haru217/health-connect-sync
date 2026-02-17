from __future__ import annotations

from datetime import date, datetime
from typing import Any, Optional

from pydantic import BaseModel, Field


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


class StatusResponse(BaseModel):
    ok: bool
    dbPath: str
    totalRecords: int
    lastReceivedAt: Optional[datetime] = None
    lastSyncId: Optional[str] = None


class IntakeCaloriesUpsertRequest(BaseModel):
    day: date
    intakeKcal: float = Field(ge=0)
    source: Optional[str] = "openclaw"
    note: Optional[str] = None


class IntakeCaloriesUpsertResponse(BaseModel):
    ok: bool
    day: date
    intakeKcal: float
    source: str
    note: Optional[str] = None
    updatedAt: datetime
