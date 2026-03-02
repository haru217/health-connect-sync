# Request: ユーザープロフィール保存API

- Date: 2026-03-02
- Owner: Codex-shinsekai
- Status: `todo`
- Phase: A（基盤）
- Design ref: `docs/plans/2026-03-02-health-os-design.md` §9

## Background
Health OSでは、ユーザーの基本情報・目的レンズ・運動プロフィールに基づいてスコアの重みやAIコメントをパーソナライズする。
D1にプロフィールテーブルを作成し、CRUD APIを提供する。

## Scope
- D1に `user_profiles` テーブルを作成（マイグレーション）
- `cloudflare-api/src/` にプロフィールAPIを追加

## D1スキーマ
```sql
CREATE TABLE user_profiles (
  user_id TEXT PRIMARY KEY DEFAULT 'default',
  age INTEGER,
  gender TEXT,
  height_cm REAL,
  weight_goal TEXT,         -- 'lose' | 'gain' | 'maintain' | null
  bp_goal_systolic INTEGER, -- 目標収縮期血圧 (null = 未設定)
  bp_goal_diastolic INTEGER,
  lens_weight INTEGER DEFAULT 0,     -- 0=OFF, 1=ON
  lens_bp INTEGER DEFAULT 0,
  lens_sleep INTEGER DEFAULT 0,
  lens_performance INTEGER DEFAULT 0,
  exercise_freq TEXT,       -- 'none' | 'weekly12' | 'weekly35' | 'daily'
  exercise_type TEXT,       -- 'walk' | 'gym' | 'run' | 'bodyweight' | 'none'
  exercise_intensity TEXT,  -- 'light' | 'moderate' | 'high'
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);
```

## APIエンドポイント
- `GET /api/profile` — プロフィール取得（なければデフォルト値）
- `PUT /api/profile` — プロフィール更新（部分更新可）

## Acceptance Criteria
1. D1マイグレーションが成功する
2. `GET /api/profile` がプロフィールを返す（未作成時はデフォルト値）
3. `PUT /api/profile` で部分更新ができる
4. 不正な値はバリデーションでエラーを返す
5. 既存APIに影響なし
