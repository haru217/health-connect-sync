from __future__ import annotations

import csv
import datetime as _dt
import hashlib
import io
import json
import os
from datetime import datetime
from pathlib import Path
from typing import Any

from fastapi import Depends, FastAPI, HTTPException, Response
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from .db import DB_PATH, db, dumps_payload, init_db, iso, now_iso
from .discovery import start_discovery_thread
from .models import (
    IntakeCaloriesUpsertRequest,
    IntakeCaloriesUpsertResponse,
    StatusResponse,
    SyncRequest,
    SyncResponse,
    ProfileUpdateRequest,
    ReportSaveRequest,
)
from .security import require_api_key
from .summary import build_summary
from .report import build_yesterday_report
from .nutrition import log_alias, log_event
from .openclaw_ingest import ingest_openclaw_payload
from .profile import get_profile, upsert_profile
from .reports import save_report, list_reports, get_report, delete_report
from .prompt_gen import build_prompt, calc_nutrient_targets

app = FastAPI(title="Health Connect Sync Bridge (Local PC)", version="0.1.0")
_CF_ACCESS_EMAIL = os.getenv("CF_ACCESS_EMAIL", "").strip().lower()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
def _startup() -> None:
    init_db()
    start_discovery_thread()


@app.middleware("http")
async def _enforce_cf_access_email(request, call_next):
    if not _CF_ACCESS_EMAIL:
        return await call_next(request)

    if request.url.path == "/healthz":
        return await call_next(request)

    email = request.headers.get("CF-Access-Authenticated-User-Email", "").strip().lower()
    if email != _CF_ACCESS_EMAIL:
        return JSONResponse(status_code=403, content={"detail": "Forbidden"})

    return await call_next(request)


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


@app.get("/healthz")
def healthz() -> dict[str, bool]:
    return {"ok": True}


_SUMMARY_CACHE_KEY = "summary_v1"
_SUMMARY_TTL = 300  # 5分


def _get_cached_summary(conn) -> dict | None:
    row = conn.execute(
        "SELECT data, cached_at FROM summary_cache WHERE cache_key = ?",
        (_SUMMARY_CACHE_KEY,),
    ).fetchone()
    if row is None:
        return None
    cached_at = _dt.datetime.fromisoformat(row["cached_at"])
    age = (_dt.datetime.now(_dt.timezone.utc) - cached_at).total_seconds()
    if age > _SUMMARY_TTL:
        return None
    return json.loads(row["data"])


def _set_cached_summary(conn, data: dict) -> None:
    conn.execute(
        "INSERT OR REPLACE INTO summary_cache (cache_key, data, cached_at) VALUES (?, ?, ?)",
        (
            _SUMMARY_CACHE_KEY,
            json.dumps(data, ensure_ascii=False),
            _dt.datetime.now(_dt.timezone.utc).isoformat(),
        ),
    )


def _invalidate_summary_cache(conn) -> None:
    conn.execute("DELETE FROM summary_cache WHERE cache_key = ?", (_SUMMARY_CACHE_KEY,))


@app.get("/api/summary")
def summary(
    date: str | None = None,
    _: None = Depends(require_api_key),
) -> dict[str, Any]:
    # When date is specified, use date-specific cache key
    cache_key = f"summary_v1_{date}" if date else _SUMMARY_CACHE_KEY
    with db() as conn:
        row = conn.execute(
            "SELECT data, cached_at FROM summary_cache WHERE cache_key = ?",
            (cache_key,),
        ).fetchone()
        if row is not None:
            cached_at = _dt.datetime.fromisoformat(row["cached_at"])
            age = (_dt.datetime.now(_dt.timezone.utc) - cached_at).total_seconds()
            if age <= _SUMMARY_TTL:
                return json.loads(row["data"])

        result = build_summary()
        conn.execute(
            "INSERT OR REPLACE INTO summary_cache (cache_key, data, cached_at) VALUES (?, ?, ?)",
            (cache_key, json.dumps(result, ensure_ascii=False),
             _dt.datetime.now(_dt.timezone.utc).isoformat()),
        )
        return result


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

    try:
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
                    k2 = float(kcal) if kcal is not None else None
                    p2 = float(protein_g) if protein_g is not None else None
                    f2 = float(fat_g) if fat_g is not None else None
                    c2 = float(carbs_g) if carbs_g is not None else None

                    # Estimate micronutrients first, then let provided values override.
                    from .estimator import merge_micros_with_estimate

                    micros2 = merge_micros_with_estimate(
                        str(label),
                        kcal=k2,
                        protein_g=p2,
                        fat_g=f2,
                        carbs_g=c2,
                        provided_micros=micros,
                    )

                    log_event(
                        consumed_at=consumed_at,
                        alias=None,
                        label=str(label),
                        count=count,
                        kcal=k2,
                        protein_g=p2,
                        fat_g=f2,
                        carbs_g=c2,
                        micros=micros2,
                        note=note,
                    )
            with db() as conn:
                _invalidate_summary_cache(conn)
            return {"ok": True, "count": len(items)}

        consumed_at = parse_consumed_at(payload)

        alias = payload.get("alias")
        if alias:
            count = float(payload.get("count") or 1)
            note = payload.get("note")
            log_alias(str(alias), consumed_at=consumed_at, count=count, note=note)
            with db() as conn:
                _invalidate_summary_cache(conn)
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

            k2 = float(kcal) if kcal is not None else None
            p2 = float(protein_g) if protein_g is not None else None
            f2 = float(fat_g) if fat_g is not None else None
            c2 = float(carbs_g) if carbs_g is not None else None

            from .estimator import merge_micros_with_estimate

            micros2 = merge_micros_with_estimate(
                str(label),
                kcal=k2,
                protein_g=p2,
                fat_g=f2,
                carbs_g=c2,
                provided_micros=micros,
            )

            log_event(
                consumed_at=consumed_at,
                alias=None,
                label=str(label),
                count=count,
                kcal=k2,
                protein_g=p2,
                fat_g=f2,
                carbs_g=c2,
                micros=micros2,
                note=note,
            )
            with db() as conn:
                _invalidate_summary_cache(conn)
            return {"ok": True}

        raise HTTPException(status_code=400, detail="Invalid payload")
    except (ValueError, TypeError) as exc:
        raise HTTPException(status_code=400, detail=f"Invalid payload: {exc}") from exc


