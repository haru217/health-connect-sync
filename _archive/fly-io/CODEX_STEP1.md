# Codex 実装指示書 — Step 1: Fly.io デプロイ

対象タスク: T03〜T05

---

## 前提条件（ユーザーが事前に完了すること）

以下はユーザー自身が手動で実施済みであること：

```bash
winget install Fly.io.flyctl     # flyctl インストール
flyctl auth login                 # ブラウザで Fly.io 認証
```

---

## 作業ディレクトリ

```
health-connect-sync/pc-server/   ← ここで全コマンドを実行する
```

---

## Step 1-1: Fly.io アプリ初期化

`pc-server/` ディレクトリで以下を実行する。
**既存の `fly.toml` を上書きしないよう `--no-deploy` を付けること。**

```bash
cd pc-server
flyctl launch --no-deploy
```

対話プロンプトへの回答：
- App name: `health-ai`（または好みの一意な名前）
- Region: `nrt`（Tokyo）
- すでに `fly.toml` が存在する場合は「上書きするか？」→ **No**（既存を使う）

> app 名はグローバルで一意。`health-ai` が既に使われていたら `health-ai-XXXX` など適宜変更し、
> `fly.toml` の `app = "..."` も同じ名前に合わせること。

---

## Step 1-2: 永続ボリューム作成

SQLite ファイルを保存するボリュームを作成する（1GB は無料枠内）。

```bash
flyctl volumes create health_data --size 1 --region nrt
```

---

## Step 1-3: API キーをシークレットに設定

既存の `.env` や `API_KEY` の値を Fly.io のシークレットに移行する。

```bash
flyctl secrets set API_KEY=<your-api-key-here>
```

> `.env` の API_KEY の値をそのまま使う。
> ファイルには書かない — シークレットは Fly.io に安全に保存される。

---

## Step 1-4: デプロイ

```bash
flyctl deploy
```

初回ビルドは数分かかる（Dockerイメージのビルド + プッシュ）。
エラーが出た場合は `flyctl logs` でログを確認する。

---

## Step 1-5: 動作確認

```bash
# ステータス確認（API_KEY の値を使う）
curl -H "X-Api-Key: <your-api-key>" https://health-ai.fly.dev/api/status
```

期待レスポンス:
```json
{"ok": true, "dbPath": "...", "totalRecords": 0, ...}
```

ブラウザから `https://health-ai.fly.dev` にアクセスし、Web UI が表示されることも確認する。

---

## 完了条件（T03〜T05）

- [ ] `https://health-ai.fly.dev/api/status` が `{"ok": true}` を返す
- [ ] `API_KEY` が Fly.io シークレットとして設定されている（`.env` に頼らない）
- [ ] スマホブラウザから `https://health-ai.fly.dev` にアクセスできる

---

## トラブルシューティング

| 症状 | 対処 |
|---|---|
| `flyctl deploy` がタイムアウト | `flyctl deploy --verbose` で詳細確認 |
| DB エラー（Permission denied） | ボリュームが作成されているか `flyctl volumes list` で確認 |
| APIキー認証エラー | `flyctl secrets list` でシークレット確認 |
| アプリが起動しない | `flyctl logs --app health-ai` で Python エラーを確認 |

---

## 注意事項

- Fly.io free tier では 1 VM（shared-cpu-1x、256MB）まで無料
- `auto_stop_machines = true` 設定により、アクセスがないとマシンが停止する（次アクセス時に自動起動）
- SQLite の永続ボリュームは VM 停止後も消えない
