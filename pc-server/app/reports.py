from __future__ import annotations

from .db import db, now_iso


def save_report(
    *,
    report_date: str,
    report_type: str,
    prompt_used: str,
    content: str,
) -> dict:
    with db() as conn:
        # Keep exactly one row per (report_date, report_type):
        # update the latest row if present, and remove older duplicates.
        existing_rows = conn.execute(
            """
            SELECT id
            FROM ai_reports
            WHERE report_date = ? AND report_type = ?
            ORDER BY created_at DESC, id DESC
            """,
            (report_date, report_type),
        ).fetchall()

        if existing_rows:
            keep_id = int(existing_rows[0]["id"])
            conn.execute(
                """
                UPDATE ai_reports
                SET prompt_used = ?, content = ?, created_at = ?
                WHERE id = ?
                """,
                (prompt_used, content, now_iso(), keep_id),
            )
            duplicate_ids = [int(row["id"]) for row in existing_rows[1:]]
            if duplicate_ids:
                placeholders = ",".join("?" for _ in duplicate_ids)
                conn.execute(
                    f"DELETE FROM ai_reports WHERE id IN ({placeholders})",
                    tuple(duplicate_ids),
                )
            report_id = keep_id
        else:
            cur = conn.execute(
                """
                INSERT INTO ai_reports(report_date, report_type, prompt_used, content, created_at)
                VALUES(?, ?, ?, ?, ?)
                """,
                (report_date, report_type, prompt_used, content, now_iso()),
            )
            report_id = int(cur.lastrowid)

    return get_report(report_id)  # type: ignore[return-value]


def list_reports(*, report_type: str | None = None, limit: int = 50) -> list[dict]:
    """content は先頭200文字のプレビューのみ返す。"""
    with db() as conn:
        if report_type:
            rows = conn.execute(
                """
                SELECT id, report_date, report_type, created_at,
                       SUBSTR(content, 1, 200) AS preview
                FROM ai_reports
                WHERE report_type = ?
                ORDER BY report_date DESC, created_at DESC
                LIMIT ?
                """,
                (report_type, limit),
            ).fetchall()
        else:
            rows = conn.execute(
                """
                SELECT id, report_date, report_type, created_at,
                       SUBSTR(content, 1, 200) AS preview
                FROM ai_reports
                ORDER BY report_date DESC, created_at DESC
                LIMIT ?
                """,
                (limit,),
            ).fetchall()
    return [dict(r) for r in rows]


def get_report(report_id: int) -> dict | None:
    with db() as conn:
        row = conn.execute(
            "SELECT * FROM ai_reports WHERE id = ?", (report_id,)
        ).fetchone()
    return dict(row) if row else None


def delete_report(report_id: int) -> bool:
    with db() as conn:
        cur = conn.execute(
            "DELETE FROM ai_reports WHERE id = ?", (report_id,)
        )
    return cur.rowcount > 0

