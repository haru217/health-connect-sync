# Health AI Advisor — タスクリスト

## ステータス凡例
- 📋 未着手
- 🔄 進行中
- ✅ 完了
- ⏸ ブロック中

---

## Phase 1（完了済み）: バックエンド構築

| # | タスク | 状態 |
|---|---|---|
| P1-01 | DB テーブル追加（user_profile / ai_reports） | ✅ |
| P1-02 | profile.py 新規作成 | ✅ |
| P1-03 | reports.py 新規作成 | ✅ |
| P1-04 | prompt_gen.py 新規作成 | ✅ |
| P1-05 | models.py Pydanticモデル追加 | ✅ |
| P1-06 | main.py 9エンドポイント追加 | ✅ |
| P1-07 | ui_template.html 初版（5タブ構成） | ✅ |
| P1-08 | 食事・サプリ手入力ログ機能 | ✅ |
| P1-09 | OpenClaw ingest エンドポイント | ✅ |

---

## Phase 2: クラウド化（Fly.io）& UI リデザイン

> **方針変更（2026-02）**: Cloudflare Tunnel（PCサーバー依存）→ **Fly.io クラウド化** に切り替え。
> 詳細: `ARCHITECTURE.md` 参照。
>
> **現在の本番 URL**: `https://34.171.85.174.nip.io`
> （将来的に `health-ai` 系の名前へ変更も可）

### Fly.io デプロイ（PC独立・クラウド化）

| # | タスク | 状態 | 優先度 | 備考 |
|---|---|---|---|---|
| T01 | Dockerfile 作成（pc-server コンテナ化） | ✅ | 🔴 高 | `pc-server/Dockerfile` |
| T02 | fly.toml 設定（ポート・ボリューム） | ✅ | 🔴 高 | `pc-server/fly.toml` |
| T03 | Fly.io デプロイ & 動作確認 | ✅ | 🔴 高 | `/api/status` 200 確認済み |
| T04 | API_KEY を Fly.io シークレットに移行 | ✅ | 🔴 高 | `test12345` で設定済み |
| T05 | スマホからアクセス確認（固定URL） | ✅ | 🔴 高 | URL: https://34.171.85.174.nip.io/ui?key=test12345 |

### UI（web-app/ React アプリ → Vercel デプロイ）

> **方針変更（2026-02）**: ui_template.html ではなく web-app/（React/Vite）を UI として採用。
> デザインクオリティが高いため。Vercel（無料）にデプロイ、バックエンドは Fly.io を使用。
> 指示書: `CODEX_STEP3_WEBAPP.md`

| # | タスク | 状態 | 優先度 | 備考 |
|---|---|---|---|---|
| T06 | FastAPI に CORS 設定追加 → Fly.io 再デプロイ | ✅ | 🔴 高 | `CODEX_STEP3_WEBAPP.md` 対応済み |
| T07 | API クライアント実装（web-app/src/api/client.ts） | ✅ | 🔴 高 | T06 依存 |
| T08 | .env.example + .env.local 作成 | ✅ | 🔴 高 | T07 依存 |
| T09 | HomeScreen → /api/summary に差し替え | ✅ | 🔴 高 | T07 依存 |
| T10 | MealScreen → /api/nutrition/day + log に差し替え | ✅ | 🔴 高 | T07 依存 |
| T11 | ExerciseScreen → /api/summary に差し替え | ✅ | 🟡 中 | T07 依存 |
| T12 | HealthScreen → /api/summary に差し替え | ✅ | 🟡 中 | T07 依存 |
| T13 | AiScreen → /api/reports に差し替え | ✅ | 🟡 中 | T07 依存 |
| T14 | vercel.json 追加 + Vercel CLI でデプロイ | ✅ | 🔴 高 | Vercel 本番反映済み |

### 新 Android 同期アプリ

| # | タスク | 状態 | 優先度 | 備考 |
|---|---|---|---|---|
| T15 | Kotlin プロジェクト新規作成（android-sync/） | ✅ | 🟡 中 | |
| T16 | Health Connect 読み取り実装 | ✅ | 🟡 中 | |
| T17 | Fly.io への POST 実装（WorkManager） | ✅ | 🟡 中 | |
| T18 | 設定画面（APIキー・URL入力）実装 | ✅ | 🟡 中 | |
| T19 | APK ビルド & スマホインストール確認 | ✅ | 🟡 中 | GitHub Actions ビルド成功・APKアーティファクト生成済み |

### 動作確認

| # | タスク | 状態 | 優先度 | 備考 |
|---|---|---|---|---|
| T20 | Fly.io URL からスマホで全タブ動作確認 | ✅ | 🔴 高 | |
| T21 | Health Connect データが Fly.io に届くことを確認 | ✅ | 🔴 高 | リアルデータ表示確認済み（2026-02-23） |
| T22 | ホーム画面追加（Add to Home Screen / PWA確認） | ✅ | 🟢 低 | |

---

## 現在のブロッカー

| ブロッカー | 影響タスク | 対応者 |
|---|---|---|
| ~~GitHub Actions APK ビルド失敗~~ | ~~T19 → T21~~ | **解消済み（2026-02-22）** |

---

## 実装順序（現在地）

```
T01✅→ T02✅→ T03✅→ T04✅→ T05✅
T06✅→ T07✅→ T08✅→ T09✅→ T10✅→ T11✅→ T12✅→ T13✅→ T14✅
T15✅→ T16✅→ T17✅→ T18✅→ T19✅
T20✅→ T21✅→ T22✅
```

---

## MVP 完成の定義

1. ✅ スマホブラウザから `https://34.171.85.174.nip.io` にアクセスできる（T05）
2. ✅ 体重・歩数・睡眠がリアルデータで表示される（T21）
3. ✅ 食事ログの追加・削除ができる（T12/T13 完了）
4. ✅ AI レポートの保存・閲覧ができる（T09 完了）
5. ✅ PC が起動していなくてもアクセスできる（T03 完了）

---

## 関連ドキュメント

| ドキュメント | 内容 |
|---|---|
| `ARCHITECTURE.md` | アーキテクチャ決定記録・環境変数一覧 |
| `CODEX_STEP1.md` | Fly.io デプロイ手順（完了済み・参照用） |
| `CODEX_STEP3_WEBAPP.md` | web-app/ API統合 + Vercel デプロイ指示書（完了済み） |
| `CODEX_STEP4.md` | 新 Android 同期アプリ 指示書 |
| `IMPLEMENT.md` | Phase 1 バックエンド実装指示書 |
| `CHANGELOG.md` | 変更履歴 |

> アーカイブ済み（`_archive/pre-react-ui/`）:
> `CLOUDFLARE_TUNNEL.md` / `CODEX_STEP2.md` / `UI_REDESIGN_SPEC.md` / `UI_CHANGES.md`

---

## Decision Log (2026-02-22)
- STEP7 PNG icon replacement has been cancelled by product decision.
- Official direction: continue with SVG-based icons for navigation/UI.
- Any remaining STEP7 references should be interpreted as "PNG plan retired".

