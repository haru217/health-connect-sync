# OpenClaw Nutrition Ingest Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** OpenClawに入力した食事記録を、手動操作なしで `health-connect-sync` に確実・重複なしで取り込めるようにする。

**Architecture:** 取り込み契約（payload schema）を1つに統一し、`HTTP直送` と `pendingファイル` の2経路に対応する。サーバ側は `event_id` で冪等化し、同じ食事レコードが再送されても二重計上しない。取り込み失敗はエラーファイルに退避して再処理できるようにする。

**Tech Stack:** FastAPI, SQLite, PowerShell, Python (pc-server), OpenAPI

---

### Task 1: 取り込み契約の固定化（OpenClaw側とサーバ側の共通仕様）

**Files:**
- Create: `docs/openclaw-ingest-schema.md`
- Modify: `pc-server/NUTRITION_API.md`
- Modify: `openapi-local.yaml`

**Step 1: スキーマを定義**
- `event_id` を必須にする（例: `openclaw:2026-02-18:discord:msg123:item0`）
- `local_date`、`items[]`、`intake_kcal`（任意）を定義
- 既存形式（`alias/label + macros`）との互換性を明記

**Step 2: 受け入れ条件を定義**
- `event_id` 未指定は400
- `items` 空配列は400
- `unknown alias` は400
- 同一 `event_id` は「成功扱いでスキップ（200）」にする

**Step 3: OpenAPIとドキュメント同期**
- `POST /api/openclaw/ingest` をOpenAPIに追加
- `NUTRITION_API.md` に request/response とエラー例を追記

**Step 4: Commit**
```bash
git add docs/openclaw-ingest-schema.md pc-server/NUTRITION_API.md openapi-local.yaml
git commit -m "docs: define OpenClaw ingest schema and endpoint contract"
```

---

### Task 2: 冪等取り込みのためのDB基盤を追加

**Files:**
- Modify: `pc-server/app/db.py`
- Create: `pc-server/app/openclaw_ingest.py`

**Step 1: 取り込み履歴テーブルを追加**
- `openclaw_ingest_events` を作成  
  - `event_id TEXT PRIMARY KEY`
  - `ingested_at TEXT NOT NULL`
  - `source TEXT`
  - `payload_hash TEXT`

**Step 2: 取り込みサービスを実装**
- `ingest_openclaw_payload(payload, source)` 関数を作成
- 処理順:
  1. payload validate
  2. `event_id` の存在確認
  3. 未処理なら `nutrition_log` 相当の処理を実行
  4. `intake_kcal` があれば `intake_calories_daily` をupsert
  5. `openclaw_ingest_events` に記録

**Step 3: 互換レイヤ**
- 既存 `pending/*.jsonl` 形式（`local_date + items`）は `event_id` を合成して受け入れ可能にする
  - 例: `legacy:<filename>:<line_no>:<sha1>`

**Step 4: Commit**
```bash
git add pc-server/app/db.py pc-server/app/openclaw_ingest.py
git commit -m "feat(pc-server): add idempotent OpenClaw ingest service"
```

---

### Task 3: APIエンドポイント経由でOpenClawから直接投入可能にする

**Files:**
- Modify: `pc-server/app/main.py`
- Modify: `openapi-local.yaml`

**Step 1: `POST /api/openclaw/ingest` を追加**
- `X-Api-Key` 必須
- body は Task1 スキーマ
- `ingest_openclaw_payload` を呼ぶ

**Step 2: レスポンスを統一**
- 新規登録: `{"ok": true, "ingested": 1, "duplicate": 0}`
- 重複: `{"ok": true, "ingested": 0, "duplicate": 1}`
- バリデーション失敗: 400

**Step 3: 既存APIとの整合**
- `/api/nutrition/log` と `/api/intake` の既存挙動を壊さない
- OpenClaw専用エンドポイントは薄いオーケストレーションのみにする

**Step 4: Commit**
```bash
git add pc-server/app/main.py openapi-local.yaml
git commit -m "feat(api): add /api/openclaw/ingest endpoint"
```

---

### Task 4: pendingファイル取り込みを自動化（HTTPが使えない場合のフォールバック）

