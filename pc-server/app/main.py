from __future__ import annotations

import csv
import hashlib
import io
import json
from datetime import datetime
from pathlib import Path
from typing import Any

from fastapi import Depends, FastAPI, HTTPException, Response

from .db import DB_PATH, db, dumps_payload, init_db, iso, now_iso
from .discovery import start_discovery_thread
from .models import (
    IntakeCaloriesUpsertRequest,
    IntakeCaloriesUpsertResponse,
    StatusResponse,
    SyncRequest,
    SyncResponse,
)
from .security import require_api_key
from .summary import build_summary
from .report import build_yesterday_report
from .nutrition import log_alias, log_event

app = FastAPI(title="Health Connect Sync Bridge (Local PC)", version="0.1.0")


@app.on_event("startup")
def _startup() -> None:
    init_db()
    start_discovery_thread()


def _stable_json(obj: Any) -> str:
    return json.dumps(obj, ensure_ascii=False, sort_keys=True, separators=(",", ":"), default=str)


def compute_record_key(device_id: str, r: dict[str, Any]) -> str:
    # Prefer stable key based on recordId if present.
    record_id = r.get("recordId")
    source = r.get("source") or ""
    type_ = r.get("type")

    if record_id:
        basis = f"v1|{device_id}|{type_}|{record_id}|{source}"
        return hashlib.sha256(basis.encode("utf-8")).hexdigest()

    base = {
        "deviceId": device_id,
        "type": type_,
        "source": source,
        "startTime": r.get("startTime"),
        "endTime": r.get("endTime"),
        "time": r.get("time"),
        "payload": r.get("payload"),
    }
    s = _stable_json(base)
    return hashlib.sha256(s.encode("utf-8")).hexdigest()


@app.get("/api/status", response_model=StatusResponse)
def status(_: None = Depends(require_api_key)) -> StatusResponse:
    with db() as conn:
        total = conn.execute("SELECT COUNT(*) AS c FROM health_records").fetchone()["c"]
        last = conn.execute(
            "SELECT received_at, sync_id FROM sync_runs ORDER BY received_at DESC LIMIT 1"
        ).fetchone()

    return StatusResponse(
        ok=True,
        dbPath=str(DB_PATH),
        totalRecords=int(total),
        lastReceivedAt=last["received_at"] if last else None,
        lastSyncId=last["sync_id"] if last else None,
    )


@app.get("/api/summary")
def summary(_: None = Depends(require_api_key)) -> dict[str, Any]:
    return build_summary()


@app.get("/api/report/yesterday")
def report_yesterday(_: None = Depends(require_api_key)) -> dict[str, Any]:
    return {"text": build_yesterday_report()}


@app.get("/api/nutrition/day")
def nutrition_day(date: str, _: None = Depends(require_api_key)) -> dict[str, Any]:
    from .nutrition import get_day_events, get_day_totals

    return {"date": date, "events": get_day_events(date), "totals": get_day_totals(date)}


@app.post("/api/nutrition/log")
def nutrition_log(payload: dict[str, Any], _: None = Depends(require_api_key)) -> dict[str, Any]:
    """Log manual nutrition/supplements.

    Supports backfilling by specifying either:
    - consumed_at: ISO8601 datetime
    - local_date: YYYY-MM-DD (logged at 12:00 local)

    Payload examples:
    - {"alias":"protein", "count":1}
    - {"items":[{"alias":"protein","count":1},{"alias":"vitamin_d","count":1}]}
    - {"label":"something", "count":1, "kcal":300, "protein_g":6, "fat_g":1, "carbs_g":70}
    """

    from datetime import datetime
    from .db import LOCAL_TZ

    def parse_consumed_at(obj: dict[str, Any]) -> datetime | None:
        ca = obj.get("consumed_at") or obj.get("consumedAt")
        if isinstance(ca, str) and ca:
            try:
                return datetime.fromisoformat(ca.replace("Z", "+00:00")).astimezone(LOCAL_TZ)
            except Exception:
                return None
        ld = obj.get("local_date") or obj.get("localDate")
        if isinstance(ld, str) and ld:
            try:
                d = datetime.fromisoformat(ld)
                # put it at noon local time
                return d.replace(hour=12, minute=0, second=0, microsecond=0, tzinfo=LOCAL_TZ)
            except Exception:
                return None
        return None

    items = payload.get("items")
    if isinstance(items, list):
        for it in items:
            if not isinstance(it, dict):
                continue
            consumed_at = parse_consumed_at(it) or parse_consumed_at(payload)
            alias = it.get("alias")
            label = it.get("label")
            count = float(it.get("count") or 1)
            note = it.get("note")
            kcal = it.get("kcal")
            protein_g = it.get("protein_g")
            fat_g = it.get("fat_g")
            carbs_g = it.get("carbs_g")
            micros = it.get("micros")

            if alias:
                log_alias(str(alias), consumed_at=consumed_at, count=count, note=note)
            elif label:
                log_event(
                    consumed_at=consumed_at,
                    alias=None,
                    label=str(label),
                    count=count,
                    kcal=float(kcal) if kcal is not None else None,
                    protein_g=float(protein_g) if protein_g is not None else None,
                    fat_g=float(fat_g) if fat_g is not None else None,
                    carbs_g=float(carbs_g) if carbs_g is not None else None,
                    micros=micros if isinstance(micros, dict) else None,
                    note=note,
                )
        return {"ok": True, "count": len(items)}

    consumed_at = parse_consumed_at(payload)

    alias = payload.get("alias")
    if alias:
        count = float(payload.get("count") or 1)
        note = payload.get("note")
        log_alias(str(alias), consumed_at=consumed_at, count=count, note=note)
        return {"ok": True}

    label = payload.get("label")
    if label:
        count = float(payload.get("count") or 1)
        note = payload.get("note")
        kcal = payload.get("kcal")
        protein_g = payload.get("protein_g")
        fat_g = payload.get("fat_g")
        carbs_g = payload.get("carbs_g")
        micros = payload.get("micros")
        log_event(
            consumed_at=consumed_at,
            alias=None,
            label=str(label),
            count=count,
            kcal=float(kcal) if kcal is not None else None,
            protein_g=float(protein_g) if protein_g is not None else None,
            fat_g=float(fat_g) if fat_g is not None else None,
            carbs_g=float(carbs_g) if carbs_g is not None else None,
            micros=micros if isinstance(micros, dict) else None,
            note=note,
        )
        return {"ok": True}

    raise HTTPException(status_code=400, detail="Invalid payload")


