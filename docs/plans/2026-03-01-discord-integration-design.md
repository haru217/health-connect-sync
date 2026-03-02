# AnimaWorks Discord 統合 設計書

**日付:** 2026-03-01
**ステータス:** 承認済み
**対象:** `health-connect-sync` プロジェクト

---

## 背景・目的

`ops/CEO_DASHBOARD.html` は AI エージェント間のタスク調整を目的として作られたが、エージェントへの指示受領が機能せず、ユーザーが人力でアクションを出す状況だった。AnimaWorks の自律エージェント基盤に移行し、AI 間が自律的にやり取りする体制を構築する。ユーザーからの指示チャネルは Discord とする。

---

## ゴール

- AI エージェント（claude / codex / gemini）が AnimaWorks 内で自律的にタスクを調整・実行する
- ユーザーは Discord から claude アニマに指示を出せる
- ブロッカー発生時は claude が Discord でユーザーに escalation する
- `CEO_DASHBOARD.html` は廃止

---

## アーキテクチャ

```
ユーザー
  ↕  Discord（Bot経由）
[AnimaWorks Discord Integration]
  ↕
claude アニマ（調整役・24h 自律）
  ├─→ codex-shinsekai アニマ（バックエンド実装）
  └─→ gemini アニマ（UI/UX）
```

### 通信の原則

- **ユーザー ↔ claude:** Discord 経由
- **AI 間（claude ↔ codex ↔ gemini）:** AnimaWorks 内部メッセージング（Discord には出ない）
- **escalation:** claude が判断してユーザーに Discord 通知

---

## 実装フェーズ

### Phase 0: アニマ動作確認（先行実施）

Discord 実装前に基盤が正しく動作するか検証する。

| 確認項目 | 方法 | 期待結果 |
|----------|------|----------|
| claude アニマ応答 | `main.py chat --local claude "テスト"` | 正常応答 |
| codex-shinsekai 応答 | `main.py chat --local codex-shinsekai "テスト"` | 正常応答（✅ 確認済み） |
| gemini アニマ再有効化 | status.json 編集 + 応答テスト | 正常応答 |
| AI 間メッセージ委譲 | claude → codex へのメッセージ送信テスト | codex が受信・応答 |
| ハートビート動作 | `main.py heartbeat --local claude` | タスク確認ログ出力 |

### Phase 1: スーパーバイザー階層設定

- `claude` を supervisor として設定（codex-shinsekai・gemini の上位）
- 各アニマの role / identity を本プロジェクト用に調整
- heartbeat.md に定期タスク確認ロジックを記述
- claude の knowledge に CEO_DASHBOARD.html の現行タスク状態を注入

### Phase 2: Discord Bot 実装

#### 2-1. Discord Bot 作成
- Discord Developer Portal でアプリ作成
- Bot Token 取得
- 対象サーバー・チャンネル設定
- 必要 Intent: `message_content`、`guilds`、`guild_messages`

#### 2-2. AnimaWorks への統合実装
- `discord.py` を依存追加
- `core/integrations/discord.py` — Bot クライアント実装
  - メッセージ受信 → 指定アニマ（claude）へのルーティング
  - アニマ応答 → Discord チャンネルへの投稿
  - エラーハンドリング・再接続
- `server/routes/discord.py` — Discord Webhook 受信エンドポイント（必要に応じて）
- AnimaWorks 起動時に Discord Bot を自動起動

#### 2-3. 設定
AnimaWorks `config.json` に Discord 設定セクション追加:
```json
{
  "discord": {
    "bot_token": "...",
    "default_anima": "claude",
    "channel_mappings": {
      "general": "claude",
      "codex": "codex-shinsekai"
    },
    "notification_channel": "general"
  }
}
```

### Phase 3: 運用開始

- AnimaWorks サーバー起動を常時化（Windows サービス or タスクスケジューラ）
- `CEO_DASHBOARD.html` をアーカイブ
- 運用確認（Discord → claude → codex の一連フロー）

---

## 技術スタック追加

| 追加要素 | 詳細 |
|----------|------|
| `discord.py` | Python Discord Bot ライブラリ（v2.x） |
| Discord Bot Token | Discord Developer Portal で取得 |
| Discord Server | 既存サーバーを使用 |

---

## 非機能要件

- Discord Bot は AnimaWorks サーバーと同一プロセス（または同一起動スクリプト）で動作
- Bot がオフラインの間に届いたメッセージは再起動時に処理しない（シンプルさ優先）
- AI 間通信ログは AnimaWorks の `activity_log/` に記録

---

## 未決事項

- [ ] Discord チャンネル構成（1チャンネル vs アニマ別チャンネル）
- [ ] gemini アニマの対象モデル確認（gemini-2.5-flash の利用可否）
- [ ] AnimaWorks サーバーの常時起動方法（Windows 環境）
