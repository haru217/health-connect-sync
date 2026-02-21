from __future__ import annotations

from .db import db, now_iso


def get_profile() -> dict | None:
    """id=1 のプロフィールを返す。未設定なら None。"""
    with db() as conn:
        row = conn.execute(
            "SELECT * FROM user_profile WHERE id = 1"
        ).fetchone()
    if row is None:
        return None
    return dict(row)


def upsert_profile(**kwargs) -> dict:
    """プロフィールを部分更新。渡されなかったキーは既存値を保持。"""
    current = get_profile() or {}
    fields = ["name", "height_cm", "birth_year", "sex", "goal_weight_kg"]
    merged = {f: kwargs.get(f, current.get(f)) for f in fields}
    merged["updated_at"] = now_iso()

    with db() as conn:
        conn.execute(
            """
            INSERT INTO user_profile(id, name, height_cm, birth_year, sex, goal_weight_kg, updated_at)
            VALUES(1, :name, :height_cm, :birth_year, :sex, :goal_weight_kg, :updated_at)
            ON CONFLICT(id) DO UPDATE SET
              name=excluded.name,
              height_cm=excluded.height_cm,
              birth_year=excluded.birth_year,
              sex=excluded.sex,
              goal_weight_kg=excluded.goal_weight_kg,
              updated_at=excluded.updated_at
            """,
            merged,
        )

    return get_profile()  # type: ignore[return-value]

