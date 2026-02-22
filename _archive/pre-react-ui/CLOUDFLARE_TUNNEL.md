# Cloudflare Tunnel セットアップガイド

PC server（localhost:8765）を出先のスマホから HTTPS でアクセスできるようにする。

## アーキテクチャ

```
スマホ（出先）
    ↓ HTTPS
Cloudflare Tunnel（固定URL）
    ↓ HTTP（ローカル）
PC server（localhost:8765）
    ↓
SQLite（health_records, nutrition_events, ai_reports, ...）
```

- PC 起動中ならどこからでもアクセス可能
- 既存コードは変更不要
- APIキー認証は既存の `require_api_key` をそのまま使用

---

## セットアップ手順（PC 側で一度だけ作業）

### Step 1: cloudflared インストール

```powershell
winget install Cloudflare.cloudflared
```

インストール後、ターミナルを再起動して確認：

```powershell
cloudflared --version
```

---

### Step 2: Cloudflare アカウントにログイン

```powershell
cloudflared tunnel login
```

ブラウザが開くので、Cloudflare アカウントでログイン → ドメインを選択（独自ドメインがある場合）。
認証情報が `~/.cloudflared/cert.pem` に保存される。

---

### Step 3: トンネル作成

```powershell
cloudflared tunnel create health-ai
```

出力例：
```
Tunnel credentials written to C:\Users\user\.cloudflared\<トンネルID>.json
Created tunnel health-ai with id <トンネルID>
```

→ `<トンネルID>` をメモしておく。

---

### Step 4: 設定ファイル作成

`~/.cloudflared/config.yml` を作成する：

```yaml
tunnel: <トンネルID>
credentials-file: C:\Users\user\.cloudflared\<トンネルID>.json

ingress:
  - hostname: health-ai.<あなたのドメイン>
    service: http://localhost:8765
  - service: http_status:404
```

**独自ドメインがない場合は Step 5 をスキップして `--url` オプションを使う（後述）。**

---

### Step 5: DNS ルーティング（独自ドメインがある場合）

```powershell
cloudflared tunnel route dns health-ai health-ai.<ドメイン>
```

---

### Step 6: Windows サービス登録（PC 起動時に自動起動）

```powershell
cloudflared service install
```

サービス確認：

```powershell
Get-Service -Name cloudflared
```

---

### Step 7: 起動確認

```powershell
cloudflared tunnel run health-ai
```

ブラウザまたはスマホで `https://health-ai.<ドメイン>/ui?key=<YOUR_API_KEY>` にアクセスして動作確認。

---

## 最速の試し方（ドメイン不要）

ドメインなしでもすぐに試せる。Step 4〜6 を省略して：

```powershell
cloudflared tunnel --url http://localhost:8765
```

→ 一時的なランダム URL（例: `https://xxxx.trycloudflare.com`）が発行される。

**注意**: トンネルを停止するたびに URL が変わる。本番利用には固定トンネルが必要。

---

## スマホからのアクセス方法

1. 上記で取得した URL を開く
2. クエリパラメータで API キーを渡す:
   ```
   https://health-ai.<ドメイン>/ui?key=<YOUR_API_KEY>
   ```
3. 初回アクセス後は `localStorage` に API キーが保存されるため、次回以降はキー不要

---

## トラブルシューティング

| 症状 | 原因 | 対処 |
|---|---|---|
| `cloudflared` コマンドが見つからない | インストール後にターミナル未再起動 | ターミナルを閉じて開き直す |
| 503 エラー | pc-server が起動していない | `uvicorn app.main:app --port 8765` を先に起動 |
| 接続タイムアウト | cloudflared サービスが停止 | `Start-Service cloudflared` |
| HTTPS エラー | 独自ドメインの DNS 伝播待ち | 数分〜数時間待つ |

---

## セキュリティ注意事項

- API キーは `X-Api-Key` ヘッダーで認証される（既存の `require_api_key` 依存）
- Cloudflare Tunnel 経由は HTTPS なので通信は暗号化される
- Cloudflare のアクセスログに IP が残ることに留意
- 必要に応じて Cloudflare Access（Zero Trust）で追加認証を設定可能
