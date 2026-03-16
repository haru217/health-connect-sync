# マイページ設計仕様

Date: 2026-03-17
Status: CEO承認済み

## 概要

マイページは「普段使わないが、たまに必要になるもの」を置く画面。
4セクション構成: プロフィール / 目標設定 / データの状態 / AIレポート。

競合調査（Oura, WHOOP, あすけん, FiNC）を踏まえ、1人用・アカウント不要のアプリ特性に合わせた構成。

---

## セクション1: プロフィール

初回セットアップ（SetupScreen）で入力した内容を確認・編集する。

### 表示項目
- 性別（male / female / other）
- 生年月（birth_year）
- 身長（height_cm）
- 運動頻度（exercise_freq）
- 運動種目（exercise_type）
- 運動強度（exercise_intensity）

### UX
- カード形式で一覧表示（読み取り専用モード）
- カード内の「編集」ボタンでインライン編集モードに切り替え
- 各フィールドがフォーム入力に変わる
- 「保存」でAPI呼び出し、「キャンセル」で元に戻る

### API
- GET `/api/profile` — 現在値取得（既存）
- PUT `/api/profile` — 部分更新（既存）

---

## セクション2: 目標設定

「何を目指しているか」を設定する。プロフィールとは別カード。

### 表示項目
- 目標体重（goal_weight_kg）: 数値入力（kg）
- 関心レンズ: 4つのトグルスイッチ
  - ダイエット（lens_weight）
  - 血圧改善（lens_bp）
  - 睡眠改善（lens_sleep）
  - パフォーマンス（lens_performance）

### UX
- プロフィールと同じインライン編集パターン
- トグルスイッチは即時保存（タップ時にPUT送信）でもよい

### API
- PUT `/api/profile` で保存（既存フィールド: goal_weight_kg, lens_weight, lens_bp, lens_sleep, lens_performance）

---

## セクション3: データの状態

技術詳細を出さず、データが正常に届いているかを一目で確認する。

### 表示項目
- 最終同期日時: 相対表示（「3時間前」「昨日」など）
- データ充足状況: 5項目それぞれにアイコン表示
  - 体重: has_weight_data
  - 睡眠: has_sleep_data
  - 活動: has_activity_data
  - 血圧: has_vitals_data
  - 食事: 当日のnutrition_eventsの有無

### アイコン
- データあり: チェックマーク（緑）
- データなし/古い: 三角（グレー）

### UX
- 読み取り専用（編集不可）
- カード1枚にコンパクトにまとめる

### API
- GET `/api/connection-status` — 既存APIを利用
- 食事の充足は `/api/food/history?date=today` のレスポンスで判定（既存）

---

## セクション4: AIレポート

ハルが使っているAIモデルとコスト状況を確認する。

### 表示項目
- 使用モデル: モデル名を表示（例: 「Claude Haiku 4.5」）
- Gemini月額利用状況: プログレスバー + テキスト（例: 「¥320 / ¥1,000」）

### UX
- 読み取り専用
- プログレスバーは利用率で色を変える
  - 0-70%: 緑
  - 70-90%: 黄
  - 90%+: 赤

### API
- GET `/api/gemini-usage` — 既存APIを利用
- モデル名は `/api/gemini-usage` レスポンスに含めるか、別途エンドポイントを追加

### 新規API（必要な場合）
- GET `/api/ai-config` — 現在のLLMプロバイダー・モデル名を返す
  - レスポンス: `{ provider: "anthropic", model: "claude-haiku-4-5-20251001", display_name: "Claude Haiku 4.5" }`

---

## 入れないもの（YAGNI）

- アカウント管理（ログイン不要）
- 通知設定（プッシュ通知なし）
- 外部連携設定（Health Connect経由のみ、アプリ側で制御不要）
- プライバシー設定（1人用）
- テーマ/表示カスタマイズ（1パターンのみ）
- データエクスポート（需要が出てから）

---

## 画面構成

```
マイページ
├── DateNavBar（既存共通ヘッダー）
├── プロフィール カード
│   ├── 表示モード: ラベル + 値の一覧
│   └── 編集モード: フォーム入力
├── 目標設定 カード
│   ├── 目標体重: 数値入力
│   └── 関心レンズ: 4つのトグル
├── データの状態 カード
│   ├── 最終同期: 相対時刻
│   └── 5項目の充足チェック
└── AIレポート カード
    ├── 使用モデル名
    └── Gemini利用状況バー
```

---

## 既存コードとの関係

- `web-app/src/screens/MyScreen.tsx` — 現在は接続ステータスのみ。全面書き換え
- `web-app/src/screens/SetupScreen.tsx` — プロフィール入力のUI参考元
- `web-app/src/api/healthApi.ts` — fetchProfile, updateProfile が既存
- `cloudflare-api/src/handlers/profile.ts` — GET/PUT profile が既存
- `cloudflare-api/src/handlers/gemini-usage.ts` — Gemini利用状況が既存

### 新規作成が必要なもの
- `cloudflare-api/src/handlers/ai-config.ts` — AIモデル情報を返すエンドポイント（小さい）
- `web-app/src/screens/MyScreen.tsx` — 全面書き換え（4セクション構成）
