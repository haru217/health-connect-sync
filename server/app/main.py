from __future__ import annotations

import json
import secrets
import uuid
from datetime import datetime, timezone
from typing import Any

from fastapi import Depends, FastAPI, Header, HTTPException

from . import settings
from .auth import hash_token, require_device_token
from .firestore_client import get_client
from .models import (
    DeviceRegistrationRequest,
    DeviceRegistrationResponse,
    SyncRequest,
    SyncResponse,
)

app = FastAPI(title="Health Connect Sync Bridge API", version="0.1.0")


@app.get("/health")
def health() -> dict[str, Any]:
    return {"ok": True, "ts": datetime.now(timezone.utc).isoformat()}


@app.post("/v1/register", response_model=DeviceRegistrationResponse)
def register(
    req: DeviceRegistrationRequest,
    x_register_key: str | None = Header(default=None, alias="X-Register-Key"),
) -> DeviceRegistrationResponse:
    if not settings.REGISTER_ENABLED:
        raise HTTPException(status_code=403, detail="Register disabled")
    if settings.REGISTER_KEY and x_register_key != settings.REGISTER_KEY:
        raise HTTPException(status_code=401, detail="Invalid register key")

    device_id = f"dev_{uuid.uuid4().hex}"
    # 32 bytes => URL-safe
    device_token = secrets.token_urlsafe(32)
    token_hash = hash_token(device_token)

    db = get_client()
    now = datetime.now(timezone.utc)

    db.collection("devices").document(device_id).set(
        {
            "tokenHash": token_hash,
            "createdAt": now,
            "lastSeenAt": now,
            "deviceName": req.deviceName,
            "appVersion": req.appVersion,
        }
    )

    return DeviceRegistrationResponse(deviceId=device_id, deviceToken=device_token)


def _device_by_token_hash(token_hash: str) -> tuple[str, dict[str, Any]]:
    db = get_client()
    # Query by tokenHash (needs index only for compound queries; this is simple equality)
    q = db.collection("devices").where("tokenHash", "==", token_hash).limit(1).stream()
    doc = next(q, None)
    if doc is None:
        raise HTTPException(status_code=401, detail="Invalid token")
    return doc.id, doc.to_dict() or {}


def _stable_json(obj: Any) -> str:
    return json.dumps(obj, ensure_ascii=False, sort_keys=True, separators=(",", ":"), default=str)


def _compute_record_key(device_id: str, r: dict[str, Any]) -> str:
    base = {
        "deviceId": device_id,
        "type": r.get("type"),
        "recordId": r.get("recordId"),
        "source": r.get("source"),
        "startTime": r.get("startTime"),
        "endTime": r.get("endTime"),
        "time": r.get("time"),
        "payload": r.get("payload"),
    }
    s = _stable_json(base)
    import hashlib

    return hashlib.sha256(s.encode("utf-8")).hexdigest()


@app.post("/v1/sync", response_model=SyncResponse)
def sync(
    req: SyncRequest,
    token: str = Depends(require_device_token),
) -> SyncResponse:
    db = get_client()

    token_hash = hash_token(token)
    authed_device_id, _device = _device_by_token_hash(token_hash)

    if req.deviceId != authed_device_id:
        raise HTTPException(status_code=401, detail="deviceId mismatch")

    now = datetime.now(timezone.utc)

    # Write sync run meta
    db.collection("syncRuns").document(req.syncId).set(
        {
            "deviceId": req.deviceId,
            "rangeStart": req.rangeStart,
            "rangeEnd": req.rangeEnd,
            "receivedAt": now,
            "status": "received",
            "recordCount": len(req.records),
        },
        merge=True,
    )

    # Batch upserts to Firestore (<=500 writes per batch)
    upserted = 0
    skipped = 0
    batch = db.batch()
    ops_in_batch = 0

    def commit_batch() -> None:
        nonlocal batch, ops_in_batch
        if ops_in_batch > 0:
            batch.commit()
            batch = db.batch()
            ops_in_batch = 0

    for rec in req.records:
        # Use JSON-mode for stable id computation (RFC3339 timestamps),
        # and python-mode for Firestore so timestamps can be stored as Timestamp.
        r_json = rec.model_dump(mode="json")
        r_py = rec.model_dump()

        record_key = r_json.get("recordKey") or _compute_record_key(req.deviceId, r_json)

        doc_ref = db.collection("healthRecords").document(record_key)
        batch.set(
            doc_ref,
            {
                "deviceId": req.deviceId,
                "type": r_py.get("type"),
                "recordId": r_py.get("recordId"),
                "recordKey": record_key,
                "source": r_py.get("source"),
                "startTime": r_py.get("startTime"),
                "endTime": r_py.get("endTime"),
                "time": r_py.get("time"),
                "lastModifiedTime": r_py.get("lastModifiedTime"),
                "unit": r_py.get("unit"),
                "payload": r_py.get("payload"),
                "ingestedAt": now,
            },
            merge=True,
        )
        ops_in_batch += 1
        upserted += 1

        if ops_in_batch >= 450:
            commit_batch()

    commit_batch()

    # Update sync run + device lastSeenAt
    db.collection("syncRuns").document(req.syncId).set(
        {"status": "ok", "upsertedCount": upserted, "skippedCount": skipped}, merge=True
    )
    db.collection("devices").document(req.deviceId).set({"lastSeenAt": now}, merge=True)

    return SyncResponse(accepted=True, upsertedCount=upserted, skippedCount=skipped)
