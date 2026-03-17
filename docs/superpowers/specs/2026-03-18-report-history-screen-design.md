# レポート履歴画面 設計仕様

## 概要

週次/月次/カスタムレポートの履歴を一覧表示する画面を新設する。HomeScreenの各カードから「過去のXを見る」リンクで遷移する。HomeScreen下部の「過去のレポート」セクション（カスタムレポート履歴）は削除し、この画面に統合する。

## 画面構成

### ReportHistoryScreen（新規）

**ファイル:** `web-app/src/screens/ReportHistoryScreen.tsx`

**構成:**
- 上部にヘッダー（戻るボタン + タイトル「レポート履歴」）
- 3タブ: 週次 / 月次 / カスタム
- 初期表示タブはナビゲーション元で決まる（propsで受け取る）
- 各タブにレポートの一覧（日付+見出し）
- タップで既存のReportDetailScreenに遷移

**Props:**
```typescript
interface ReportHistoryScreenProps {
  initialTab: 'weekly' | 'monthly' | 'custom'
  onBack: () => void
  onViewWeeklyReport: (weekStart: string) => void
  onViewMonthlyReport: (month: string) => void
  onViewCustomReport: (id: number) => void
}
```

### 各タブのデータソース

| タブ | API | 既存 |
|---|---|---|
| 週次 | `GET /api/weekly-reports` | 既存 |
| 月次 | `GET /api/monthly-reports` | 既存（今日実装済み） |
| カスタム | `GET /api/custom-reports` | 既存 |

新しいバックエンドAPIは不要。

### 各タブの表示内容

**週次タブ:**
- 各行: 期間（YYYY-MM-DD〜YYYY-MM-DD）+ 見出し
- 既存の`fetchWeeklyReports`を使用

**月次タブ:**
- 各行: 月（YYYY年M月）+ 見出し
- 既存の`fetchMonthlyReports`を使用

**カスタムタブ:**
- 各行: テンプレート名 + 作成日時
- 既存の`fetchCustomReportsHistory`を使用

## HomeScreen変更

### 週次カードへのリンク追加

WeeklyReportCardの中に「過去の週次を見る」テキストリンクを追加する。カードの見出し下、もしくはカード外の下部に小さいリンクとして配置。

タップで`onViewWeeklyHistory`コールバックを呼ぶ。

### 月次カードへのリンク追加

MonthlyReportCardの中に「過去の月次を見る」テキストリンクを追加する。同じパターン。

タップで`onViewMonthlyHistory`コールバックを呼ぶ。

### 「もっと詳しく」セクション下部の「過去のレポート」削除

HomeScreen内のCustomReportSectionの`history`表示部分（過去のカスタムレポート5件表示）を削除する。代わりに「過去のレポートを見る」リンクを追加し、履歴画面のカスタムタブに遷移する。

## App.tsx変更

### ScreenTypeに追加

```typescript
type ScreenType = '...' | 'report-history'
```

### state追加

```typescript
const [reportHistoryTab, setReportHistoryTab] = useState<'weekly' | 'monthly' | 'custom'>('weekly')
```

### HomeScreenのprops追加

```typescript
onViewWeeklyHistory={() => {
  setReportHistoryTab('weekly')
  setCurrentScreen('report-history')
}}
onViewMonthlyHistory={() => {
  setReportHistoryTab('monthly')
  setCurrentScreen('report-history')
}}
onViewCustomHistory={() => {
  setReportHistoryTab('custom')
  setCurrentScreen('report-history')
}}
```

### switch caseに追加

```typescript
case 'report-history':
  return <ReportHistoryScreen
    initialTab={reportHistoryTab}
    onBack={() => setCurrentScreen('home')}
    onViewWeeklyReport={(weekStart) => {
      setWeeklyReportWeekStart(weekStart)
      setCurrentScreen('weekly-report-detail')
    }}
    onViewMonthlyReport={(month) => {
      setMonthlyReportMonth(month)
      setCurrentScreen('monthly-report-detail')
    }}
    onViewCustomReport={(id) => {
      setReportDetailId(id)
      setCurrentScreen('report-detail')
    }}
  />
```

## 影響範囲

### 新規ファイル
- `web-app/src/screens/ReportHistoryScreen.tsx`

### 変更ファイル
- `web-app/src/screens/HomeScreen.tsx` -- 各カードにリンク追加、カスタムレポート履歴セクション変更
- `web-app/src/App.tsx` -- report-history画面のルーティング追加

### 変更しないもの
- バックエンドAPI -- 全て既存APIを使用
- ReportDetailScreen -- 既存のまま（週次/月次/カスタムの詳細表示は対応済み）
- 日次ブリーフィング -- DateNavBarで日付移動して閲覧（履歴画面に含めない）