@app.delete("/api/nutrition/log/{event_id}")
def nutrition_log_delete(
    event_id: int,
    _: None = Depends(require_api_key),
) -> dict:
    from .nutrition import delete_event

    ok = delete_event(event_id)
    if not ok:
        raise HTTPException(status_code=404, detail="Event not found")
    with db() as conn:
        _invalidate_summary_cache(conn)
    return {"ok": True, "deleted_id": event_id}


@app.post("/api/openclaw/ingest")
def openclaw_ingest(payload: dict[str, Any], _: None = Depends(require_api_key)) -> dict[str, Any]:
    try:
        return ingest_openclaw_payload(payload)
    except (ValueError, TypeError) as exc:
        raise HTTPException(status_code=400, detail=f"Invalid payload: {exc}") from exc


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
        _invalidate_summary_cache(conn)

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
        _invalidate_summary_cache(conn)

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

# ── プロフィール ──────────────────────────────────────────────

@app.get("/api/profile")
def profile_get(_: None = Depends(require_api_key)) -> dict:
    data = get_profile()
    return data if data is not None else {}


@app.put("/api/profile")
def profile_put(
    req: ProfileUpdateRequest,
    _: None = Depends(require_api_key),
) -> dict:
    return upsert_profile(**req.model_dump(exclude_none=True))


# ── サプリカタログ ────────────────────────────────────────────

@app.get("/api/supplements")
def supplements_get(_: None = Depends(require_api_key)) -> dict:
    from .nutrition import CATALOG
    return {
        "supplements": [
            {
                "alias": item.alias,
                "label": item.label,
                "kcal": item.kcal,
                "protein_g": item.protein_g,
                "fat_g": item.fat_g,
                "carbs_g": item.carbs_g,
            }
            for item in CATALOG.values()
        ]
    }


# ── AIプロンプト生成 ──────────────────────────────────────────

@app.get("/api/prompt")
def prompt_get(
    type: str = "daily",
    _: None = Depends(require_api_key),
) -> dict:
    if type not in ("daily", "weekly", "monthly"):
        raise HTTPException(status_code=400, detail="type must be daily | weekly | monthly")
    try:
        prompt = build_prompt(type)
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc
    return {"type": type, "prompt": prompt}


# ── AIレポート CRUD ───────────────────────────────────────────

@app.post("/api/reports", status_code=201)
def reports_create(
    req: ReportSaveRequest,
    _: None = Depends(require_api_key),
) -> dict:
    return save_report(
        report_date=req.report_date,
        report_type=req.report_type,
        prompt_used=req.prompt_used,
        content=req.content,
    )


@app.get("/api/reports")
def reports_list(
    report_type: str | None = None,
    _: None = Depends(require_api_key),
) -> dict:
    return {"reports": list_reports(report_type=report_type)}


@app.get("/api/reports/{report_id}")
def reports_get(
    report_id: int,
    _: None = Depends(require_api_key),
) -> dict:
    data = get_report(report_id)
    if data is None:
        raise HTTPException(status_code=404, detail="Report not found")
    return data


@app.delete("/api/reports/{report_id}")
def reports_delete(
    report_id: int,
    _: None = Depends(require_api_key),
) -> dict:
    ok = delete_report(report_id)
    return {"ok": ok, "deleted_id": report_id}


# ── 栄養素ターゲット ──────────────────────────────────────────

@app.get("/api/nutrients/targets")
def nutrients_targets(
    date: str | None = None,
    _: None = Depends(require_api_key),
) -> dict:
    if date is not None:
        try:
            datetime.fromisoformat(f"{date}T00:00:00")
        except ValueError as exc:
            raise HTTPException(status_code=400, detail="date は YYYY-MM-DD 形式で指定してください") from exc

    profile = get_profile() or {}
    height = float(profile.get("height_cm") or 172.0)
    birth_year = int(profile.get("birth_year") or 1985)
    sex = str(profile.get("sex") or "male")

    # 最新体重を health_records から直接取得（build_summary() の呼び出しを避ける）
    latest_weight = 70.0  # fallback
    with db() as conn:
        row = conn.execute(
            "SELECT payload_json FROM health_records WHERE type='WeightRecord' ORDER BY time DESC LIMIT 1"
        ).fetchone()
    if row:
        try:
            payload = json.loads(row["payload_json"])
            for key in ("inKilograms", "kilograms", "kg"):
                if key in payload and payload[key] is not None:
                    latest_weight = float(payload[key])
                    break
        except Exception:
            pass

    targets = calc_nutrient_targets(
        height_cm=height,
        weight_kg=latest_weight,
        birth_year=birth_year,
        sex=sex,
        local_date=date,
    )
    return {"targets": targets}


