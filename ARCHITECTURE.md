# Health AI Advisor — アーキテクチャ決定記録

最終更新: 2026-02

---

## MVP アーキテクチャ

```
[Android スマホ]
  ├─ Health Connect（OS内蔵）    ← 歩数・体重・睡眠・心拍を管理
  ├─ 新Android同期アプリ         ← Health Connect を読む → Fly.io へ送信
  │   （既存 android-app は使わない。Codex が新規作成）
  └─ ブラウザ（Chrome等）        ← Fly.io の URL を開く

[Fly.io（無料クラウド）]
  ├─ FastAPI（Dockerコンテナ）   ← 既存コードほぼそのまま
  │    ├─ /api/*  各種 API
  │    └─ /ui     Web UI（HTML）配信
  └─ SQLite（永続ボリューム /data/hc_sync.db）
```

**アクセス URL**: `https://health-ai.fly.dev`（app 名はデプロイ時に確定）

---

## 方針決定: Fly.io を選んだ理由

| 比較軸 | Fly.io（Path A） | Supabase（Path B） |
|---|---|---|
| 既存コード再利用 | ✅ ほぼそのまま | ✗ ほぼ書き直し |
| 実装コスト | 小（数時間） | 大（数日） |
| コスト | 無料 free tier | 無料 free tier |
| PC 依存 | なし | なし |
| 将来の移行 | ✅ Docker なのでポータブル | △ |

→ **MVP は「早く動くものを作る」が最優先**。既存 FastAPI + SQLite をそのまま Fly.io に持ち上げる。

### 廃止した方針: Cloudflare Tunnel

当初 Cloudflare Tunnel（PC をサーバーにする）を検討したが以下の理由で廃止：
- PC のスリープで切断される
- 社用 PC をサーバーにするセキュリティリスク
- PC に依存するため可用性が低い

---

## デプロイ構成

| 設定ファイル | 場所 | 内容 |
|---|---|---|
| `Dockerfile` | `pc-server/` | コンテナ定義 |
| `fly.toml` | `pc-server/` | Fly.io 設定（リージョン・ボリューム・ポート） |
| `.dockerignore` | `pc-server/` | ビルド除外ファイル |

### 環境変数

| 変数 | 値 | 設定場所 |
|---|---|---|
| `PORT` | `8080` | fly.toml [env] |
| `DB_PATH` | `/data/hc_sync.db` | fly.toml [env] |
| `DISCOVERY_ENABLED` | `false` | fly.toml [env]（UDP 探索は不要） |
| `TZ` | `Asia/Tokyo` | fly.toml [env] |
| `API_KEY` | `<secret>` | Fly.io secrets（`flyctl secrets set`） |

### 永続ボリューム

SQLite ファイルは Fly.io の永続ボリュームに保存する。
コンテナが再起動してもデータは消えない。

```
ボリューム名: health_data
マウント先:   /data
容量:         1GB（無料枠内）
```

---

## Phase ロードマップ

| Phase | 内容 | 状態 |
|---|---|---|
| **MVP** | Fly.io クラウド化 + Web UI + Android 同期アプリ | 🔄 進行中 |
| **Phase 2** | Android ネイティブアプリ本格開発（Compose UI） | 📋 未着手 |
| **Phase 3** | 自前 VPS に移行（Docker イメージをそのまま） | 📋 未着手 |
| **Phase 3** | マルチユーザー対応・JWT 認証・PostgreSQL 移行 | 📋 未着手 |
| **Phase 3** | Stripe 課金・一般リリース | 📋 未着手 |
