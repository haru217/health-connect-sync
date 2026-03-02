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

## 5. アンチカオスルール

- 勝手にトップレベルのドキュメントを作らない
- 個人メモをプロジェクトの真実の源にしない
- 優先度が衝突した場合はCEOにエスカレートする
- 日本語テキストはUTF-8で保存する
- ブロックが30分超えたらハンドオフにブロッカーを書いて停止する
