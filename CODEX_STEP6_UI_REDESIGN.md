# Codex 実装指示書 — Step 6: UI 全画面リデザイン

対象: `web-app/src/screens/` 全5画面 + バックエンド `/api/summary` 拡張

---

## 基本方針

- カラーパレット・フォント（M PLUS 1p / Lexend）は **現行を完全踏襲**
- recharts は既存のまま使用
- 新しく取得できるようになった Health Connect データ（体脂肪・血圧・SpO₂・BMR・距離等）を全画面に反映
- 3専門家（フィジカルトレーナー・管理栄養士・医師）が必要とする指標を網羅

---

## 0. バックエンド拡張（先に実施）

`pc-server/app/summary.py` の `build_summary()` が返す JSON に以下フィールドを追加する。
既存フィールドは削除しない。

```python
# 追加するフィールド（health_records テーブルから取得）
{
  # 体組成
  "bodyFatByDate": [{"date": "2026-02-22", "percentage": 18.4}],
  "heightM": 1.70,                  # 最新身長（メートル）
  "bmrByDate": [{"date": "2026-02-22", "kcalPerDay": 1680}],

  # 循環器
  "bloodPressureByDate": [
    {"date": "2026-02-22", "systolic": 118, "diastolic": 76}
  ],
  "restingHeartRateByDate": [{"date": "2026-02-22", "bpm": 58}],
  "oxygenSaturationByDate": [{"date": "2026-02-22", "percentage": 98}],

  # アクティビティ（既存の steps に加えて）
  "distanceByDate": [{"date": "2026-02-22", "meters": 6200}],
  "activeCalByDate": [{"date": "2026-02-22", "kcal": 412}],
  "totalCalByDate": [{"date": "2026-02-22", "kcal": 2340}],

  # エクササイズセッション
  "exerciseSessions": [
    {
      "date": "2026-02-22",
      "exerciseType": 56,
      "title": "ウォーキング",
      "durationMinutes": 45,
      "startTime": "2026-02-22T08:30:00Z"
    }
  ]
}
```

取得方法:
- 各 type の health_records を SELECT し、既存の weight 処理と同じパターンで実装
- `bodyFatByDate`: `type='BodyFatRecord'`, payload キー `percentage`
- `heightM`: `type='HeightRecord'`, payload キー `height`（最新1件のみ）
- `bmrByDate`: `type='BasalMetabolicRateRecord'`, payload キー `kcalPerDay`
- `bloodPressureByDate`: `type='BloodPressureRecord'`, payload キー `systolic`, `diastolic`
- `restingHeartRateByDate`: `type='RestingHeartRateRecord'`, payload キー `beatsPerMinute`
- `oxygenSaturationByDate`: `type='OxygenSaturationRecord'`, payload キー `percentage`
- `distanceByDate`: `type='DistanceRecord'`, payload キー `distance`（日次合算）
- `activeCalByDate`: `type='ActiveCaloriesBurnedRecord'`, payload キー `energy`（日次合算）
- `totalCalByDate`: `type='TotalCaloriesBurnedRecord'`, payload キー `energy`（日次合算）
- `exerciseSessions`: `type='ExerciseSessionRecord'`、直近30件

バックエンド変更後 `flyctl deploy`（pc-server/ で実行）

---

## 1. HomeScreen リデザイン

### 現在
AI一言 + 体重・歩数・睡眠・カロリー収支の4カード

### 変更後

```
┌─ ヘッダー（今日の日付） ──────────────────┐

┌─ AI 一言アドバイス ─────────────────────┐
│  （insights[0] そのまま）                │
└──────────────────────────────────────────┘

┌─ 今日のアクティビティ ──────────────────┐
│  歩数          距離         活動カロリー  │
│  8,240歩       6.2km        412kcal      │
│  （目標プログレスバー 歩数のみ）          │
└──────────────────────────────────────────┘

┌─ カロリー収支 ──────────────────────────┐
│  摂取  2,100 kcal                        │
│  消費  2,340 kcal  （総消費カロリー）     │
│  収支  -240 kcal   ████████░░  減量中    │
└──────────────────────────────────────────┘

┌─ バイタル（直近値）────────────────────┐
│  体重          体脂肪       BMI          │
│  71.2 kg      18.4 %      22.1 標準     │
│                                          │
│  安静時心拍    血圧          SpO₂        │
│  58 bpm       118/76      98 %          │
│               正常                       │
└──────────────────────────────────────────┘

┌─ 睡眠 ─────────────────────────────────┐
│  昨夜 7h12m  ████████░░  良好           │
└──────────────────────────────────────────┘
```

### 実装メモ
- BMI = `latest_weight_kg / (heightM * heightM)`、heightM が null なら非表示
- 血圧リスク判定:
  - 正常: systolic < 120 AND diastolic < 80 → 緑
  - 注意: systolic 120-139 OR diastolic 80-89 → 黄
  - 要確認: systolic >= 140 OR diastolic >= 90 → 赤
