# Health AI Advisor — Android UI 実装仕様書（エージェント向け）

## 概要

既存の `health-connect-sync` Androidアプリに、Health AI Advisor UIを追加する。
既存のデータ同期機能（`SyncWorker`・`HttpSyncClient`）はそのまま維持し、
**UIレイヤーのみを全面刷新**する。

---

## プロジェクト情報

| 項目 | 値 |
|---|---|
| プロジェクトパス | `C:\Users\user\health-connect-sync\android-app\` |
| パッケージ名 | `com.haru.hcsyncbridge` |
| コンパイルSDK | 34 |
| Compose BOM | `2024.09.03` |
| 言語 | Kotlin + Jetpack Compose |

### 既存ファイル（変更するもの）

| ファイル | 変更内容 |
|---|---|
| `MainActivity.kt` | `AppScreen()` を `HealthAiApp()` に置換 |
| `app/build.gradle.kts` | 依存ライブラリ追加 |

### 既存ファイル（変更しないもの）

- `hc/HealthConnectReader.kt` — Health Connect読み込み
- `hc/HealthConnectStatus.kt`
- `hc/RecordTypeRegistry.kt`
- `net/HttpSyncClient.kt` — PC サーバー通信
- `net/ServerDiscovery.kt`
- `settings/SettingsStore.kt` — DataStore設定管理
- `sync/SyncNow.kt`, `SyncWorker.kt`, `SyncScheduler.kt`
- `util/ReflectPayload.kt`

---

## 追加する依存ライブラリ（`app/build.gradle.kts`）

```kotlin
// グラフ描画
implementation("com.patrykandpatrick.vico:compose-m3:2.0.0-alpha.28")

// BottomNavigation
implementation("androidx.navigation:navigation-compose:2.8.4")

// ViewModel
implementation("androidx.lifecycle:lifecycle-viewmodel-compose:2.8.6")

// Room（食事・サプリ・AIレポートのローカルDB）
implementation("androidx.room:room-runtime:2.6.1")
implementation("androidx.room:room-ktx:2.6.1")
kapt("androidx.room:room-compiler:2.6.1")

// kapt プラグイン追加（plugins ブロック）
id("org.jetbrains.kotlin.kapt")
```

---

## デザイントークン

### カラー（`ui/theme/Color.kt` に定義）

```kotlin
val Background = Color(0xFF09132A)
val Surface = Color(0xFF152847)
val Accent = Color(0xFF33FF20)
val Good = Color(0xFF85FF9F)
val Warning = Color(0xFFFFC676)
val Danger = Color(0xFFFF90A6)
val TextMuted = Color(0xFF9FB3D8)
val TextPrimary = Color(0xFFFFFFFF)
```

### フォント

- 数値: `Lexend`（Google Fonts）
- 日本語テキスト: `M PLUS 1p`（Google Fonts）
- Compose での使用: `downloadable fonts` または `assets/fonts/` に格納

### テーマ（`ui/theme/Theme.kt`）

- ダーク固定（`darkColorScheme` のみ使用）
- `background = Background`, `surface = Surface`, `primary = Accent`

---

## ナビゲーション構造

### BottomNavigation（5タブ）

```
Home / Meal / Exercise / Health / AI
  🏠      🍽      🏃       ❤️    🤖
