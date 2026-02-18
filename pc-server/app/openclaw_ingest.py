from __future__ import annotations

import hashlib
import json
import sqlite3
from datetime import datetime
from typing import Any

from .db import LOCAL_TZ, db, now_iso
from .nutrition import CATALOG, log_alias, log_event


def build_legacy_event_id(file_name: str, line_no: int, raw_line: str) -> str:
    digest = hashlib.sha1(raw_line.encode("utf-8")).hexdigest()[:16]
    return f"legacy:{file_name}:{line_no}:{digest}"


def _payload_hash(payload: dict[str, Any]) -> str:
    s = json.dumps(payload, ensure_ascii=False, sort_keys=True, separators=(",", ":"), default=str)
    return hashlib.sha256(s.encode("utf-8")).hexdigest()


def _parse_consumed_at(raw: Any) -> datetime | None:
    if not isinstance(raw, str) or not raw:
        return None
    try:
        return datetime.fromisoformat(raw.replace("Z", "+00:00")).astimezone(LOCAL_TZ)
    except Exception:
        return None


def _normalize_local_date(raw: Any) -> str | None:
    if not isinstance(raw, str) or not raw:
        return None
    try:
        d = datetime.fromisoformat(raw)
        return d.date().isoformat()
    except Exception as exc:
        raise ValueError(f"Invalid local_date: {raw}") from exc


def _parse_local_date_noon(local_date: str | None) -> datetime | None:
    if not local_date:
        return None
    d = datetime.fromisoformat(local_date)
    return d.replace(hour=12, minute=0, second=0, microsecond=0, tzinfo=LOCAL_TZ)


def _to_float(raw: Any, field_name: str) -> float:
    try:
        return float(raw)
    except Exception as exc:
        raise ValueError(f"Invalid {field_name}: {raw}") from exc


def _to_optional_float(raw: Any, field_name: str) -> float | None:
    if raw is None:
        return None
    return _to_float(raw, field_name)


def _normalize_micros(raw: Any) -> dict[str, float] | None:
    if raw is None:
        return None
    if not isinstance(raw, dict):
        raise ValueError("micros must be an object")
    out: dict[str, float] = {}
    for k, v in raw.items():
        if isinstance(v, (int, float)):
            out[str(k)] = float(v)
    return out


def _normalize_item(raw: Any, fallback_local_date: str | None) -> dict[str, Any]:
    if not isinstance(raw, dict):
        raise ValueError("Each item must be an object")

    alias_raw = raw.get("alias")
    alias = str(alias_raw).strip() if alias_raw is not None else ""
    label_raw = raw.get("label")
    label = str(label_raw).strip() if label_raw is not None else ""

    if alias:
        if alias not in CATALOG:
            raise ValueError(f"Unknown alias: {alias}")
        item_kind = "alias"
    elif label:
        item_kind = "label"
    else:
        raise ValueError("Each item requires alias or label")

    count_raw = raw.get("count")
    count = _to_float(1 if count_raw is None else count_raw, "count")
    if count <= 0:
        raise ValueError("count must be > 0")

    item_local_date = _normalize_local_date(raw.get("local_date") or raw.get("localDate"))
    local_date = item_local_date or fallback_local_date

    consumed_at = _parse_consumed_at(raw.get("consumed_at") or raw.get("consumedAt"))
    if consumed_at is None:
        consumed_at = _parse_local_date_noon(local_date)

    note = raw.get("note")
    if note is not None and not isinstance(note, str):
        note = str(note)

    if item_kind == "alias":
        return {
            "kind": "alias",
            "alias": alias,
            "count": count,
            "note": note,
            "consumed_at": consumed_at,
            "local_date": local_date,
        }

    return {
        "kind": "label",
        "label": label,
        "count": count,
        "note": note,
        "consumed_at": consumed_at,
        "local_date": local_date,
        "kcal": _to_optional_float(raw.get("kcal"), "kcal"),
        "protein_g": _to_optional_float(raw.get("protein_g"), "protein_g"),
        "fat_g": _to_optional_float(raw.get("fat_g"), "fat_g"),
        "carbs_g": _to_optional_float(raw.get("carbs_g"), "carbs_g"),
        "micros": _normalize_micros(raw.get("micros")),
    }


def _upsert_intake(local_date: str, intake_kcal: float, source: str, note: str | None) -> None:
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
            (local_date, float(intake_kcal), source, note, now_iso()),
        )


def _event_exists(event_id: str) -> bool:
    with db() as conn:
        row = conn.execute(
            "SELECT event_id FROM openclaw_ingest_events WHERE event_id = ?",
            (event_id,),
        ).fetchone()
    return row is not None


def _insert_event(event_id: str, source: str | None, payload_hash: str) -> None:
    with db() as conn:
        conn.execute(
            """
            INSERT INTO openclaw_ingest_events(event_id, ingested_at, source, payload_hash)
            VALUES(?,?,?,?)
            """,
            (event_id, now_iso(), source, payload_hash),
        )


def ingest_openclaw_payload(payload: dict[str, Any]) -> dict[str, Any]:
    if not isinstance(payload, dict):
        raise ValueError("Payload must be an object")

    event_id_raw = payload.get("event_id") or payload.get("eventId")
    if not isinstance(event_id_raw, str) or not event_id_raw.strip():
        raise ValueError("event_id is required")
    event_id = event_id_raw.strip()

    source_raw = payload.get("source")
    source = str(source_raw).strip() if source_raw is not None else "openclaw"
    if not source:
        source = "openclaw"

    fallback_local_date = _normalize_local_date(payload.get("local_date") or payload.get("localDate"))

    items = payload.get("items")
    if not isinstance(items, list) or len(items) == 0:
        raise ValueError("items must be a non-empty array")

    normalized_items = [_normalize_item(it, fallback_local_date) for it in items]

    intake_raw = payload.get("intake_kcal")
    if intake_raw is None:
        intake_raw = payload.get("intakeKcal")
    intake_kcal = _to_optional_float(intake_raw, "intake_kcal")
    intake_note_raw = payload.get("intake_note")
    if intake_note_raw is None:
        intake_note_raw = payload.get("intakeNote")
    intake_note = str(intake_note_raw) if intake_note_raw is not None else None

    intake_day = fallback_local_date
    if intake_day is None and normalized_items:
        intake_day = normalized_items[0].get("local_date")
    if intake_kcal is not None and not intake_day:
        raise ValueError("local_date is required when intake_kcal is provided")

    if _event_exists(event_id):
        return {"ok": True, "ingested": 0, "duplicate": 1, "eventId": event_id}

    for item in normalized_items:
        if item["kind"] == "alias":
            log_alias(
                str(item["alias"]),
                consumed_at=item.get("consumed_at"),
                count=float(item["count"]),
                note=item.get("note"),
            )
        else:
            log_event(
                consumed_at=item.get("consumed_at"),
                alias=None,
                label=str(item["label"]),
                count=float(item["count"]),
                kcal=item.get("kcal"),
                protein_g=item.get("protein_g"),
                fat_g=item.get("fat_g"),
                carbs_g=item.get("carbs_g"),
                micros=item.get("micros"),
                note=item.get("note"),
            )

    if intake_kcal is not None and intake_day is not None:
        _upsert_intake(intake_day, intake_kcal, source, intake_note)

    try:
        _insert_event(event_id, source, _payload_hash(payload))
    except sqlite3.IntegrityError:
        return {"ok": True, "ingested": 0, "duplicate": 1, "eventId": event_id}

    return {"ok": True, "ingested": 1, "duplicate": 0, "eventId": event_id}
