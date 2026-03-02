# Request: 3専門家アバター画像の作成

- Date: 2026-03-02
- Owner: Gemini
- Status: `todo`
- Phase: B（ホーム画面）
- Design ref: `docs/plans/2026-03-02-health-os-design.md` §7
- CEO承認: D-010 承認済み

## Background
Health OSのAIレポートに登場する3人の専門家キャラクターのアバター画像が必要。
日本のヘルスケアアプリで使用する想定。親しみやすく信頼感のあるデザイン。

## キャラクター仕様

### 1. ユウ先生（悠）— 医師・男性
- 穏やかで安心感がある
- 30代後半〜40代前半
- 白衣は着ない（カジュアルだが清潔感のある服装）
- 優しい目元、落ち着いた表情

### 2. サキさん（咲）— 管理栄養士・女性
- 明るくて親しみやすい
- 20代後半〜30代前半
- エプロンや食材は持たない（シンプルなポートレート）
- 笑顔、温かみのある雰囲気

### 3. マイコーチ（舞）— トレーナー・女性
- ポジティブで励まし上手
- 20代後半〜30代前半
- スポーティだが過度にマッチョではない
- 元気な表情、やる気を引き出す雰囲気

## デザイン要件
- **スタイル**: フラットイラスト / セミリアル（写真ではない）
- **参考**: 日本のヘルスケアアプリ（あすけん、FiNC、dヘルスケア等）のキャラクターデザイン
- **サイズ**: 円形アバター用（正方形、顔中心のクロップ）
- **背景**: 透明または単色（アプリ側で制御）
- **トーン**: 清潔感・信頼感・親しみやすさ。医療っぽすぎない
- **絵文字**: 使わない（アプリ全体のUI原則）
- **色味**: 落ち着いたパステル系。キャラごとに異なるアクセントカラー推奨
  - ユウ先生: 青〜緑系（安心・信頼）
  - サキさん: オレンジ〜ピンク系（温かみ・食）
  - マイコーチ: 黄〜緑系（活力・運動）

## 画像生成プロンプト（参考）

### ユウ先生
```
A warm and approachable Japanese male doctor in his late 30s, gentle eyes, calm smile, wearing a smart casual collared shirt (no white coat), soft blue-green color accent, flat illustration style suitable for a Japanese healthcare app avatar, clean minimalist design, circle crop portrait, transparent background
```

### サキさん
```
A friendly and cheerful Japanese female nutritionist in her late 20s, bright warm smile, wearing a simple blouse, soft orange-pink color accent, flat illustration style suitable for a Japanese healthcare app avatar, clean minimalist design, circle crop portrait, transparent background
```

### マイコーチ
```
An energetic and encouraging Japanese female fitness trainer in her late 20s, confident and warm expression, wearing a sporty top, soft yellow-green color accent, flat illustration style suitable for a Japanese healthcare app avatar, clean minimalist design, circle crop portrait, transparent background
```

## 納品形式
- PNG（透過背景）
- 512x512px 以上
- 3ファイル: `avatar-yu.png`, `avatar-saki.png`, `avatar-mai.png`
- 配置先: `web-app/public/avatars/`

## Acceptance Criteria
1. 3キャラ分のアバター画像がPNG形式で納品される
2. 円形アバターとして使える構図（顔中心）
3. 日本のヘルスケアアプリに適したトーン
4. 3人の個性が視覚的に区別できる
5. 背景が透明またはアプリ側で差し替え可能