@app.post("/api/intake", response_model=IntakeCaloriesUpsertResponse)
def upsert_intake(
    req: IntakeCaloriesUpsertRequest,
    _: None = Depends(require_api_key),
) -> IntakeCaloriesUpsertResponse:
    source = (req.source or "openclaw").strip() or "openclaw"
    updated_at = now_iso()
    with db() as conn:
        conn.execute(
            """
            INSERT INTO intake_calories_daily(day, intake_kcal, source, note, updated_at)
            VALUES(?,?,?,?,?)
            ON CONFLICT(day) DO UPDATE SET
              intake_kcal=excluded.intake_kcal,
              source=excluded.source,
              note=excluded.note,
              updated_at=excluded.updated_at
            """,
            (req.day.isoformat(), float(req.intakeKcal), source, req.note, updated_at),
        )

    return IntakeCaloriesUpsertResponse(
        ok=True,
        day=req.day,
        intakeKcal=float(req.intakeKcal),
        source=source,
        note=req.note,
        updatedAt=datetime.fromisoformat(updated_at),
    )


@app.get("/ui")
def ui() -> Response:
    html = Path(__file__).with_name("ui_template.html").read_text(encoding="utf-8")
    return Response(content=html, media_type="text/html")


@app.post("/api/sync", response_model=SyncResponse)
def sync(req: SyncRequest, _: None = Depends(require_api_key)) -> SyncResponse:
    upserted = 0
    skipped = 0

    with db() as conn:
        # Register sync run (idempotent)
        conn.execute(
            """
            INSERT OR IGNORE INTO sync_runs(
              sync_id, device_id, synced_at, range_start, range_end, received_at, record_count
            ) VALUES(?,?,?,?,?,?,?)
            """,
            (
                req.syncId,
                req.deviceId,
                iso(req.syncedAt),
                iso(req.rangeStart),
                iso(req.rangeEnd),
                now_iso(),
                len(req.records),
            ),
        )

        for rec in req.records:
            r_json = rec.model_dump(mode="json")
            record_key = r_json.get("recordKey") or compute_record_key(req.deviceId, r_json)

            try:
                conn.execute(
                    """
                    INSERT INTO health_records(
                      record_key, device_id, type, record_id, source,
                      start_time, end_time, time, last_modified_time, unit,
                      payload_json, ingested_at
                    ) VALUES(?,?,?,?,?,?,?,?,?,?,?,?)
                    ON CONFLICT(record_key) DO UPDATE SET
                      payload_json=excluded.payload_json,
                      last_modified_time=excluded.last_modified_time,
                      ingested_at=excluded.ingested_at
                    """,
                    (
                        record_key,
                        req.deviceId,
                        rec.type,
                        rec.recordId,
                        rec.source,
                        iso(rec.startTime),
                        iso(rec.endTime),
                        iso(rec.time),
                        iso(rec.lastModifiedTime),
                        rec.unit,
                        dumps_payload(rec.payload),
                        now_iso(),
                    ),
                )
                upserted += 1
            except Exception:
                skipped += 1

        conn.execute(
            "UPDATE sync_runs SET upserted_count=?, skipped_count=? WHERE sync_id=?",
            (upserted, skipped, req.syncId),
        )

    return SyncResponse(accepted=True, upsertedCount=upserted, skippedCount=skipped)


@app.get("/api/export.csv")
def export_csv(type: str | None = None, _: None = Depends(require_api_key)) -> Response:
    with db() as conn:
        if type:
            rows = conn.execute(
                "SELECT * FROM health_records WHERE type=? ORDER BY ingested_at ASC", (type,)
            ).fetchall()
        else:
            rows = conn.execute("SELECT * FROM health_records ORDER BY ingested_at ASC").fetchall()

    out = io.StringIO()
    w = csv.writer(out)
    w.writerow(
        [
            "record_key",
            "device_id",
            "type",
            "record_id",
            "source",
            "start_time",
            "end_time",
            "time",
            "last_modified_time",
            "unit",
            "payload_json",
            "ingested_at",
        ]
    )
    for r in rows:
        w.writerow([r[c] for c in r.keys()])

    return Response(content=out.getvalue(), media_type="text/csv")