**Files:**
- Modify: `pc-server/import-pending.ps1`
- Create: `pc-server/import_pending.py`
- Create: `pc-server/watch-pending.ps1`
- Modify: `pc-server/run.ps1`

**Step 1: 既存 `import-pending.ps1` の問題を修正**
- 日付固定のデフォルト（`2026-02-18.jsonl`）を廃止
- `pending/inbox/*.jsonl` を全処理する方式へ変更

**Step 2: Python importer本体**
- `import_pending.py` で以下を実装:
  - `inbox/*.jsonl` を列挙
  - 1行ずつ parse→`ingest_openclaw_payload`
  - 成功ファイルは `pending/archive/YYYY-MM-DD/` へ移動
  - 失敗行があるファイルは `pending/error/` に退避し理由を同名 `.err` へ出力

**Step 3: watchモード**
- `watch-pending.ps1` で30秒ごとに importer を呼ぶ
- `run.ps1` 起動時にオプションで watch をバックグラウンド起動可能にする

**Step 4: Commit**
```bash
git add pc-server/import-pending.ps1 pc-server/import_pending.py pc-server/watch-pending.ps1 pc-server/run.ps1
git commit -m "feat(importer): automate pending ingestion with archive/error flow"
```

---

### Task 5: OpenClaw側ハンドオフ仕様の確定

**Files:**
- Create: `docs/openclaw-handoff-runbook.md`
- Modify: `LOCAL_QUICKSTART.md`
- Modify: `TROUBLESHOOT.md`

**Step 1: OpenClaw側の送信ルールを文書化**
- 優先: `POST /api/openclaw/ingest`
- フォールバック: `pending/inbox/*.jsonl` へ追記（atomic rename）
- `event_id` の作り方（再送しても同一ID）

**Step 2: 運用ルール**
- APIキー更新時の手順
- 重複時の期待挙動（duplicate=1）
- 失敗時の再送手順（errorフォルダの再投入）

**Step 3: Commit**
```bash
git add docs/openclaw-handoff-runbook.md LOCAL_QUICKSTART.md TROUBLESHOOT.md
git commit -m "docs: add OpenClaw handoff runbook and ops guide"
```

---

### Task 6: 検証（重複しないことを証明）

**Files:**
- Create: `pc-server/tests/test_openclaw_ingest.py`
- Create: `pc-server/tests/test_pending_importer.py`
- Modify: `pc-server/requirements.txt` (or `requirements-dev.txt`)

**Step 1: 失敗テストを書く（TDD）**
- `event_id` なしで400
- 同一payload再送で `nutrition_events` 件数が増えない
- `intake_kcal` はupsert（同日再送で更新のみ）

**Step 2: 最小実装で通す**
- Task2〜4のコードでテスト通過

**Step 3: E2Eスモーク**
```powershell
cd pc-server
python import_pending.py --once
curl -H "X-Api-Key: <key>" "http://localhost:8765/api/nutrition/day?date=2026-02-18"
curl -H "X-Api-Key: <key>" "http://localhost:8765/api/summary"
```

**Step 4: Commit**
```bash
git add pc-server/tests pc-server/requirements*.txt
git commit -m "test: add idempotency and importer e2e tests"
```

---

### Task 7: ロールアウトと移行

**Files:**
- Modify: `CHANGELOG.md`
- Modify: `BUILD_FIX_PLAN.md` (if tracking remains)

**Step 1: 移行手順**
- 既存 `pending/*.jsonl` を `pending/inbox/` に移動
- 1回インポート実行
- 重複・件数チェック

**Step 2: 本番運用**
- `run.ps1` + watch有効で常時取り込み
- OpenClaw側を direct HTTP モードに切替

**Step 3: 監視項目**
- `openclaw_ingest_events` の増加
- `pending/error/` の滞留有無
- `/api/report/yesterday` 文章への反映確認

**Step 4: Commit**
```bash
git add CHANGELOG.md BUILD_FIX_PLAN.md
git commit -m "chore: document rollout for OpenClaw nutrition ingest"
```

---

## Done Definition
- OpenClaw入力後、手動実行なしで `nutrition/day` と `summary` に反映される
- 同じ食事記録を再送しても数値が増えない（冪等）
- API経路とpending経路のどちらでも同じ結果になる
- エラー時に再処理可能（error退避 + 再投入手順あり）
