# Request: 旧user_profileテーブル廃止 — user_profilesへの統合

- Date: 2026-03-02
- Owner: Codex-shinsekai
- Status: `todo`
- Phase: A（基盤）
- Priority: CRITICAL（コードレビュー指摘事項）
- Depends on: A3（完了済み）、B2（完了済み）

## Background

コードレビューで、旧`user_profile`テーブル（0001_init.sql）と新`user_profiles`テーブル（0007）が共存しており、セットアップ画面で保存した内容が既存の健康計算（BMR・栄養目標・睡眠分析など）に反映されない問題が判明した。

旧テーブルを廃止し、全参照を新テーブルに統合する。

## 現状のフィールド対応

### 旧テーブル `user_profile` (0001 + 0005)
```
id INTEGER PRIMARY KEY
name TEXT
height_cm REAL
birth_year INTEGER
sex TEXT ('male'|'female'|'other')
goal_weight_kg REAL
updated_at TEXT
sleep_goal_minutes INTEGER DEFAULT 420  -- 0005で追加
steps_goal INTEGER DEFAULT 8000         -- 0005で追加
```

### 新テーブル `user_profiles` (0007)
```
user_id TEXT PRIMARY KEY DEFAULT 'default'
age INTEGER
gender TEXT ('male'|'female'|'other')
height_cm REAL
weight_goal TEXT ('lose'|'gain'|'maintain')
bp_goal_systolic INTEGER
bp_goal_diastolic INTEGER
lens_weight INTEGER DEFAULT 0
lens_bp INTEGER DEFAULT 0
lens_sleep INTEGER DEFAULT 0
lens_performance INTEGER DEFAULT 0
exercise_freq TEXT
exercise_type TEXT
exercise_intensity TEXT
created_at TEXT
updated_at TEXT
```

### 新テーブルに不足しているフィールド
| 旧フィールド | 新テーブルに必要 | 備考 |
|---|---|---|
| `goal_weight_kg` | YES | 数値目標。`weight_goal`(enum)とは別用途 |
| `sleep_goal_minutes` | YES | 睡眠目標。デフォルト420(7時間) |
| `steps_goal` | YES | 歩数目標。デフォルト8000 |
| `birth_year` | NO | `age`で代替可能。BMR計算は`age`を使う |
| `name` | NO | 表示用。現在使われていない |

## Scope

### 1. マイグレーション追加 (0008)

`cloudflare-api/migrations/0008_unify_profiles.sql` を作成:

```sql
-- 不足カラムを追加
ALTER TABLE user_profiles ADD COLUMN goal_weight_kg REAL;
ALTER TABLE user_profiles ADD COLUMN sleep_goal_minutes INTEGER DEFAULT 420;
ALTER TABLE user_profiles ADD COLUMN steps_goal INTEGER DEFAULT 8000;

-- 旧テーブルからデータを移行（既にuser_profilesにデータがあればスキップ）
INSERT INTO user_profiles(user_id, age, gender, height_cm, goal_weight_kg, sleep_goal_minutes, steps_goal, updated_at)
SELECT
  'default',
  CASE WHEN birth_year IS NOT NULL THEN (strftime('%Y','now') - birth_year) ELSE NULL END,
  sex,
  height_cm,
  goal_weight_kg,
  sleep_goal_minutes,
  steps_goal,
  updated_at
FROM user_profile
WHERE id = 1
ON CONFLICT(user_id) DO UPDATE SET
  goal_weight_kg = COALESCE(excluded.goal_weight_kg, user_profiles.goal_weight_kg),
  sleep_goal_minutes = COALESCE(excluded.sleep_goal_minutes, user_profiles.sleep_goal_minutes),
  steps_goal = COALESCE(excluded.steps_goal, user_profiles.steps_goal),
  height_cm = COALESCE(user_profiles.height_cm, excluded.height_cm),
  gender = COALESCE(user_profiles.gender, excluded.gender),
  age = COALESCE(user_profiles.age, excluded.age);
```

### 2. TypeScript型・関数の更新

`UserProfileRow` インターフェースに追加:
```typescript
goal_weight_kg: number | null
sleep_goal_minutes: number
steps_goal: number
```

`emptyUserProfile()` にデフォルト値を追加:
```typescript
goal_weight_kg: null,
sleep_goal_minutes: 420,
steps_goal: 8000,
```

`applyUserProfilePatch()` に3フィールドのバリデーションを追加。
`upsertUserProfile()` のINSERT文に3カラムを追加。

### 3. 旧テーブル参照の書き換え（6箇所）

全て `getUserProfile(db)` を使うように統一する。`getUserProfile` は既にキャッシュ不要な軽量関数。

