# Codex 実装指示書 — Step 3: web-app/ API 統合 + Vercel デプロイ準備

---

## 現状

`web-app/` の各画面は全てモックデータ（ハードコード）で動いている。
これを Fly.io バックエンド（`https://user-purple-hill-1159.fly.dev`）の実 API に差し替える。

---

## やること一覧

1. FastAPI に CORS 設定を追加する
2. `web-app/` に API クライアントを実装する（環境変数 `VITE_API_URL` ベース）
3. 各画面のモックデータを実 API に差し替える
4. Vercel デプロイ用の設定ファイルを追加する

---

## 1. FastAPI CORS 設定（pc-server/app/main.py）

Vercel（`https://xxx.vercel.app`）からのリクエストをブラウザが許可するように CORS を設定する。

`main.py` の `app = FastAPI(...)` の直後に追加：

```python
from fastapi.middleware.cors import CORSMiddleware

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],   # Vercel URL確定後に絞る
    allow_methods=["*"],
    allow_headers=["*"],
)
```

追加後は `flyctl deploy`（`pc-server/` ディレクトリで実行）でバックエンドを再デプロイする。

---

## 2. API クライアント実装（web-app/src/api/client.ts を新規作成）

```typescript
const BASE_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:8765';
const API_KEY  = import.meta.env.VITE_API_KEY  ?? '';

export async function apiFetch<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      'X-Api-Key': API_KEY,
      ...options?.headers,
    },
  });
  if (!res.ok) throw new Error(`API error: ${res.status}`);
  return res.json() as Promise<T>;
}
```

---

## 3. 環境変数ファイルを作成

### web-app/.env.example（Git にコミットする）

```
VITE_API_URL=https://user-purple-hill-1159.fly.dev
VITE_API_KEY=your-api-key-here
```

### web-app/.env.local（Git にコミットしない・ローカル開発用）

```
VITE_API_URL=https://user-purple-hill-1159.fly.dev
VITE_API_KEY=test12345
```

`.gitignore` に `.env.local` が含まれていることを確認する。

---

## 4. 各画面の API 差し替え

### 参照する API エンドポイント

| 画面 | 使う API | レスポンスの主要フィールド |
|---|---|---|
| HomeScreen | `GET /api/summary` | steps, weight, sleep, calories |
| MealScreen | `GET /api/nutrition/day?date=YYYY-MM-DD` | events[], totals |
| MealScreen | `POST /api/nutrition/log` | ok |
| MealScreen | `DELETE /api/nutrition/log/{id}` | ok |
| ExerciseScreen | `GET /api/summary` | steps, active_calories 等 |
| HealthScreen | `GET /api/summary` | weight_kg, heart_rate 等 |
| AiScreen | `GET /api/reports?report_type=daily` | reports[] |
| AiScreen | `POST /api/reports` | id |

### `/api/summary` レスポンス構造（参考）

```typescript
interface Summary {
  today: {
    steps: number;
    active_calories: number;
    distance_m: number;
  };
  week: {
    avg_steps: number;
    total_distance_m: number;
    avg_sleep_minutes: number;
  };
  latest_weight_kg: number | null;
  latest_heart_rate: number | null;
  // その他フィールドは実際のレスポンスに合わせること
}
```

> 実際のフィールド名は `curl -H "X-Api-Key: test12345" https://user-purple-hill-1159.fly.dev/api/summary` で確認すること

### 各画面の実装方針

- `useEffect` + `apiFetch` で画面マウント時にデータ取得
- ローディング中は骨格表示（スケルトン or「読み込み中...」）
- エラー時はメッセージ表示
- モックデータは全て削除する

---

## 5. Vercel デプロイ（CLI で実施）

### 5-1. vercel.json（新規作成）

```json
{
  "rewrites": [
    { "source": "/(.*)", "destination": "/" }
  ]
}
```

### 5-2. Vercel CLI でデプロイ

```bash
# web-app/ ディレクトリで実行
cd web-app

# 初回: Vercel にログイン（ブラウザが開くので承認する）
npx vercel login

# プロジェクト設定 + デプロイ
npx vercel --prod
```

対話プロンプトへの回答：
- Set up and deploy? → `Y`
- Which scope? → アカウント名を選択
- Link to existing project? → `N`（新規作成）
- Project name? → `health-ai` など任意
- In which directory is your code located? → `./`（web-app/ 内で実行しているのでそのまま）
- Want to modify settings? → `N`

### 5-3. 環境変数を Vercel に設定

```bash
# API URL
npx vercel env add VITE_API_URL production
# 入力値: https://user-purple-hill-1159.fly.dev

# API KEY
npx vercel env add VITE_API_KEY production
# 入力値: test12345
```

### 5-4. 環境変数を反映して再デプロイ

```bash
npx vercel --prod
```

デプロイ完了後、表示された URL（例: `https://health-ai.vercel.app`）でアクセスできる。

---

## 完了条件

- [ ] `web-app/.env.local` で `npm run dev` → 実データが表示される
- [ ] HomeScreen: 今日の歩数・体重・睡眠が実データで表示される
- [ ] MealScreen: 今日の食事ログが表示・追加・削除できる
- [ ] ExerciseScreen: 週間歩数グラフが実データで表示される
- [ ] HealthScreen: 体重・心拍のグラフが実データで表示される
- [ ] AiScreen: 保存済みレポートの一覧が表示される
- [ ] `npm run build` がエラーなく完了する
- [ ] `https://health-ai.vercel.app`（またはデプロイ先URL）でスマホからアクセスできる

---

## 注意事項

- `VITE_API_KEY` をソースコードにハードコードしない（必ず環境変数経由）
- `/api/summary` の実レスポンスを `curl` で確認してから型定義を書くこと
- TypeScript エラーは `npm run build` で確認し、全て解消すること
- Vercel ログイン時にブラウザが開いたら、既存アカウント（kokomaru3@gmail.com と同じアカウント）で承認する