- カロリー収支の「消費」は `totalCalByDate` 直近値を使用
- データがない項目は `--` 表示（エラーにしない）

---

## 2. ExerciseScreen リデザイン

### 変更後

タブ: **[今日] [週間] [月間]**（現行は週間/月間のみ → 今日タブ追加）

#### 今日タブ（新規）

```
┌─ アクティビティサマリー ───────────────┐
│  歩数 8,240    距離 6.2km             │
│  活動カロリー 412kcal                  │
│  総消費カロリー 2,340kcal              │
│  平均速度 4.8 km/h                    │
└──────────────────────────────────────┘

┌─ エクササイズ履歴 ─────────────────────┐
│  🏃 ウォーキング   45分   08:30        │
│  🚴 サイクリング   30分   18:00        │
│  （データなし時: 「記録されたエクササイズはありません」）
└──────────────────────────────────────┘
```

#### 週間タブ（既存を拡張）

```
サマリーカード3枚:
  平均歩数 / 合計距離 / 平均活動カロリー

グラフ1: 歩数棒グラフ（7日）         ← 既存
グラフ2: 消費カロリー折れ線（7日）   ← 既存
グラフ3: 距離棒グラフ（7日）         ← 新規追加
```

#### 月間タブ（既存を拡張）

週間と同じ構成で30日表示

### 実装メモ
- エクササイズ種別アイコンは exerciseType の数値で簡易マッピング
  （例: 56→ウォーキング🚶, 54→ランニング🏃, 8→サイクリング🚴、それ以外→🏋️）
- `exerciseSessions` から当日分をフィルタリング（date で比較）
- 速度: `distanceByDate` 今日の距離(m) ÷ 歩数から推定 or SpeedRecord の avg

---

## 3. HealthScreen リデザイン（最大変更）

### タブ変更

現行: [ダイエット] [バイタル]
変更後: **[体組成] [循環器] [睡眠]**

---

#### 体組成タブ

```
┌─ 体重・体脂肪トレンド（折れ線2軸）────┐
│  左軸: 体重(kg)  右軸: 体脂肪(%)      │
│  期間: [2週] [1ヶ月] [3ヶ月]          │
└──────────────────────────────────────┘

┌─ 現在値 ───────────────────────────────┐
│  体重      目標体重    残り             │
│  71.2 kg   68.0 kg    -3.2 kg         │
│                                        │
│  体脂肪    BMI         BMR             │
│  18.4 %   22.1 標準   1,680 kcal/日   │
│  標準範囲                               │
│  (男性: 10-20% 女性: 18-28%)           │
└──────────────────────────────────────┘

┌─ 変化速度 ─────────────────────────────┐
│  体重変化: -0.3 kg/週 （減量ペース良好）│
│  体脂肪変化: -0.1 %/週               │
└──────────────────────────────────────┘
```

---

#### 循環器タブ

```
┌─ 血圧トレンド（折れ線2軸）────────────┐
│  収縮期（赤）・拡張期（青）            │
│  参考ライン: 120 / 80 点線            │
│  期間: [2週] [1ヶ月]                  │
└──────────────────────────────────────┘

┌─ 最新値 ───────────────────────────────┐
│  血圧: 118 / 76 mmHg                  │
│  ● 正常（収縮期 < 120 かつ 拡張期 < 80）│
└──────────────────────────────────────┘

┌─ 安静時心拍トレンド（折れ線）──────────┐
│  最新: 58 bpm（優秀: < 60）            │
│  参考: 60-100 正常範囲                 │
└──────────────────────────────────────┘

┌─ その他指標 ───────────────────────────┐
│  SpO₂: 98 %   ● 正常（95% 以上）      │
└──────────────────────────────────────┘
```

---

#### 睡眠タブ

```
┌─ 睡眠時間グラフ（棒グラフ）────────────┐
│  7日間の睡眠時間                        │
│  目標ライン: 7h 点線                   │
└──────────────────────────────────────┘

┌─ 今週のサマリー ───────────────────────┐
│  平均睡眠: 7h 08m                      │
│  目標達成: 5 / 7 日                    │
│  最長: 7h 52m  最短: 5h 30m           │
└──────────────────────────────────────┘
```

### 実装メモ
- 期間切り替えは `weightByDate` / `bodyFatByDate` / `bloodPressureByDate` 等を `.slice(-14)` / `.slice(-30)` / `.slice(-90)` でフィルタ
- BMI の判定基準:
  - < 18.5: 低体重（黄）
  - 18.5-24.9: 標準（緑）
  - 25.0-29.9: 過体重（黄）
  - >= 30: 肥満（赤）
- 体脂肪の判定（男性基準）:
  - < 10%: 低（黄）, 10-20%: 標準（緑）, 20-25%: やや高（黄）, > 25%: 高（赤）
  - 女性（プロフィール gender 参照）: < 18%: 低, 18-28%: 標準, 28-33%: やや高, > 33%: 高
