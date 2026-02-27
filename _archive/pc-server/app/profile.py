from __future__ import annotations

from .db import db, now_iso


def get_profile() -> dict:
    """id=1 のプロフィールを返す。未設定時はゴール初期値を返す。"""
    with db() as conn:
        row = conn.execute(
            "SELECT * FROM user_profile WHERE id = 1"
        ).fetchone()
    if row is None:
        return {
            "sleep_goal_minutes": 420,
            "steps_goal": 8000,
        }
    profile = dict(row)
    if profile.get("sleep_goal_minutes") is None:
        profile["sleep_goal_minutes"] = 420
    if profile.get("steps_goal") is None:
        profile["steps_goal"] = 8000
    return profile


def upsert_profile(**kwargs) -> dict:
    """プロフィールを部分更新。渡されなかったキーは既存値を保持。"""
    params = {
        "name": kwargs.get("name"),
        "height_cm": kwargs.get("height_cm"),
        "birth_year": kwargs.get("birth_year"),
        "sex": kwargs.get("sex"),
        "goal_weight_kg": kwargs.get("goal_weight_kg"),
        "sleep_goal_minutes": kwargs.get("sleep_goal_minutes"),
        "steps_goal": kwargs.get("steps_goal"),
        "updated_at": now_iso(),
    }

    with db() as conn:
        conn.execute(
            """
            INSERT INTO user_profile(
              id, name, height_cm, birth_year, sex, goal_weight_kg, sleep_goal_minutes, steps_goal, updated_at
            )
            VALUES(
              1, :name, :height_cm, :birth_year, :sex, :goal_weight_kg,
              COALESCE(:sleep_goal_minutes, 420), COALESCE(:steps_goal, 8000), :updated_at
            )
            ON CONFLICT(id) DO UPDATE SET
              name=COALESCE(:name, name),
              height_cm=COALESCE(:height_cm, height_cm),
              birth_year=COALESCE(:birth_year, birth_year),
              sex=COALESCE(:sex, sex),
              goal_weight_kg=COALESCE(:goal_weight_kg, goal_weight_kg),
              sleep_goal_minutes=COALESCE(:sleep_goal_minutes, sleep_goal_minutes),
              steps_goal=COALESCE(:steps_goal, steps_goal),
              updated_at=excluded.updated_at
            """,
            params,
        )

    return get_profile()  # type: ignore[return-value]