```

- 高さ: 64dp
- アクティブ色: `Accent (#33ff20)`
- 非アクティブ色: `TextMuted (#9fb3d8)`

### ルート定義

```kotlin
sealed class Screen(val route: String) {
    object Home : Screen("home")
    object Meal : Screen("meal")
    object Exercise : Screen("exercise")
    object Health : Screen("health")
    object AI : Screen("ai")
    object Settings : Screen("settings")
}
```

### ハンバーガーメニュー（設定）

全タブ共通ヘッダー右上に `☰` アイコン → タップで設定画面へ遷移（`NavController.navigate("settings")`）

---

## 作成するファイル一覧

```
ui/
  theme/
    Color.kt         ← カラートークン
    Theme.kt         ← DarkTheme定義
    Type.kt          ← フォント定義
  nav/
    NavGraph.kt      ← BottomNav + NavHost
  home/
    HomeScreen.kt    ← ホームタブ
    HomeViewModel.kt
  meal/
    MealScreen.kt    ← 食事タブ（サブメニュー付き）
    MealViewModel.kt
    MealAddSheet.kt  ← 追加ボトムシート
    MealEditSheet.kt ← 編集モーダル
    SupplScreen.kt   ← サプリサブタブ
    SupplViewModel.kt
    NutritionScreen.kt ← 栄養素サブタブ
  exercise/
    ExerciseScreen.kt
    ExerciseViewModel.kt
  health/
    HealthScreen.kt
    HealthViewModel.kt
    DietSubScreen.kt
    VitalSubScreen.kt
  ai/
    AiScreen.kt
    AiViewModel.kt
    ReportSaveSheet.kt
  settings/
    SettingsScreen.kt ← 既存AppScreen.ktの設定部分を移行
  common/
    AppScaffold.kt   ← 共通Scaffold（BottomNav + ヘッダー）
    MetricCard.kt    ← ホームのカードコンポーネント
    ProgressBar.kt   ← 栄養素横棒グラフ
    SectionHeader.kt ← セクション見出し

db/
  AppDatabase.kt
  MealDao.kt
  MealEntity.kt
  SupplLogDao.kt
  SupplLogEntity.kt
  AiReportDao.kt
  AiReportEntity.kt

api/
  ServerApiClient.kt  ← HttpSyncClient を拡張してGETエンドポイント追加
```

---

## 🏠 HomeScreen 実装仕様

### `HomeViewModel.kt`

```kotlin
data class HomeState(
    val weight: Float? = null,           // 最新体重 kg
    val weightMa7Delta: Float? = null,   // MA7 Δ7d
    val steps: Int? = null,              // 今日の歩数
    val stepsAvg7d: Int? = null,         // 7日平均
    val sleepHours: Float? = null,       // 昨夜の睡眠時間
    val sleepDate: String? = null,
    val calBalance: Int? = null,         // 摂取 - 消費 kcal
    val insight: String? = null,         // サーバーのinsights[0]
    val restingHr: Int? = null,          // 安静時心拍 bpm
    val spo2: Float? = null,             // SpO2 %
    val isLoading: Boolean = false,
)
```

サーバーAPIエンドポイント（`GET /api/summary`）からデータ取得。
Health Connect からも直接読み込み可能だが、MVPではサーバーAPIを優先。

### カード6枚のデザイン

```
┌─────────────────────────────────┐
│ ⚖️ 体重                         │
│   83.2 kg                       │
│   MA7: → -0.21 kg/7d            │
└─────────────────────────────────┘
```

- 背景: `Surface (#152847)`
- 角丸: 16dp
- パディング: 16dp
- 数値フォント: Lexend 28sp
- ラベルフォント: M PLUS 1p 12sp TextMuted
- カロリー収支の文字色: `calBalance < -100` → Danger, `calBalance > 100` → Good, else Warning

---

## 🍽 MealScreen 実装仕様

### サブタブ構成

`TabRow` で「食事ログ」「サプリ」「栄養素」の3タブを切り替え

### 食事ログ

#### `MealEntity.kt`（Room）

```kotlin
@Entity(tableName = "meals")
data class MealEntity(
    @PrimaryKey(autoGenerate = true) val id: Long = 0,
    val date: String,        // "2026-02-22"
    val timing: String,      // "breakfast" | "lunch" | "dinner" | "snack"
    val name: String,
    val kcal: Int,
    val protein: Float = 0f,
    val fat: Float = 0f,
    val carbs: Float = 0f,
)
```

#### タイミングラベル（日本語表示）

| timing | 表示 |
|---|---|
| breakfast | 朝食 |
| lunch | 昼食 |
| dinner | 夕食 |
| snack | 間食 |

#### リスト表示

- 日付セレクター（`DatePickerDialog` または `<` `>` ボタン）
- タイミングごとにグループ化してセクション表示
- 各行: `[×] 食品名 ... kcal P g F g C g`
  - `×` は `IconButton` （12dp, 目立たない色）→ 即削除
  - 行の `×` 以外をタップ → `MealEditSheet`（BottomSheet）
- 各グループ末尾: `+ 追加` 行 → `MealAddSheet`

#### `MealAddSheet.kt`（ModalBottomSheet）

```
食品名: [TextInput]
タイミング: [DropdownMenu: 朝食/昼食/夕食/間食]
kcal: [NumberInput]
タンパク質(g): [NumberInput] （任意）
脂質(g): [NumberInput] （任意）
炭水化物(g): [NumberInput] （任意）
[保存する] ボタン
```

#### `MealEditSheet.kt`（ModalBottomSheet）

追加フォームと同じ項目 + 最下部に赤い「削除する」テキストリンク

---

### サプリサブタブ

#### `SupplLogEntity.kt`（Room）

```kotlin
@Entity(tableName = "suppl_logs")
data class SupplLogEntity(
    @PrimaryKey val id: String,  // "suppl名_date" など
    val date: String,
    val supplName: String,
    val checkedAt: Long,         // epoch ms
)
```

サプリマスタは `settings` に JSON文字列として保存（初期はハードコード一覧）

#### 表示

```
✅ ZAVAS MILK PROTEIN ...     ← チェック済み（行背景 #1a3a1a、緑系）
⬜ Nature Made マルチビタミン  [チェック]
```

- チェック済み: グリーン系背景ハイライト + チェックマークアイコン
- 未チェック: 右端に「チェック」ボタン → タップでSupplLog追加

---

### 栄養素サブタブ

#### データソース

サーバー `GET /api/nutrition?date=2026-02-22` または Roomのmeals集計

#### 横棒グラフコンポーネント（`ProgressBar.kt`）

```kotlin
@Composable
fun NutritionBar(
    label: String,
    current: Float,
    target: Float,
    unit: String,
)
```

- 棒の色: 目標比に応じて Accent(緑) / Warning(黄) / Danger(赤)
- 右端に達成率インジケーター（絵文字 or 色ドット）

#### アコーディオン展開

「詳細を見る ∨」タップで `AnimatedVisibility` でビタミン各種・ミネラル各種を展開

---

## 🏃 ExerciseScreen 実装仕様

### データソース

- `GET /api/activity/weekly` または `GET /api/activity/monthly`
- Health Connect から直接読み込みも可

### レイアウト

```
[週間] [月間] ← SegmentedButtonRow または TabRow

── サマリー ──
平均歩数 / 合計距離 / 消費カロリー（3列グリッド）

── グラフ ──
歩数（棒グラフ: BarChart via vico）
距離（棒グラフ）
消費カロリー（折れ線: LineChart via vico）
```

### Vicoグラフ設定

```kotlin
// vicoを使う場合の基本パターン
rememberCartesianChartModelProducer()
BarCartesianLayer(...)
CartesianChartHost(...)
```

グラフ色: Accent (`#33FF20`)、背景: Surface

---

## ❤️ HealthScreen 実装仕様

### サブタブ: ダイエット

```
── サマリー ──
現在 / 目標 / 残り（3列）
トレンドテキスト

── グラフ ──
体重折れ線（30日 + MA7点線）
体脂肪率折れ線
```

### サブタブ: バイタル

```
── サマリー ──
安静時心拍 / 血圧 / SpO2 / 睡眠（2×2 グリッド）

── グラフ ──
安静時心拍（折れ線 14日）
睡眠時間（棒グラフ 14日）
血圧（上下2線グラフ）
```

---

## 🤖 AiScreen 実装仕様

### `AiReportEntity.kt`（Room）

```kotlin
@Entity(tableName = "ai_reports")
data class AiReportEntity(
    @PrimaryKey val id: String,   // UUID
    val date: String,             // "2026-02-22"
    val reportType: String,       // "daily" | "weekly" | "monthly"
    val doctorComment: String,
    val trainerComment: String,
    val nutritionistComment: String,
    val fullText: String,         // Markdown全文
    val createdAt: Long,
)
```

### レポート解析ロジック

LLMが返すレポートのフォーマット（プロンプトで指定する形式）:

```
<!--DOCTOR-->
医師のコメント（2-3文）
<!--TRAINER-->
トレーナーのコメント（2-3文）
<!--NUTRITIONIST-->
栄養士のコメント（2-3文）
<!--END-->
（以下、全文Markdown）
```

アプリ側でこのタグを regex で抽出して3カードに表示

### レイアウト

```
[日次] [週次] [月次] ← TabRow

── エージェントコメント ──
┌──────────────────┐
│ 🩺 医師           │
│ コメントテキスト  │
└──────────────────┘
（同様に トレーナー / 栄養士）

── 詳細レポート ──
Markdownテキスト表示（Textコンポーネントで簡易レンダリング）

[+ 新しいレポートを保存] ← FloatingActionButton または OutlinedButton
```

### ReportSaveSheet.kt（ModalBottomSheet）

```
日付: [自動: 今日]
種別: [日次 ▼]
─────────────────
[TextField: レポートを貼り付け... multiline]

[保存する]
```

保存時: タグを regex 解析 → `AiReportEntity` に保存

---

## ⚙️ SettingsScreen 実装仕様

既存 `AppScreen.kt` の内容をここに移行。

### セクション

```
── プロフィール ──
名前 / 身長(cm) / 生年 / 性別 / 目標体重(kg)

── サーバー接続 ──
（既存AppScreen.ktの内容: URL入力・APIキー・Discover・Test）

── Health Connect ──
（既存AppScreen.ktの内容: 権限確認・同期実行）
```

---

## AppScaffold（共通 Scaffold）

```kotlin
@Composable
fun AppScaffold(
    navController: NavHostController,
    currentRoute: String?,
    onSettingsClick: () -> Unit,
    content: @Composable (PaddingValues) -> Unit,
) {
    Scaffold(
        topBar = { AppTopBar(onSettingsClick) },
        bottomBar = { AppBottomNav(navController, currentRoute) },
        containerColor = Background,
    ) { paddingValues ->
        content(paddingValues)
    }
}
```

---

## データフロー（MVP）

```
Health Connect ──→ SyncWorker ──→ PC Server (SQLite)
                                       ↓
                              GET /api/summary
                              GET /api/nutrition
                              GET /api/activity/weekly
                                       ↓
                              各ViewModel (StateFlow)
                                       ↓
                              各Screen (Compose UI)

Room DB（ローカル）:
  MealEntity    ← MealScreen の入力
  SupplLogEntity ← サプリタブ
  AiReportEntity ← AIレポート貼り付け保存
```

---

## 実装手順（推奨順序）

1. **テーマ設定**: `Color.kt`, `Theme.kt`, `Type.kt`
2. **DBセットアップ**: `AppDatabase.kt`, エンティティ, DAOs
3. **ナビゲーション**: `NavGraph.kt`, `AppScaffold.kt`
4. **MainActivity更新**: `AppScreen()` → `HealthAiApp()`
5. **SettingsScreen**: 既存 `AppScreen.kt` の内容を移行
6. **HomeScreen**: カード6枚 + `HomeViewModel`（サーバーAPI呼び出し）
7. **MealScreen**: ログ + サプリ + 栄養素の3サブタブ
8. **ExerciseScreen**: Vicoグラフ
9. **HealthScreen**: ダイエット + バイタルの2サブタブ
10. **AiScreen**: レポート表示 + 保存BottomSheet

---

## PCサーバーAPIエンドポイント（参照用）

既存 `openapi-local.yaml` を参照。主要なもの:

- `GET /api/summary` — ホームカードのデータ全般
- `GET /api/nutrition?date=YYYY-MM-DD` — 栄養素データ
- `GET /api/activity?period=weekly|monthly` — 運動データ

`ServerApiClient.kt` に上記エンドポイントのメソッドを追加すること。

---

## 注意事項

- **`!!` は使わない**（Kotlin null safety を活かす）
- **`runBlocking` はテスト以外で使わない**（`viewModelScope.launch`を使う）
- グラフデータが空の場合は「データなし」を柔らかく表示（グラフ非表示にしない）
- 削除は即時（確認ダイアログなし）
- ボタンは極力減らし、カード・行タップでアクションを完結させる
- `@Composable` 関数は `PascalCase`、プレビュー関数は `@Preview` を必ず付ける
