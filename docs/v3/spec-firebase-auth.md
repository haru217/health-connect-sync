# 仕様: Firebase Auth マルチユーザー対応

**ステータス**: CEO承認待ち
**担当**: Codex
**影響範囲**: cloudflare-api（全ハンドラー）, android-sync

## 背景

現在は静的APIキー認証 + `user_id = 'default'` のシングルユーザー構成。
アプリを販売するにはマルチユーザー対応が必須。

### 現状

| 項目 | 状態 |
|------|------|
| 認証方式 | `X-Api-Key` ヘッダーで静的キー |
| ユーザーID | `PROFILE_USER_ID = 'default'` 固定 |
| データ分離 | なし（全クエリがグローバル） |
| Firebase SDK | 未導入（API/Android両方） |

## 方針

Firebase Authentication を使い、Cloudflare WorkersでIDトークンを検証する。

```
Android App
  ↓ Firebase Auth SDK（ログイン）
  ↓ IDトークン取得
  ↓ Authorization: Bearer <token>
Cloudflare Workers
  ↓ トークン検証（Firebase公開鍵で署名確認）
  ↓ user_id（Firebase UID）を抽出
  ↓ 全クエリに WHERE user_id = ? を追加
```

## Phase 1: 認証基盤（Week 1）

### 1-1. DBマイグレーション: users テーブル作成

```sql
CREATE TABLE IF NOT EXISTS users (
  uid TEXT PRIMARY KEY,         -- Firebase UID
  email TEXT,
  display_name TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  last_login_at TEXT
);
```

### 1-2. 既存テーブルに user_id カラム追加

対象テーブル:
- `health_records` — user_id TEXT DEFAULT 'default'
- `daily_metrics` — user_id TEXT DEFAULT 'default'
- `nutrition_events` — user_id TEXT DEFAULT 'default'
- `food_items` — user_id TEXT DEFAULT 'default'
- `daily_reports` — user_id TEXT DEFAULT 'default'
- `weekly_reports` — user_id TEXT DEFAULT 'default'
- `monthly_reports` — user_id TEXT DEFAULT 'default'
- `custom_reports` — user_id TEXT DEFAULT 'default'

```sql
-- 例: nutrition_events
ALTER TABLE nutrition_events ADD COLUMN user_id TEXT DEFAULT 'default';
CREATE INDEX idx_nutrition_events_user_date ON nutrition_events(user_id, local_date);
```

DEFAULT 'default' にすることで既存データとの互換性を維持。

### 1-3. Cloudflare Worker: トークン検証ミドルウェア

Firebase IDトークンはJWTなので、公開鍵で検証できる。

```typescript
// auth.ts（新規）
interface AuthContext {
  uid: string
  email: string | null
}

export async function verifyFirebaseToken(
  authHeader: string | null,
  env: Env,
): Promise<AuthContext | null> {
  if (!authHeader?.startsWith('Bearer ')) return null
  const token = authHeader.slice(7)
  // Firebase公開鍵を取得（キャッシュ付き）
  // JWTデコード → 署名検証 → uid/email抽出
  // ...
}
```

**実装選択肢**:
- A) `jose` ライブラリ（軽量、Workers互換）← 推奨
- B) Google公開鍵を直接フェッチして手動検証

### 1-4. index.ts: リクエストごとにユーザーコンテキスト注入

```typescript
// 現在
if (!isAuthorized(request, env)) return jsonResponse({...}, 401)

// 変更後
const auth = await verifyFirebaseToken(request.headers.get('Authorization'), env)
if (!auth) return jsonResponse({ detail: 'Unauthorized' }, 401)
// auth.uid を各ハンドラーに渡す
```

**後方互換**: 開発中は `X-Api-Key` も引き続き受け付ける（uid='default'扱い）

### 1-5. 全ハンドラー: user_id フィルタ追加

```typescript
// Before
SELECT * FROM nutrition_events WHERE local_date = ?

// After
SELECT * FROM nutrition_events WHERE user_id = ? AND local_date = ?
```

対象ハンドラー（要変更）:
- `handlers/profile.ts` — getUserProfile, updateUserProfile
- `handlers/report.ts` — 全レポート生成・取得
- `handlers/food.ts` — analyze, confirm, search, history, delete, update
- `handlers/nutrition.ts` — getNutritionDay
- `handlers/nutrition-log.ts` — log, delete
- `handlers/sync.ts` — health_records 同期
- `handlers/reports.ts` — custom_reports

## Phase 2: Android認証UI（Week 1-2）

### 2-1. Firebase Auth SDK 導入

```kotlin
// build.gradle.kts
implementation(platform("com.google.firebase:firebase-bom:33.x.x"))
implementation("com.google.firebase:firebase-auth")
```

### 2-2. ログイン画面

```
┌─────────────────────────────────┐
│         Health OS               │
│        🌱 はる                   │
│                                 │
│  [Googleでログイン]              │ ← 推奨（1タップ）
│                                 │
│  [メールアドレスでログイン]       │ ← 補助
└─────────────────────────────────┘
```

認証方法:
- **Google Sign-In**（推奨、ワンタップ）
- **メール+パスワード**（補助）

### 2-3. SyncApiClient にトークン付与

```kotlin
// 現在
.addHeader("X-Api-Key", apiKey)

// 変更後
val user = FirebaseAuth.getInstance().currentUser
val token = user?.getIdToken(false)?.await()?.token
request.addHeader("Authorization", "Bearer $token")
```

### 2-4. トークンリフレッシュ

Firebase IDトークンは1時間で失効。
`getIdToken(true)` で自動リフレッシュ。
401レスポンス時にリトライする仕組みをSyncApiClientに追加。

## Phase 3: オンボーディング（Week 3）

```
初回起動
  → ログイン画面
  → プロフィール入力（身長・体重・生年月日・性別）
  → Health Connect権限許可
  → ホームタブへ
```

## セキュリティ考慮

- トークン検証は毎リクエスト実施（Firebase公開鍵はKVにキャッシュ、1時間TTL）
- user_id は必ずトークンから取得（クライアント送信値を信用しない）
- 既存の `X-Api-Key` 認証はv1.0リリース後に廃止予定
- D1クエリは全て user_id をパラメータ化（SQLインジェクション防止）

## テスト

- 未認証リクエスト → 401
- 他ユーザーのデータにアクセスできないこと
- トークン失効 → リフレッシュ → リトライ成功
- 新規ユーザー登録 → users テーブルにレコード作成
- 既存データ（user_id='default'）がCEOアカウントに紐付くこと

## マイグレーション戦略

1. マイグレーション実行: 全テーブルに `user_id DEFAULT 'default'` 追加
2. API更新: トークン検証 + user_idフィルタ
3. Android更新: Firebase Auth SDK + ログイン画面
4. CEOアカウント紐付: 初回ログイン時に `user_id='default'` のデータをFirebase UIDに移行