# ── 期間集計ヘルパー ──────────────────────────────────────────

import datetime as _dt2


def _date_range(base_date: str, period: str) -> tuple[str, str]:
    """Return (start_date, end_date) strings for the given base_date and period.

    - week:  base_date-6 .. base_date (7 days)
    - month: base_date-29 .. base_date (30 days)
    - year:  base_date-364 .. base_date (365 days, used for monthly grouping)
    """
    end = _dt2.date.fromisoformat(base_date)
    if period == "week":
        start = end - _dt2.timedelta(days=6)
    elif period == "month":
        start = end - _dt2.timedelta(days=29)
    else:  # year
        start = end - _dt2.timedelta(days=364)
    return start.isoformat(), end.isoformat()


def _validate_date_period(date: str | None, period: str) -> str:
    """Validate date (default today) and period. Returns resolved date string."""
    if date is None:
        date = _dt2.date.today().isoformat()
    else:
        try:
            _dt2.date.fromisoformat(date)
        except ValueError as exc:
            raise HTTPException(status_code=400, detail="date は YYYY-MM-DD 形式") from exc
    if period not in ("week", "month", "year"):
        raise HTTPException(status_code=400, detail="period は week | month | year")
    return date


@app.get("/api/body-data")
def body_data(
    date: str | None = None,
    period: str = "week",
    _: None = Depends(require_api_key),
) -> dict[str, Any]:
    base_date = _validate_date_period(date, period)
    start_date, end_date = _date_range(base_date, period)

    with db() as conn:
        # Latest weight/body fat on or before base_date
        latest_w = conn.execute(
            """SELECT payload_json, time FROM health_records
               WHERE type='WeightRecord' AND date(time) <= ?
               ORDER BY time DESC LIMIT 1""",
            (base_date,),
        ).fetchone()

        latest_bf = conn.execute(
            """SELECT payload_json, time FROM health_records
               WHERE type='BodyFatRecord' AND date(time) <= ?
               ORDER BY time DESC LIMIT 1""",
            (base_date,),
        ).fetchone()

        latest_bmr = conn.execute(
            """SELECT payload_json, time FROM health_records
               WHERE type='BasalMetabolicRateRecord' AND date(time) <= ?
               ORDER BY time DESC LIMIT 1""",
            (base_date,),
        ).fetchone()

        # Series data
        if period == "year":
            # Monthly averages
            weight_rows = conn.execute(
                """SELECT strftime('%Y-%m', time) AS month,
                          AVG(CAST(json_extract(payload_json,'$.inKilograms') AS REAL)) AS weight_kg
                   FROM health_records
                   WHERE type='WeightRecord' AND date(time) BETWEEN ? AND ?
                   GROUP BY month ORDER BY month""",
                (start_date, end_date),
            ).fetchall()
            bf_rows = conn.execute(
                """SELECT strftime('%Y-%m', time) AS month,
                          AVG(CAST(json_extract(payload_json,'$.percentage') AS REAL)) AS body_fat_pct
                   FROM health_records
                   WHERE type='BodyFatRecord' AND date(time) BETWEEN ? AND ?
                   GROUP BY month ORDER BY month""",
                (start_date, end_date),
            ).fetchall()
        else:
            weight_rows = conn.execute(
                """SELECT date(time) AS d,
                          AVG(CAST(json_extract(payload_json,'$.inKilograms') AS REAL)) AS weight_kg
                   FROM health_records
                   WHERE type='WeightRecord' AND date(time) BETWEEN ? AND ?
                   GROUP BY d ORDER BY d""",
                (start_date, end_date),
            ).fetchall()
            bf_rows = conn.execute(
                """SELECT date(time) AS d,
                          AVG(CAST(json_extract(payload_json,'$.percentage') AS REAL)) AS body_fat_pct
                   FROM health_records
                   WHERE type='BodyFatRecord' AND date(time) BETWEEN ? AND ?
                   GROUP BY d ORDER BY d""",
                (start_date, end_date),
            ).fetchall()

        # Profile（height, goal_weight）
        profile_row = conn.execute(
            "SELECT height_cm, goal_weight_kg FROM user_profile LIMIT 1"
        ).fetchone()
        goal_weight = profile_row["goal_weight_kg"] if profile_row else None

    # Parse current values
    def _parse_weight(row) -> float | None:
        if not row:
            return None
        try:
            p = json.loads(row["payload_json"])
            for k in ("inKilograms", "kilograms", "kg"):
                if p.get(k) is not None:
                    return float(p[k])
        except Exception:
            pass
        return None

    def _parse_bf(row) -> float | None:
        if not row:
            return None
        try:
            p = json.loads(row["payload_json"])
            for k in ("percentage", "pct", "value"):
                if p.get(k) is not None:
                    return float(p[k])
        except Exception:
            pass
        return None

    def _parse_bmr(row) -> float | None:
        if not row:
            return None
        try:
            p = json.loads(row["payload_json"])
            for k in ("inKilocaloriesPerDay", "kcalPerDay", "value"):
                if p.get(k) is not None:
                    return float(p[k])
        except Exception:
            pass
        return None

    cur_weight = _parse_weight(latest_w)
    cur_bf = _parse_bf(latest_bf)
    cur_bmr = _parse_bmr(latest_bmr)

    # BMI from weight + profile height
    bmi = None
    if cur_weight and profile_row and profile_row["height_cm"]:
        try:
            h_m = float(profile_row["height_cm"]) / 100.0
            bmi = round(cur_weight / (h_m * h_m), 1)
        except Exception:
            pass

    # Build series
    weight_by_date = {r["d"] if "d" in r.keys() else r["month"]: r["weight_kg"] for r in weight_rows}
    bf_by_date = {r["d"] if "d" in r.keys() else r["month"]: r["body_fat_pct"] for r in bf_rows}

    date_keys = sorted(set(list(weight_by_date.keys()) + list(bf_by_date.keys())))
    series = [
        {
            "date": dk,
            "weight_kg": round(weight_by_date[dk], 2) if dk in weight_by_date and weight_by_date[dk] else None,
            "body_fat_pct": round(bf_by_date[dk], 1) if dk in bf_by_date and bf_by_date[dk] else None,
            "bmr_kcal": None,  # BMR series not per-day in typical usage
        }
        for dk in date_keys
    ]

    return {
        "baseDate": base_date,
        "period": period,
        "current": {
            "weight_kg": round(cur_weight, 2) if cur_weight else None,
            "body_fat_pct": round(cur_bf, 1) if cur_bf else None,
            "bmi": bmi,
            "bmr_kcal": round(cur_bmr) if cur_bmr else None,
        },
        "goalWeight": round(goal_weight, 1) if goal_weight else None,
        "series": series,
    }


