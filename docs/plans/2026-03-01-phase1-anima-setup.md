# Phase 1: アニマ設定・プロジェクト知識注入 Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** claude / codex-shinsekai の各アニマに health-connect-sync プロジェクトのコンテキストを注入し、自律的にタスク調整できる状態にする。

**Architecture:** 既存の identity.md / injection.md に準拠しつつ、knowledge/ ディレクトリとプロジェクト固有の injection セクションを追加する。スーパーバイザー階層は設定済み（変更不要）。

**Tech Stack:** Markdown ファイル編集のみ（コード変更なし）

---

### Task 1: claude の injection.md にプロジェクトコンテキストを追加

**Files:**
- Modify: `C:\Users\senta\.animaworks\animas\claude\injection.md`

**追加する内容（既存の末尾に追記）:**

```markdown
## 担当プロジェクト: health-connect-sync

このAnimaWorksチームが取り組むメインプロジェクト。

- **目標**: Android アプリ正式リリース（目標: 2026-03-20）
- **私の役割**: 全体調整・ブロッカー管理・CEO（senta）へのエスカレーション
- **部下**: codex-shinsekai（バックエンド実装）、gemini（UI/UX）
- **詳細**: `knowledge/health_connect_sync.md` を参照

### エスカレーションルール
CEO（senta）への確認が必要な判断:
- 技術的トレードオフの最終決定
- フェーズ移行の承認
- リリース Go/No-Go 判断

### タスク委譲ルール
- バックエンド実装タスク → codex-shinsekai に委譲
- UI/UX タスク → gemini に委譲
- 委譲後は進捗を定期確認し、ブロッカーを吸い上げる
```

**確認手順:**

```bash
cat "C:\Users\senta\.animaworks\animas\claude\injection.md"
```

Expected: 既存の内容 + 上記セクションが末尾に追加されている

---

### Task 2: claude の knowledge にプロジェクト状態を注入

**Files:**
- Create: `C:\Users\senta\.animaworks\animas\claude\knowledge\health_connect_sync.md`

**ファイル内容:**

```markdown
# health-connect-sync プロジェクト状態

最終更新: 2026-03-01（CEO_DASHBOARD.html より移行）

## プロジェクト概要
- **目標**: Android アプリ正式リリース
- **リリース目標日**: 2026-03-20（Go/No-Go: P3-2-3）
- **現在フェーズ**: Phase 1（イテレーション実装中）

## 担当アサイン
| アニマ | 担当領域 |
|--------|----------|
| codex-shinsekai | バックエンド実装（I1-I5、Phase 1 API） |
| gemini | UI/UX実装（I1-I5 画面改善） |
| claude（私） | 全体調整・ブロッカー管理 |

## 現在の進行タスク
| ID | 内容 | 担当 | 状態 |
|----|------|------|------|
| I1-CODEX | ホーム画面データ表示修正 | codex-shinsekai | in_progress |
| I1-GEMINI | ホーム画面UI改善 | gemini | in_progress |
| I2-CODEX | コンディション画面データ安定化 | codex-shinsekai | in_progress |
| I2-GEMINI | コンディションタブ改善 | gemini | in_progress |

## CEO 判断待ちブロッカー（優先度順）

### 高優先
1. **I2-CODEX**: APIエラー時にモックデータで続けるか、エラー表示するか？
2. **P1-1-4**: I5完了後に着手か、並行作業か？ハイライトポイントの定義は？データソース（pc-server vs cloudflare-api）はどちら？
3. **P1-1-5**: 日付処理・エラー表示・HTMLタグ削除・APIエンドポイント対応・AIレポート入力の5点

### 中優先
4. **P1-2-2**: 同期ステータスの表示場所・粒度・再同期ボタンの要否
5. **P1-2-3**: 旧サーバー凍結の定義・トリガー条件・フォールバック動作

### 後続フェーズ
6. **P2-1-1**: 3つのコアKPI定義（DAU・7日リテンション・同期成功率）
7. **P2-2-2**: インシデント閾値・レビュー頻度・ストレージ方針
8. **P3-2-1**: データ開示・暗号化ポリシー・Cloudflare データプロセッサー扱い
9. **P3-2-3**: Go/No-Go基準・ロールアウト戦略・目標日確定

## 次のアクション（claude として）
1. codex-shinsekai に I1-CODEX の進捗を確認
2. I2-CODEX ブロッカーを CEO（senta）にエスカレーション
3. P1-1-5 の5点質問を整理して CEO に一括確認
```

