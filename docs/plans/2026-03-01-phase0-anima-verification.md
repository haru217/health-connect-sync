# Phase 0: アニマ動作確認 Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Discord 統合の前に、claude / codex-shinsekai / gemini の各アニマが正常動作し、AI 間メッセージング・ハートビートが機能することを確認する。

**Architecture:** AnimaWorks の `--local` モードで各アニマを直接起動して検証する。サーバー不要。

**Tech Stack:** AnimaWorks (`animaworks/.venv/Scripts/python.exe main.py`)

---

### Task 1: claude アニマ応答確認

**Files:**
- 変更なし（read-only 確認）

**Step 1: claude にチャット送信**

```bash
cd C:\Users\senta\health-connect-sync\animaworks
.venv\Scripts\python.exe main.py chat --local claude "テスト: 今日の日付と自分の名前を教えて"
```

Expected: 応答あり（エラーなし、`[Codex SDK Error` や `[Error` で始まらない）

**Step 2: 結果確認**

- `run_cycle END` ログが出ること
- `response_len` が 0 でないこと
- 実際の応答テキストが出力されること

問題があれば確認:
```bash
.venv\Scripts\python.exe main.py config list 2>&1 | grep "anthropic"
```
`credentials.anthropic_shinsekai.api_key` に値があるか確認。

---

### Task 2: gemini アニマ有効化・応答確認

**Files:**
- Modify: `C:\Users\senta\.animaworks\animas\gemini\status.json`

**Step 1: gemini を有効化**

`C:\Users\senta\.animaworks\animas\gemini\status.json` を編集:

```json
{
  "enabled": true,
  "model": "gemini/gemini-2.5-flash",
  "credential": "gemini_oauth"
}
```

※ `gemini_free` → `gemini_oauth` に変更（GCloud ADC 認証を使用）

**Step 2: gemini に応答確認**

```bash
cd C:\Users\senta\health-connect-sync\animaworks
.venv\Scripts\python.exe main.py chat --local gemini "テスト: 今日の日付と自分の名前を教えて"
```

Expected: 応答あり

問題があれば gcloud 認証を確認:
```bash
cat "C:\Users\senta\AppData\Roaming\gcloud\application_default_credentials.json" | python3 -c "import json,sys; d=json.load(sys.stdin); print(d.get('type'), d.get('client_id','')[:20])"
```

---

### Task 3: AI 間メッセージ委譲確認（claude → codex-shinsekai）

**Files:**
- 変更なし

**Step 1: claude から codex-shinsekai にメッセージ送信**

```bash
cd C:\Users\senta\health-connect-sync\animaworks
.venv\Scripts\python.exe main.py send claude codex-shinsekai "テスト委譲: 今日の日付を確認して報告して" --intent delegation
```

Expected: エラーなく送信完了

**Step 2: codex-shinsekai の inbox を確認**

```bash
.venv\Scripts\python.exe main.py chat --local codex-shinsekai "受信トレイに何か届いている？"
```

Expected: claude からのメッセージを認識した応答

**Step 3: codex-shinsekai から claude に返信**

```bash
.venv\Scripts\python.exe main.py send codex-shinsekai claude "報告: 今日は2026年3月1日です" --intent report
```

Expected: エラーなく送信完了

---

### Task 4: claude ハートビート動作確認

**Files:**
- 確認: `C:\Users\senta\.animaworks\animas\claude\heartbeat.md`

**Step 1: heartbeat.md の内容確認**

`C:\Users\senta\.animaworks\animas\claude\heartbeat.md` を確認。
存在しない or 空の場合は以下を作成:

```markdown
# Heartbeat Instructions

定期的に以下を確認する:
- 進行中のタスクに更新があるか
- 自分宛てのメッセージに未返信はないか
- ブロッカーがあれば人間（senta）に報告する
```

**Step 2: claude のハートビートを実行**

```bash
cd C:\Users\senta\health-connect-sync\animaworks
.venv\Scripts\python.exe main.py heartbeat --local claude
```

Expected:
- `run_cycle END` ログ出力
- エラーなし
- heartbeat.md の指示に基づいた何らかの応答

---

### Task 5: 結果まとめ

各タスクの結果を以下の表に記録して Phase 1 に進む判断材料とする:

| アニマ | 応答 | メモ |
|--------|------|------|
| claude | ✅/❌ | |
| codex-shinsekai | ✅（確認済み） | |
| gemini | ✅/❌ | |
| AI間メッセージ | ✅/❌ | |
| ハートビート | ✅/❌ | |

全項目 ✅ になったら Phase 1（スーパーバイザー階層設定）へ進む。
