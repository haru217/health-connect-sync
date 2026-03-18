# 運用ルール（Single Source of Truth）

全エージェントはこのファイルのルールに従う。

## 1. エージェント共通ルール

### 起動手順
1. `ops/START_HERE.md` を読む
2. `requests/<agent>/` でリクエストを確認する
3. 受入条件を確認してから作業を開始する

### 納品
- 成果物を `handoff/incoming/` に配置する（テンプレート: `ops/templates/handoff.md`）
- `ops/WORKLOG.md` に記録する
- スコープはリクエストの受入条件に限定する（1リクエスト = 1成果物）

## 2. Gitルール

### コミットメッセージ形式
```
<種別>(<担当>): <変更の要約>
```
種別: feat, fix, refactor, docs, test, chore, perf, ci, review

### コミットタイミング
- タスク1件 = 1コミット以上
- 動作確認が取れた時点で即コミット（未確認のまま次のタスクに進まない）
- ハンドオフを書く前にコミットを完了させる
- 複数タスクをまとめて1コミットにしない
- `.env` やシークレットをコミットしない

## 3. ダッシュボード更新ルール

### エンジニアビュー（タスク更新）
ステータスが変わったら更新する:
```powershell
.\ops\update-ceo-dashboard.ps1 -Type task -TaskId <id> -Status <todo|in_progress|blocked|done> -Actor <名前>
```

### CEOビュー（画面ステータス更新）
画面に影響する変更を完了したら更新する:
```powershell
.\ops\update-ceo-dashboard.ps1 -Type screen -Name "画面名" -Status <ok|wip|not_started> -Summary "変更内容" -Actor <名前>
```

### CEO判断依頼
CEOの判断が必要な場合は追加する（**技術用語を使わず平易な日本語で**）:
```powershell
.\ops\update-ceo-dashboard.ps1 -Type decision -Screen "画面名" -Question "質問文" -Options "選択肢1,選択肢2" -Priority <high|medium|low> -Actor <名前>
```

### 設計承認リクエスト
UI/UXの見た目を変える場合は事前に追加する:
```powershell
.\ops\update-ceo-dashboard.ps1 -Type approval -Screen "画面名" -Title "変更タイトル" -Description "変更内容" -Actor <名前>
```

## 4. CEO承認ルール

- UI/UXの見た目変更は**事前承認必須**
- 技術判断でもプロダクトに影響するものはCEO確認を取る
- 承認はダッシュボードの「設計承認待ち」セクション経由で行う
- **計画の実装着手前にCEO承認を取る**（計画→承認待ち登録→CEO承認→実装開始）

## 5. CEOビュー記載ルール（全エージェント必読）

CEOは非エンジニア。ダッシュボード・ハンドオフ・ワークログのCEO向け記述は以下を守る：

### 禁止事項
- ファイルパス・行番号を書かない（例: `HealthSyncRunner.kt:97` → NG）
- API名・メソッド名をそのまま書かない（例: `/api/sync/cursor` → NG）
- HTTP ステータスコードを説明なしで書かない（例: `HTTP_520` → NG）
- 技術的な実装詳細を羅列しない

### 書き方ルール
- **「何が変わったか」をユーザー体験で説明する**
  - ❌ `ローカルに前回同期が無い場合、/api/sync/cursor からサーバーカーソルを引いて開始位置を補正`
  - ✅ `新しいAPKを入れても、前のデータ送信履歴を引き継げるようにした。全データの再送信は起きない`
- **「で、次どうすればいいか」を明確にする**
  - ❌ `assembleRelease 成功。APK: app-release-unsigned.apk`
  - ✅ `APKのビルド完了。端末にインストールして権限を全許可すればOK`
- **リスクは影響で書く**
  - ❌ `applicationId が異なるため同期カーソルが移行されない`
  - ✅ `旧アプリとは別アプリ扱いなので、初回は同期データの再取得が必要`

### CTO（Claude）の役割
- Codexの技術アウトプットをCEO向けに翻訳してダッシュボードに反映する
- エージェントが直接ダッシュボードに書く場合もこのルールを適用する

## 6. エージェント連携ルール

### 3エージェント体制
- **Claude**（CTO）: 設計・仕様・指揮。Codex/Geminiに直接指示を出す
- **Codex**（エンジニア）: Android・バックエンド実装。MCP経由で直接指示
- **Gemini**（デザイナー）: UIデザイン・ストア素材。CLI経由で直接呼び出し

### Codex連携（MCP経由）

```
mcp__codex__codex(prompt="...", cwd="c:/Users/senta/health-connect-sync")
```

- Claudeが仕様・コンテキストを含めてプロンプトを送る
- 結果はClaudeに直接返る
- スレッドを継続する場合は `mcp__codex__codex-reply` を使う

### Gemini連携（CLI経由）

```bash
gemini -p "...プロンプト..." -y
```

- 認証: oauth-personal（r.suzuki@turning-inc.com / Google AI Pro）
- モデル: `~/.gemini/settings.json` のデフォルト `gemini-3-pro-preview`（`-m` 不要）
- 返答はすぐClaudeに届く

### ダッシュボード
- `ops/archive/CEO_DASHBOARD.html` を情報共有の中心とする
- CEOがファイルをコピペして橋渡しする運用を禁止する

### 作業フロー
```
1. Claude(CTO) がCEOと要件を詰め、仕様書を作成
2. Codex MCP / Gemini CLI に直接指示して実装・デザイン
3. UI/UX変更はCEO承認後に実装開始
4. 完了したら → ダッシュボード更新
5. 判断が必要なら → ダッシュボードに判断依頼追加
```

## 7. アンチカオスルール

- 勝手にトップレベルのドキュメントを作らない
- 個人メモをプロジェクトの真実の源にしない
- 優先度が衝突した場合はCEOにエスカレートする
- 日本語テキストはUTF-8で保存する
- ブロックが30分超えたらハンドオフにブロッカーを書いて停止する
- **CEO確認なしに実装を進めない**（計画→承認→実装の順を守る）