@app.get("/api/activity-data")
def activity_data(
    date: str | None = None,
    period: str = "week",
    _: None = Depends(require_api_key),
) -> dict[str, Any]:
    base_date = _validate_date_period(date, period)
    start_date, end_date = _date_range(base_date, period)

    EXERCISE_LABELS: dict[int, str] = {
        2: "バドミントン", 4: "ベースボール", 5: "バスケットボール",
        8: "サイクリング", 9: "エアロビクス", 14: "フットボール",
        16: "フリスビー", 17: "フットサル", 22: "ハイキング",
        23: "アイスホッケー", 24: "インラインスケート", 25: "マーシャルアーツ",
        26: "ラクロス", 29: "パドルスポーツ", 30: "パラグライダー",
        32: "ピラティス", 34: "ラグビー", 35: "ランニング",
        36: "セーリング", 37: "スキー", 38: "スノーボード",
        39: "ソフトボール", 40: "スカッシュ", 41: "スケートボード",
        42: "スキー", 44: "サッカー", 45: "ソフトボール",
        46: "スカッシュ", 47: "水泳", 48: "テーブルテニス",
        49: "テニス", 50: "トラック走", 51: "バレーボール",
        52: "歩行", 53: "水中エクササイズ", 54: "ウェイトトレーニング",
        55: "ヨガ", 56: "クロスカントリースキー", 57: "スキューバダイビング",
        58: "スノーシュー", 63: "ハンドボール", 64: "高強度インターバル",
        74: "ローラースケート", 75: "ロッククライミング", 79: "サーフィン",
        80: "スピニング", 81: "クロストレーニング",
        87: "ウォーキング", 97: "エリプティカル",
    }

    with db() as conn:
        # Steps
        if period == "year":
            steps_rows = conn.execute(
                """SELECT strftime('%Y-%m', start_time) AS d,
                          SUM(CAST(json_extract(payload_json,'$.count') AS REAL)) AS steps
                   FROM health_records WHERE type='StepsRecord' AND date(start_time) BETWEEN ? AND ?
                   GROUP BY d ORDER BY d""",
                (start_date, end_date),
            ).fetchall()
        else:
            steps_rows = conn.execute(
                """SELECT date(start_time) AS d,
                          SUM(CAST(json_extract(payload_json,'$.count') AS REAL)) AS steps
                   FROM health_records WHERE type='StepsRecord' AND date(start_time) BETWEEN ? AND ?
                   GROUP BY d ORDER BY d""",
                (start_date, end_date),
            ).fetchall()

        # Active calories
        if period == "year":
            active_cal_rows = conn.execute(
                """SELECT strftime('%Y-%m', start_time) AS d,
                          SUM(CAST(json_extract(payload_json,'$.inKilocalories') AS REAL)) AS active_kcal
                   FROM health_records WHERE type='ActiveCaloriesBurnedRecord' AND date(start_time) BETWEEN ? AND ?
                   GROUP BY d ORDER BY d""",
                (start_date, end_date),
            ).fetchall()
        else:
            active_cal_rows = conn.execute(
                """SELECT date(start_time) AS d,
                          SUM(CAST(json_extract(payload_json,'$.inKilocalories') AS REAL)) AS active_kcal
                   FROM health_records WHERE type='ActiveCaloriesBurnedRecord' AND date(start_time) BETWEEN ? AND ?
                   GROUP BY d ORDER BY d""",
                (start_date, end_date),
            ).fetchall()

        # Today's steps/calories
        today_steps_row = conn.execute(
            """SELECT SUM(CAST(json_extract(payload_json,'$.count') AS REAL)) AS steps
               FROM health_records WHERE type='StepsRecord' AND date(start_time) = ?""",
            (base_date,),
        ).fetchone()
        today_active_row = conn.execute(
            """SELECT SUM(CAST(json_extract(payload_json,'$.inKilocalories') AS REAL)) AS kcal
               FROM health_records WHERE type='ActiveCaloriesBurnedRecord' AND date(start_time) = ?""",
            (base_date,),
        ).fetchone()
        today_dist_row = conn.execute(
            """SELECT SUM(CAST(json_extract(payload_json,'$.inMeters') AS REAL)) AS meters
               FROM health_records WHERE type='DistanceRecord' AND date(start_time) = ?""",
            (base_date,),
        ).fetchone()
        today_total_row = conn.execute(
            """SELECT SUM(CAST(json_extract(payload_json,'$.inKilocalories') AS REAL)) AS kcal
               FROM health_records WHERE type='TotalCaloriesBurnedRecord' AND date(start_time) = ?""",
            (base_date,),
        ).fetchone()

        # Exercise sessions for the period (last 7 days for week, base_date for others)
        ex_start = start_date if period == "week" else base_date
        exercise_rows = conn.execute(
            """SELECT date(start_time) AS d, start_time, end_time,
                      json_extract(payload_json,'$.exerciseType') AS etype,
                      json_extract(payload_json,'$.title') AS title,
                      json_extract(payload_json,'$.totalDistance.inMeters') AS dist_m
               FROM health_records WHERE type='ExerciseSessionRecord'
               AND date(start_time) BETWEEN ? AND ?
               ORDER BY start_time DESC LIMIT 20""",
            (ex_start, base_date),
        ).fetchall()

    steps_by = {r["d"]: r["steps"] for r in steps_rows}
    active_by = {r["d"]: r["active_kcal"] for r in active_cal_rows}

    date_keys = sorted(set(list(steps_by.keys()) + list(active_by.keys())))
    series = [
        {
            "date": dk,
            "steps": int(steps_by[dk]) if dk in steps_by and steps_by[dk] else None,
            "active_kcal": round(active_by[dk]) if dk in active_by and active_by[dk] else None,
        }
        for dk in date_keys
    ]

    def _dur_min(row) -> int | None:
        try:
            from datetime import datetime as _datetime
            s = _datetime.fromisoformat(row["start_time"].replace("Z", "+00:00"))
            e = _datetime.fromisoformat(row["end_time"].replace("Z", "+00:00"))
            return int((e - s).total_seconds() / 60)
        except Exception:
            return None

    exercises = []
    for r in exercise_rows:
        etype = int(r["etype"]) if r["etype"] is not None else 0
        label = EXERCISE_LABELS.get(etype, f"エクササイズ({etype})")
        dist_km = round(float(r["dist_m"]) / 1000, 2) if r["dist_m"] else None
        exercises.append({
            "date": r["d"],
            "type": etype,
            "title": r["title"] or label,
            "duration_min": _dur_min(r),
            "distance_km": dist_km,
        })

    cur_steps = int(today_steps_row["steps"]) if today_steps_row and today_steps_row["steps"] else None
    cur_active = round(today_active_row["kcal"]) if today_active_row and today_active_row["kcal"] else None
    cur_dist = round(float(today_dist_row["meters"]) / 1000, 2) if today_dist_row and today_dist_row["meters"] else None
    cur_total = round(today_total_row["kcal"]) if today_total_row and today_total_row["kcal"] else None

    return {
        "baseDate": base_date,
        "period": period,
        "current": {
            "steps": cur_steps,
            "active_kcal": cur_active,
            "total_kcal": cur_total,
            "distance_km": cur_dist,
        },
        "series": series,
        "exercises": exercises,
    }