| 行番号 | 現在のクエリ | 変更内容 |
|--------|------------|---------|
| ~1561 | `SELECT height_cm FROM user_profile WHERE id = 1` | `getUserProfile(db)` → `.height_cm` |
| ~1777 | `SELECT sleep_goal_minutes, steps_goal FROM user_profile WHERE id = 1` | `getUserProfile(db)` → `.sleep_goal_minutes`, `.steps_goal` |
| ~2449 | `SELECT goal_weight_kg, height_cm, birth_year, sex FROM user_profile WHERE id = 1` | `getUserProfile(db)` → `.goal_weight_kg`, `.height_cm`, `.age`, `.gender` |
| ~2718 | `SELECT sleep_goal_minutes FROM user_profile WHERE id = 1` | `getUserProfile(db)` → `.sleep_goal_minutes` |
| ~3280 | `SELECT goal_weight_kg, steps_goal FROM user_profile WHERE id = 1` | `getUserProfile(db)` → `.goal_weight_kg`, `.steps_goal` |
| ~3388 | `SELECT * FROM user_profile WHERE id = 1` | `getUserProfile(db)` を使い、BMR計算で `age`(直接) と `gender`(`sex`の代わり) を使う |

**注意: 3388行目の `computeTargets` は `birth_year` → `age` の変換が必要:**
```
旧: const age = new Date().getUTCFullYear() - birthYear
新: const age = profile.age ?? 38  // デフォルト38歳
```

**注意: `sex` → `gender` の名前変更:**
旧コードで `sex` を使っている箇所を `gender` に置き換える。値は同じ（`'male'|'female'|'other'`）。

### 4. モックデータ更新

`seedMockData` 関数（~3611行）:
- 旧テーブルへのINSERTを削除（`DELETE FROM user_profile` と `INSERT INTO user_profile` を削除）
- 代わりに `user_profiles` にモックデータをINSERT:
```sql
INSERT INTO user_profiles(user_id, age, gender, height_cm, goal_weight_kg, sleep_goal_minutes, steps_goal, updated_at)
VALUES('default', 38, 'male', 172, 72, 420, 8000, ?)
ON CONFLICT(user_id) DO UPDATE SET
  age=38, gender='male', height_cm=172, goal_weight_kg=72,
  sleep_goal_minutes=420, steps_goal=8000, updated_at=excluded.updated_at
```

### 5. レビュー指摘の同時修正

以下も合わせて修正する:

**(a) リクエストサイズ制限** — `readJsonBody` 関数（~291行）:
```typescript
async function readJsonBody(request: Request, maxBytes = 65536): Promise<Record<string, unknown>> {
  const contentLength = request.headers.get('content-length')
  if (contentLength && parseInt(contentLength, 10) > maxBytes) {
    throw new Error('Request body too large')
  }
  // ... 既存処理
}
```

**(b) 未知フィールドの拒否** — `applyUserProfilePatch` の先頭:
```typescript
const ALLOWED_KEYS = new Set([
  'age', 'gender', 'height_cm', 'weight_goal',
  'bp_goal_systolic', 'bp_goal_diastolic',
  'lens_weight', 'lens_bp', 'lens_sleep', 'lens_performance',
  'exercise_freq', 'exercise_type', 'exercise_intensity',
  'goal_weight_kg', 'sleep_goal_minutes', 'steps_goal',
])
const unknownKeys = Object.keys(payload).filter(k => !ALLOWED_KEYS.has(k))
if (unknownKeys.length > 0) {
  throw new ValidationError(`Unknown fields: ${unknownKeys.join(', ')}`)
}
```

**(c) DB読み出し時のenum検証** — `sanitizeUserProfileRow` に追加。

## フロントエンド修正（B2レビュー指摘）

### `web-app/src/App.tsx` の `hasSetupData` 関数を修正:

```typescript
function hasSetupData(profile: ProfileResponse | null): boolean {
  if (!profile) return false

  const hasBasic =
    (typeof profile.age === 'number' && profile.age > 0) ||
    (profile.gender != null && profile.gender !== '') ||
    (typeof profile.height_cm === 'number' && profile.height_cm > 0)

  const hasLens =
    profile.lens_weight === 1 ||
    profile.lens_bp === 1 ||
    profile.lens_sleep === 1 ||
    profile.lens_performance === 1

  const hasExercise =
    (profile.exercise_freq != null && profile.exercise_freq !== 'none') ||
    (profile.exercise_type != null && profile.exercise_type !== 'none') ||
    (profile.exercise_intensity != null && profile.exercise_intensity !== 'moderate')

  return hasBasic || hasLens || hasExercise
}
```

### `web-app/src/api/types.ts` の `ProfileResponse` に追加:
```typescript
goal_weight_kg?: number | null
sleep_goal_minutes?: number | null
steps_goal?: number | null
```

## やらないこと
- 旧テーブルのDROP（安全のため残す。ただし書き込みは全て停止）
- `index.ts`のファイル分割（別タスクで対応）
- テスト追加（別リクエストで対応）

## Acceptance Criteria
1. `npm run check` が通る
2. 旧テーブル `user_profile` への参照がコード内にゼロ（モック含む）
3. `GET /api/profile` が `goal_weight_kg`, `sleep_goal_minutes`, `steps_goal` も返す
4. `PUT /api/profile` で上記3フィールドも更新可能
5. マイグレーション 0008 が旧データを新テーブルに移行する
6. `readJsonBody` にサイズ制限がある
7. 未知フィールドを送ると400エラー
8. 既存APIの動作が変わらない（BMR計算、栄養目標、睡眠分析が同じ結果を返す）