- 変化速度: `weightByDate` の最新7件の最初と最後の差 ÷ 日数 × 7

---

## 4. MealScreen 変更（最小限）

既存の3タブ（食事ログ・サプリメント・栄養素）は維持。
以下だけ追加:

#### 食事ログタブ 上部にカロリー収支カードを追加

```
┌─ 今日のカロリー収支 ─────────────────┐
│  摂取  2,100 kcal                     │
│  消費  2,340 kcal  （Health Connect） │
│  収支  -240 kcal  ████████░░  減量中  │
└─────────────────────────────────────┘
```

- 消費カロリーは `totalCalByDate` の今日の値を `fetchSummary()` から取得
- 既存の食事ログ・サプリ・栄養素タブのコードは変更不要

---

## 5. AiScreen 変更なし

現行のまま。

---

## 実装順序

1. バックエンド `summary.py` 拡張 + `flyctl deploy`
2. HomeScreen
3. ExerciseScreen
4. HealthScreen（最大変更）
5. MealScreen（カロリー収支カード追加のみ）
6. `npm run build` でエラーゼロ確認
7. `vercel --prod` でデプロイ

---

## 完了条件

- [ ] `npm run build` エラーゼロ
- [ ] HomeScreen: バイタル6項目（体重・体脂肪・BMI・安静時心拍・血圧・SpO₂）表示
- [ ] ExerciseScreen: 今日タブ追加・距離グラフ追加
- [ ] HealthScreen: 3タブ（体組成・循環器・睡眠）にリニューアル
- [ ] MealScreen: カロリー収支カード追加
- [ ] データがない項目は `--` 表示でクラッシュしない
- [ ] Vercel デプロイ完了・スマホで動作確認

---

## 注意事項

- TypeScript 型定義は `SummaryResponse` インターフェースに新フィールドを追加すること（optional `?` で定義）
- `null` / `undefined` チェックを必ず入れる（Health Connect にデータがないユーザーでもクラッシュしない）
- 既存の `fetchSummary()` を使い回す。新しい API クライアント関数は不要
- カラーパレット・フォントは `index.css` の CSS 変数をそのまま使用

---

## 追加仕様（UI細部）

### 数値フォーマット

- **体重は小数点1桁固定**: `(71.234567).toFixed(1)` → `"71.2"`
- 体脂肪・BMI も小数点1桁: `.toFixed(1)`
- 歩数・カロリーは整数: `Math.round()`

### グラフ表示

**Tooltip（吹き出し）を廃止し、タップ/クリックでバーをハイライト表示に変更**

```tsx
// recharts の Tooltip を使わず、activeIndex で制御する
const [activeIndex, setActiveIndex] = useState<number | null>(null);

<Bar
  dataKey="value"
  onClick={(_, index) => setActiveIndex(index)}
  cell={data.map((_, index) => (
    <Cell
      key={index}
      fill={index === activeIndex ? 'var(--accent-color)' : 'rgba(136,212,180,0.4)'}
    />
  ))}
/>

// ハイライトされたバーの値をグラフ上部に大きく表示
{activeIndex !== null && (
  <div className="chart-selected-value">
    {data[activeIndex].label}: {data[activeIndex].value.toLocaleString()}
  </div>
)}
```

- `<Tooltip />` コンポーネントは全グラフから削除する
- タップで選択 → 選択バー/点がハイライト色（`--accent-color`）に変化
- 選択値はグラフの上または下に大きく表示
- 折れ線グラフも同様（`activeDot` をカスタムし、選択点を強調）

### 平均値の計算

**記録されている日のみを対象にする（null・未記録日を除外）**

```ts
// ❌ 悪い例（空白を含む）
const avg = data.reduce((sum, d) => sum + (d.value ?? 0), 0) / data.length;

// ✅ 正しい例（記録日のみ）
const recorded = data.filter(d => d.value != null);
const avg = recorded.length > 0
  ? recorded.reduce((sum, d) => sum + d.value!, 0) / recorded.length
  : null;
```

- 週間平均・月間平均のサマリーカードは全てこの方式を使用
- 記録が0件の場合は `--` 表示

### 体重グラフのスケール修正

- Y軸の domain を `['auto', 'auto']` ではなく、データ範囲の ±2kg に固定
  ```tsx
  const min = Math.floor(Math.min(...weights) - 1);
  const max = Math.ceil(Math.max(...weights) + 1);
  <YAxis domain={[min, max]} />
  ```
- これにより体重の微小な変動がグラフで視認できるようになる
> [!IMPORTANT]
> 2026-02-23時点で Fly.io は本プロジェクトの現行運用では使用していません（本文中の Fly.io 記載は過去の実装ログ・移行履歴・アーカイブ情報です）。