@app.get("/api/sleep-data")
def sleep_data(
    date: str | None = None,
    period: str = "week",
    _: None = Depends(require_api_key),
) -> dict[str, Any]:
    base_date = _validate_date_period(date, period)
    start_date, end_date = _date_range(base_date, period)

    SLEEP_STAGES = {1: "awake", 2: "sleep", 3: "out", 4: "light", 5: "deep", 6: "rem", 7: "awake"}
    SLEEP_TYPES = {"sleep", "light", "deep", "rem"}

    with db() as conn:
        sleep_rows = conn.execute(
            """SELECT date(start_time) AS d, start_time, end_time, payload_json
               FROM health_records WHERE type='SleepSessionRecord'
               AND date(start_time) BETWEEN ? AND ?
               ORDER BY start_time""",
            (start_date, end_date),
        ).fetchall()

        spo2_rows = conn.execute(
            """SELECT date(time) AS d,
                      AVG(CAST(json_extract(payload_json,'$.percentage') AS REAL)) AS avg_spo2,
                      MIN(CAST(json_extract(payload_json,'$.percentage') AS REAL)) AS min_spo2
               FROM health_records WHERE type='OxygenSaturationRecord'
               AND date(time) BETWEEN ? AND ?
               GROUP BY d""",
            (start_date, end_date),
        ).fetchall()

    # Parse sleep sessions
    from datetime import datetime as _datetime

    def _parse_session(row):
        try:
            p = json.loads(row["payload_json"])
            stages = p.get("stages") or []
            deep_min = light_min = rem_min = awake_min = 0
            for st in stages:
                stype = SLEEP_STAGES.get(st.get("stage"), "sleep")
                try:
                    s_dt = _datetime.fromisoformat(st["startTime"].replace("Z", "+00:00"))
                    e_dt = _datetime.fromisoformat(st["endTime"].replace("Z", "+00:00"))
                    mins = int((e_dt - s_dt).total_seconds() / 60)
                except Exception:
                    mins = 0
                if stype == "deep":
                    deep_min += mins
                elif stype in ("light", "sleep"):
                    light_min += mins
                elif stype == "rem":
                    rem_min += mins
                elif stype == "awake":
                    awake_min += mins

            s_dt = _datetime.fromisoformat(row["start_time"].replace("Z", "+00:00"))
            e_dt = _datetime.fromisoformat(row["end_time"].replace("Z", "+00:00"))
            total_min = int((e_dt - s_dt).total_seconds() / 60)
            if total_min <= 0:
                return None
            # If no stages, put all in light
            if deep_min + light_min + rem_min == 0:
                light_min = total_min

            from .db import LOCAL_TZ
            s_local = s_dt.astimezone(LOCAL_TZ)
            e_local = e_dt.astimezone(LOCAL_TZ)
            return {
                "date": row["d"],
                "sleep_minutes": total_min,
                "deep_min": deep_min,
                "light_min": light_min,
                "rem_min": rem_min,
                "bedtime": s_local.strftime("%H:%M"),
                "wake_time": e_local.strftime("%H:%M"),
            }
        except Exception:
            return None

    sessions = [s for r in sleep_rows if (s := _parse_session(r)) is not None]

    # Build series by date (sum per day)
    from collections import defaultdict
    day_totals: dict[str, dict] = defaultdict(lambda: {"sleep_minutes": 0, "deep_min": 0, "light_min": 0, "rem_min": 0})
    for s in sessions:
        d = s["date"]
        day_totals[d]["sleep_minutes"] += s["sleep_minutes"]
        day_totals[d]["deep_min"] += s["deep_min"]
        day_totals[d]["light_min"] += s["light_min"]
        day_totals[d]["rem_min"] += s["rem_min"]

    if period == "year":
        # Monthly averages
        monthly: dict[str, list] = defaultdict(list)
        for d, v in day_totals.items():
            month = d[:7]
            monthly[month].append(v["sleep_minutes"])
        series = [
            {"date": m, "sleep_minutes": round(sum(vals) / len(vals)) if vals else None,
             "deep_min": None, "light_min": None, "rem_min": None}
            for m, vals in sorted(monthly.items())
        ]
    else:
        series = [
            {"date": d, **{k: v[k] for k in ("sleep_minutes", "deep_min", "light_min", "rem_min")}}
            for d, v in sorted(day_totals.items())
        ]

    # Current (base_date)
    today_session = next((s for s in reversed(sessions) if s["date"] == base_date), None)
    spo2_by = {r["d"]: r for r in spo2_rows}
    today_spo2 = spo2_by.get(base_date)

    current = {
        "sleep_minutes": today_session["sleep_minutes"] if today_session else None,
        "bedtime": today_session["bedtime"] if today_session else None,
        "wake_time": today_session["wake_time"] if today_session else None,
        "avg_spo2": round(today_spo2["avg_spo2"], 1) if today_spo2 and today_spo2["avg_spo2"] else None,
        "min_spo2": round(today_spo2["min_spo2"], 1) if today_spo2 and today_spo2["min_spo2"] else None,
    }
    stages = {
        "deep_min": today_session["deep_min"] if today_session else None,
        "light_min": today_session["light_min"] if today_session else None,
        "rem_min": today_session["rem_min"] if today_session else None,
    }

    # Period summary
    all_mins = [v["sleep_minutes"] for v in day_totals.values() if v["sleep_minutes"] > 0]
    avg_sleep = round(sum(all_mins) / len(all_mins)) if all_mins else None
    goal_days = sum(1 for m in all_mins if m >= 420)  # 7 hours

    return {
        "baseDate": base_date,
        "period": period,
        "current": current,
        "stages": stages,
        "series": series,
        "periodSummary": {
            "avg_sleep_min": avg_sleep,
            "goal_days": goal_days,
        },
    }