**確認手順:**

```bash
cat "C:\Users\senta\.animaworks\animas\claude\knowledge\health_connect_sync.md"
```

---

### Task 3: claude の heartbeat.md をプロジェクト用に更新

**Files:**
- Modify: `C:\Users\senta\.animaworks\animas\claude\heartbeat.md`

**既存ファイルを以下に置き換える:**

```markdown
# Heartbeat: claude

## 活動時間
24時間（JST）

## 現在時刻
システムプロンプトの `現在時刻` フィールドの値を使うこと。履歴やスケジュールから推測しない。

## チェックリスト

### 1. Inbox確認
- 未読メッセージがあれば確認・返信する
- codex-shinsekai / gemini からの報告・質問を処理する

### 2. health-connect-sync プロジェクト確認
- `knowledge/health_connect_sync.md` を参照して現状を把握する
- 進行中タスク（I1-I4）の最近の activity_log を確認する
- 新しいブロッカーが発生していないか確認する

### 3. エスカレーション判断
- CEO判断待ちブロッカーが蓄積している場合、send_message で senta に報告する
- 報告は1日1回まで（同じ内容の繰り返し通知はしない）

### 4. 委譲・フォローアップ
- codex-shinsekai に未着手のタスクがあれば委譲する
- 1日以上更新がないタスクは進捗確認メッセージを送る

## 通知ルール
- 緊急ブロッカー（リリース影響あり）は即時通知
- 通常の進捗報告は1日1回まとめて
- 何も問題なければ何もしない（HEARTBEAT_OK）
```

**確認手順:**

```bash
cat "C:\Users\senta\.animaworks\animas\claude\heartbeat.md"
```

---

### Task 4: codex-shinsekai の injection.md にプロジェクトコンテキストを追加

**Files:**
- Modify: `C:\Users\senta\.animaworks\animas\codex-shinsekai\injection.md`

**追加する内容（既存の末尾に追記）:**

```markdown
## 担当プロジェクト: health-connect-sync バックエンド

- **目標**: Android アプリ正式リリース（目標: 2026-03-20）
- **私の役割**: バックエンド実装・API開発・データ安定化
- **上位**: claude（タスク委譲・進捗確認を行う）
- **実装対象リポジトリ**: `C:\Users\senta\health-connect-sync\`

### 担当タスク（優先度順）
1. I1-CODEX: ホーム画面データ表示修正（in_progress）
2. I2-CODEX: コンディション画面データ安定化（in_progress、ブロッカーあり）
3. I3-CODEX 〜 I5-CODEX: 順次着手
4. P1系タスク: I5完了後に着手（claude の指示を待つ）

### 報告ルール
- タスク完了時は claude に report で送信
- ブロッカー発生時は即時 claude に escalation
- 実装前に `C:\Users\senta\health-connect-sync\` の関連コードを必ず確認する
```

**確認手順:**

```bash
cat "C:\Users\senta\.animaworks\animas\codex-shinsekai\injection.md"
```

---

### Task 5: 動作確認

**Step 1: claude がプロジェクト知識を認識しているか確認**

```bash
cd C:\Users\senta\health-connect-sync\animaworks
.venv\Scripts\python.exe main.py chat --local claude "health-connect-syncプロジェクトの現状とブロッカーを教えて"
```

Expected: knowledge/health_connect_sync.md の内容を参照した応答（ブロッカーリスト・タスク状態を把握している）

**Step 2: codex-shinsekai が役割を認識しているか確認**

```bash
.venv\Scripts\python.exe main.py chat --local codex-shinsekai "あなたの担当タスクを教えて"
```

Expected: I1-CODEX / I2-CODEX などのタスクを把握した応答

**Step 3: claude から codex-shinsekai へのタスク委譲確認**

```bash
.venv\Scripts\python.exe main.py chat --local claude "I1-CODEXの進捗をcodex-shinsekaiに確認して"
```

Expected: claude が codex-shinsekai にメッセージを送信する

全 Step が通れば Phase 1 完了 → Phase 2（Discord Bot 実装）へ進む。
