# Haru Briefing Generation UI

## 概要

HomeScreenのハルブリーフィングをオンデマンド生成方式に変更する。ユーザーが明示的にボタンを押して生成を開始し、1日1回（成功時）の制限を設ける。

## 背景

現状の問題:
- レポート未生成時、ハルのアバターだけ表示され吹き出しが空になる
- フロントから自動生成を呼ぶ仕組みがない
- `date <= ?`クエリで別の日のレポートがフォールバック表示される（ユーザー混乱の原因）

ユーザー要望:
- データ同期が不十分な状態で自動生成されるとストレス
- 自分のタイミングで生成したい
- 1日1回に制限してほしい

## 状態遷移

```
[未生成] --ボタン押下--> [生成中] --成功--> [表示済み]
                                  --失敗--> [未生成] + トースト通知
```

## UI仕様

### 未生成状態

吹き出しUIの中にハルの語りかけテキストと生成ボタンを表示する。

- 吹き出しテキスト: 当日は「データを同期したら、ブリーフィングを作れるよ」、過去日は「{M月d日}のブリーフィングを作れるよ」
- ボタン: 「ブリーフィングを作る」（吹き出し内に配置）
- 当日・過去日の両方で表示する（該当日のレポートが存在しない場合）

### 生成中状態

吹き出しの中でタイピングアニメーションを表示する。

- ドット3つが点滅する演出（ハルが考えている感じ）
- ボタンは非表示
- ハルのアバター横のオンラインインジケータはそのまま
- 生成中に日付変更やタブ遷移した場合: リクエストは中断しない。戻ってきた時にsummary再取得で結果が反映される

### 表示済み状態

現状通りのブリーフィング本文を表示する。変更なし。

- 段落フェードインアニメーションも維持
- セクション見出し【】のカラー表示も維持
- ボタンは非表示（1日1回制限）

### 失敗時

- 吹き出しは未生成状態に戻る（ボタン復活）
- 画面下部にトースト通知:「ブリーフィングの生成に失敗しました」
- トーストは3秒で自動消去（フェードアウト）
- 失敗は1回制限にカウントしない（再試行可能）

## フォールバック廃止

別の日のレポートを代替表示する現行仕様を廃止する。

- 該当日のレポートがなければ未生成UIを表示
- `previousReport`フィールドは不要になる

## 1日1回制限の実装方針

バックエンド側で制御する。既存の`generateDailyReportIfNeeded`は、該当日のレポートが既に存在する場合`force`なしでは`{ generated: false, cached: true }`を返す。

- フロントは`force`パラメータを送信しない
- バックエンドの既存ロジックで自然に1日1回制限が実現される
- フロントは`summary.report`の有無でボタン表示/非表示を切り替える

追加のバックエンド実装は不要。

## データフロー

### フロントエンド

```
HomeScreen mount/日付変更
  |
  fetchHomeSummary(date)
  |
  summary.report が null?
  |-- YES --> 未生成UI（吹き出し+ボタン）
  |-- NO  --> ブリーフィング表示

ボタン押下
  |
  POST /api/report/generate { date }
  |
  |-- 成功(generated: true) --> fetchHomeSummary(date) 再取得 --> 表示済みUIへ
  |-- 失敗 --> トースト表示、ボタン復活
```

### バックエンド変更

`buildHomeSummary`のdaily_reportsクエリを変更する。

変更前:
```sql
SELECT ... FROM daily_reports WHERE date <= ? ORDER BY date DESC LIMIT 1
```

変更後:
```sql
SELECT ... FROM daily_reports WHERE date = ? LIMIT 1
```

`previousReport`サブクエリ(L131-141)とレスポンスの`previousReport`フィールド(L253-258)を削除する。

## 影響範囲

### 変更ファイル

- `cloudflare-api/src/handlers/home-summary.ts` -- reportRowクエリを`date = ?`に変更、previousReportRowクエリ削除、レスポンスからpreviousReport削除
- `web-app/src/screens/HomeScreen.tsx` -- HaruBriefingコンポーネントを別ファイルに抽出し改修（現在807行で上限超過）
- `web-app/src/components/HaruBriefing.tsx` -- 新規ファイル。HaruBriefingコンポーネント+未生成UI+タイピングアニメーション+生成ボタン
- `web-app/src/components/Toast.tsx` -- 新規ファイル。汎用トースト通知コンポーネント
- `web-app/src/api/healthApi.ts` -- `generateDailyReport(date: string)`関数を新規追加
- `web-app/src/api/types.ts` -- `HomeSummaryResponse`から`previousReport`フィールド削除

### 削除するもの

- `HomeScreen.tsx`のHaruBriefingコンポーネント（別ファイルに移動）
- `HomeScreen.tsx`のExpertSection（旧体制。使用箇所なし）
- `HomeScreen.tsx`のfallbackReportプロパティとその分岐ロジック
- `HomeScreen.tsx`のreportDate/activeDateの日付比較ロジック（フォールバック廃止により不要）
- `types.ts`のpreviousReport関連の型定義

### 変更しないもの

- `cloudflare-api/src/handlers/report.ts` -- 生成ロジックは変更なし
- AiScreen -- 独立したレポート画面なので影響なし
- 週次レポート自動生成（cron） -- 変更なし

## UI詳細

### タイピングアニメーション

```css
.typing-dots span {
  animation: blink 1.4s infinite both;
}
.typing-dots span:nth-child(2) { animation-delay: 0.2s; }
.typing-dots span:nth-child(3) { animation-delay: 0.4s; }

@keyframes blink {
  0%, 80%, 100% { opacity: 0.2; }
  40% { opacity: 1; }
}
```

### トースト通知

汎用コンポーネントとして`Toast.tsx`に実装する。

- 画面下部に固定位置（`position: fixed; bottom: 24px`）
- 背景: 赤系（`--danger-bg`）
- 3秒で自動消去（フェードアウト）
- `onDismiss`コールバックで親コンポーネントのステートをクリア

## バグ修正（同時対応）

### セクション見出しアイコンが「info」にフォールバックする問題

`sectionConfig`のキーが「からだ」「食事」等の短縮形だが、LLMが生成する見出しは「からだの様子」「食事と栄養」等の完全形。完全一致で検索しているためマッチせず、「その他」の`info`アイコンが表示される。

修正: セクション名の部分一致（`startsWith`）でマッチングするように変更する。HaruBriefingコンポーネント抽出時に修正。