@app.get("/api/vitals-data")
def vitals_data(
    date: str | None = None,
    period: str = "week",
    _: None = Depends(require_api_key),
) -> dict[str, Any]:
    base_date = _validate_date_period(date, period)
    start_date, end_date = _date_range(base_date, period)

    with db() as conn:
        # Blood pressure
        if period == "year":
            bp_rows = conn.execute(
                """SELECT strftime('%Y-%m', time) AS d,
                          AVG(CAST(json_extract(payload_json,'$.systolic.inMillimetersOfMercury') AS REAL)) AS systolic,
                          AVG(CAST(json_extract(payload_json,'$.diastolic.inMillimetersOfMercury') AS REAL)) AS diastolic
                   FROM health_records WHERE type='BloodPressureRecord' AND date(time) BETWEEN ? AND ?
                   GROUP BY d ORDER BY d""",
                (start_date, end_date),
            ).fetchall()
        else:
            bp_rows = conn.execute(
                """SELECT date(time) AS d,
                          AVG(CAST(json_extract(payload_json,'$.systolic.inMillimetersOfMercury') AS REAL)) AS systolic,
                          AVG(CAST(json_extract(payload_json,'$.diastolic.inMillimetersOfMercury') AS REAL)) AS diastolic
                   FROM health_records WHERE type='BloodPressureRecord' AND date(time) BETWEEN ? AND ?
                   GROUP BY d ORDER BY d""",
                (start_date, end_date),
            ).fetchall()

        # Resting HR
        if period == "year":
            hr_rows = conn.execute(
                """SELECT strftime('%Y-%m', time) AS d,
                          AVG(CAST(json_extract(payload_json,'$.beatsPerMinute') AS REAL)) AS rhr
                   FROM health_records WHERE type='RestingHeartRateRecord' AND date(time) BETWEEN ? AND ?
                   GROUP BY d ORDER BY d""",
                (start_date, end_date),
            ).fetchall()
        else:
            hr_rows = conn.execute(
                """SELECT date(time) AS d,
                          AVG(CAST(json_extract(payload_json,'$.beatsPerMinute') AS REAL)) AS rhr
                   FROM health_records WHERE type='RestingHeartRateRecord' AND date(time) BETWEEN ? AND ?
                   GROUP BY d ORDER BY d""",
                (start_date, end_date),
            ).fetchall()

        # Today's values
        today_bp = conn.execute(
            """SELECT json_extract(payload_json,'$.systolic.inMillimetersOfMercury') AS sys,
                      json_extract(payload_json,'$.diastolic.inMillimetersOfMercury') AS dia
               FROM health_records WHERE type='BloodPressureRecord' AND date(time) = ?
               ORDER BY time DESC LIMIT 1""",
            (base_date,),
        ).fetchone()

        today_hr = conn.execute(
            """SELECT json_extract(payload_json,'$.beatsPerMinute') AS bpm
               FROM health_records WHERE type='RestingHeartRateRecord' AND date(time) <= ?
               ORDER BY time DESC LIMIT 1""",
            (base_date,),
        ).fetchone()

    bp_by = {r["d"]: r for r in bp_rows}
    hr_by = {r["d"]: r["rhr"] for r in hr_rows}
    date_keys = sorted(set(list(bp_by.keys()) + list(hr_by.keys())))

    series = [
        {
            "date": dk,
            "systolic": round(bp_by[dk]["systolic"]) if dk in bp_by and bp_by[dk]["systolic"] else None,
            "diastolic": round(bp_by[dk]["diastolic"]) if dk in bp_by and bp_by[dk]["diastolic"] else None,
            "resting_hr": round(hr_by[dk]) if dk in hr_by and hr_by[dk] else None,
        }
        for dk in date_keys
    ]

    return {
        "baseDate": base_date,
        "period": period,
        "current": {
            "systolic": round(float(today_bp["sys"])) if today_bp and today_bp["sys"] else None,
            "diastolic": round(float(today_bp["dia"])) if today_bp and today_bp["dia"] else None,
            "resting_hr": round(float(today_hr["bpm"])) if today_hr and today_hr["bpm"] else None,
        },
        "series": series,
    }


@app.get("/api/home-summary")
def home_summary(
    date: str | None = None,
    _: None = Depends(require_api_key),
) -> dict[str, Any]:
    """ホーム画面専用の軽量エンドポイント。

    AI レポート（当日分）+ データ充足フラグ + 根拠データリストを返す。
    """
    import datetime as _dt3
    from .db import LOCAL_TZ

    if date is None:
        target_date = _dt3.date.today()
        date = target_date.isoformat()
    else:
        try:
            target_date = _dt3.date.fromisoformat(date)
        except ValueError as exc:
            raise HTTPException(status_code=400, detail="date は YYYY-MM-DD 形式") from exc

    prev_date = (target_date - _dt3.timedelta(days=1)).isoformat()
    next_date = (target_date + _dt3.timedelta(days=1)).isoformat()

    def _parse_iso_dt(value: Any) -> _dt3.datetime | None:
        if not isinstance(value, str) or not value:
            return None
        try:
            dt = _dt3.datetime.fromisoformat(value.replace("Z", "+00:00"))
        except ValueError:
            return None
        if dt.tzinfo is None:
            dt = dt.replace(tzinfo=_dt3.timezone.utc)
        return dt

    def _to_local_day(value: Any) -> str | None:
        dt = _parse_iso_dt(value)
        if dt is None:
            return None
        return dt.astimezone(LOCAL_TZ).date().isoformat()

    def _to_float(value: Any) -> float | None:
        if isinstance(value, bool) or value is None:
            return None
        if isinstance(value, (int, float)):
            return float(value)
        if isinstance(value, str):
            try:
                return float(value)
            except ValueError:
                return None
        return None

    def _find_number(value: Any, key_candidates: set[str], depth: int = 0) -> float | None:
        if depth > 6 or value is None:
            return None
        if isinstance(value, dict):
            for key in key_candidates:
                if key in value:
                    num = _to_float(value.get(key))
                    if num is not None:
                        return num
            for nested in value.values():
                hit = _find_number(nested, key_candidates, depth + 1)
                if hit is not None:
                    return hit
            return None
        if isinstance(value, list):
            for nested in value:
                hit = _find_number(nested, key_candidates, depth + 1)
                if hit is not None:
                    return hit
            return None
        return _to_float(value)

    def _extract_weight_kg(payload_json: str) -> float | None:
        try:
            payload = json.loads(payload_json)
        except Exception:
            return None
        return _find_number(
            payload,
            {
                "inKilograms",
                "kilograms",
                "kg",
                "weight",
                "value",
                "inGrams",
                "grams",
            },
        )

    with db() as conn:
        # ── AI レポート（当日の daily レポート）
        report_row = conn.execute(
            """SELECT content, created_at FROM ai_reports
               WHERE report_date = ? AND report_type = 'daily'
               ORDER BY created_at DESC LIMIT 1""",
            (date,),
        ).fetchone()

        # 食事データ（nutrition_events）
        meal_row = conn.execute(
            "SELECT COUNT(*) AS c FROM nutrition_events WHERE local_date = ?",
            (date,),
        ).fetchone()

        # 睡眠候補（前後1日を取得してローカル日付で絞る）
        sleep_rows = conn.execute(
            """SELECT start_time, end_time FROM health_records
               WHERE type='SleepSessionRecord'
                 AND (
                   (start_time IS NOT NULL AND date(start_time) BETWEEN ? AND ?)
                   OR
                   (end_time IS NOT NULL AND date(end_time) BETWEEN ? AND ?)
                 )
               ORDER BY COALESCE(end_time, start_time) DESC""",
            (prev_date, next_date, prev_date, next_date),
        ).fetchall()

        # 歩数候補（前後1日を取得してローカル日付で絞る）
        steps_rows = conn.execute(
            """SELECT start_time, payload_json FROM health_records
               WHERE type='StepsRecord'
                 AND start_time IS NOT NULL
                 AND date(start_time) BETWEEN ? AND ?""",
            (prev_date, next_date),
        ).fetchall()

        # 体重候補（翌日UTCまでを取得してローカル日付で絞る）
        weight_rows = conn.execute(
            """SELECT time, payload_json FROM health_records
               WHERE type='WeightRecord'
                 AND time IS NOT NULL
                 AND date(time) <= ?
               ORDER BY time DESC
               LIMIT 2000""",
            (next_date,),
        ).fetchall()

    # ── 睡眠判定（起床日のローカル日付で当日判定）
    sleep_ok = False
    sleep_label = None
    for row in sleep_rows:
        start_dt = _parse_iso_dt(row["start_time"])
        end_dt = _parse_iso_dt(row["end_time"])
        anchor_dt = end_dt or start_dt
        if anchor_dt is None:
            continue
        if anchor_dt.astimezone(LOCAL_TZ).date().isoformat() != date:
            continue
        if start_dt is None or end_dt is None or end_dt <= start_dt:
            continue
        total_min = int((end_dt - start_dt).total_seconds() / 60)
        if total_min <= 0:
            continue
        sleep_ok = True
        h, m = divmod(total_min, 60)
        sleep_label = f"{h}時間{m}分"
        break

    # ── 歩数判定（ローカル日付で合算）
    steps_val: float | None = None
    for row in steps_rows:
        if _to_local_day(row["start_time"]) != date:
            continue
        try:
            payload = json.loads(row["payload_json"])
        except Exception:
            continue
        count = _find_number(payload, {"count", "steps", "inCount"})
        if count is None or count <= 0:
            continue
        steps_val = (steps_val or 0.0) + count
    steps_ok = bool(steps_val and steps_val >= 1000)
    steps_label = f"{int(steps_val):,}歩" if steps_val else None

    # ── 体重判定（ローカル日付で <= 当日）
    weight_ok = False
    weight_label = None
    for row in weight_rows:
        local_day = _to_local_day(row["time"])
        if local_day is None or local_day > date:
            continue
        kg = _extract_weight_kg(row["payload_json"])
        if kg is None:
            continue
        # grams fallback
        if kg > 500:
            kg = kg / 1000.0
        if kg <= 0 or kg > 400:
            continue
        weight_ok = True
        weight_label = f"{float(kg):.1f}kg"
        break

    # ── 食事充足フラグ
    meal_ok = bool(meal_row and meal_row["c"] > 0)

    # ── 根拠データリスト（データがあるものだけ）
    evidences = []
    if sleep_ok and sleep_label:
        evidences.append(
            {
                "type": "sleep",
                "label": "睡眠",
                "value": sleep_label,
                "tab": "health",
                "innerTab": "sleep",
            }
        )
    if steps_ok and steps_label:
        evidences.append(
            {
                "type": "steps",
                "label": "歩数",
                "value": steps_label,
                "tab": "exercise",
            }
        )
    if weight_ok and weight_label:
        evidences.append(
            {
                "type": "weight",
                "label": "体重",
                "value": weight_label,
                "tab": "health",
                "innerTab": "composition",
            }
        )
    if meal_ok:
        evidences.append(
            {
                "type": "meal",
                "label": "食事",
                "value": f"{meal_row['c']}件",
                "tab": "meal",
            }
        )

    return {
        "date": date,
        "report": (
            {"content": report_row["content"], "created_at": report_row["created_at"]}
            if report_row
            else None
        ),
        "sufficiency": {
            "sleep": sleep_ok,
            "steps": steps_ok,
            "weight": weight_ok,
            "meal": meal_ok,
        },
        "evidences": evidences,
    }
