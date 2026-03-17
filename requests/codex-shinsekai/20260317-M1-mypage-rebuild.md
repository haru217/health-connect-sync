# M1: マイページ全面書き換え

Priority: high
Assignee: codex-shinsekai
Status: done
Spec: `docs/superpowers/specs/2026-03-17-mypage-design.md`

## 概要

現在の `MyScreen.tsx`（接続ステータスのみ）を、4セクション構成のマイページに全面書き換える。

## 実装タスク

### タスク1: バックエンド — `/api/ai-config` エンドポイント追加

**ファイル作成**: `cloudflare-api/src/handlers/ai-config.ts`

```typescript
// GET /api/ai-config
// レスポンス:
{
  "provider": "anthropic",        // env.LLM_PROVIDER ?? 'anthropic'
  "model": "claude-haiku-4-5-20251001", // env.LLM_MODEL ?? DEFAULT_LLM_MODEL
  "display_name": "Claude Haiku 4.5"    // モデルIDから表示名を生成
}
```

- `DEFAULT_LLM_MODEL` は `constants.ts` から import
- モデルIDから表示名への変換: `claude-haiku-4-5-20251001` → `Claude Haiku 4.5` のようにパース
- `index.ts` にルーティング追加: `if (key === 'GET /api/ai-config') return handleAiConfigGet(env)`

### タスク2: フロントエンド — MyScreen.tsx 全面書き換え

**ファイル**: `web-app/src/screens/MyScreen.tsx`

4つのセクションをカード形式で縦に並べる。既存の `MyScreen.tsx` は全て置き換え。

#### セクション1: プロフィール
- `GET /api/profile` で現在値を取得
- 表示モード: ラベル + 値の一覧（性別、生年月、身長、運動頻度、運動種目、運動強度）
- 「編集」ボタンでインライン編集モードに切り替え
- 編集モード: 各フィールドがフォーム入力に変わる（SetupScreen.tsx のフォーム部品を参考に）
  - 性別: select（男性/女性/その他）
  - 生年月: number input
  - 身長: number input (cm)
  - 運動頻度: select（なし/週1-2/週3-5/毎日）
  - 運動種目: select（ウォーキング/ジム/ランニング/自重/なし）
  - 運動強度: select（軽い/中程度/高い）
- 「保存」で `PUT /api/profile` 呼び出し、「キャンセル」で表示モードに戻る
- 表示値のラベル変換例: `male` → `男性`, `weekly12` → `週1-2回`

#### セクション2: 目標設定
- 同じく `GET /api/profile` から取得
- 目標体重: number input (kg), 0.1刻み
- 関心レンズ4つ: トグルスイッチ（チェックボックスでもよい）
  - ダイエット (lens_weight)
  - 血圧改善 (lens_bp)
  - 睡眠改善 (lens_sleep)
  - パフォーマンス (lens_performance)
- トグル変更時に即時 `PUT /api/profile` で保存（デバウンス不要、即送信）
- 目標体重は「保存」ボタン付き

#### セクション3: データの状態
- `GET /api/connection-status` から取得
- 最終同期日時: `last_sync_at` を相対時刻で表示（「3時間前」「昨日」「3日前」など）
  - 相対時刻の計算はフロントエンドで行う（ライブラリ不要、簡単なヘルパー関数で）
- データ充足状況: 5項目
  - 体重 (has_weight_data)
  - 睡眠 (has_sleep_data)
  - 活動 (has_activity_data)
  - 血圧 (has_vitals_data)
  - 食事: `total_records > 0` で判定（既存レスポンスから。厳密でなくてよい）
- 各項目に緑チェック or グレー三角のアイコン
- 読み取り専用（編集なし）

#### セクション4: AIレポート
- `GET /api/gemini-usage` から月額利用状況を取得
- `GET /api/ai-config` からモデル情報を取得
- 使用モデル: display_name を表示
- Gemini利用状況: プログレスバー + 「¥{current} / ¥{limit}」テキスト
- バーの色:
  - 0〜70%: 緑 (#10b981)
  - 70〜90%: 黄 (#f59e0b)
  - 90%〜: 赤 (#ef4444)
- 読み取り専用

### スタイリング
- 既存の `index.css` のCSS変数を使う（`--text-primary`, `--text-secondary`, `--border-color` 等）
- 他の画面（HomeScreen, FoodScreen）のカードスタイルに合わせる
- インラインスタイルで実装（既存パターンに合わせる）

## 受入条件

1. `npx tsc --noEmit` がエラーなしで通る（API側・Web側両方）
2. `/api/ai-config` が正しいモデル情報を返す
3. MyScreenの4セクションが全て表示される
4. プロフィール編集 → 保存 → 再表示で値が反映される
5. トグルスイッチ操作で即時保存される
6. データの状態がconnection-statusから正しく表示される
7. Gemini利用状況がプログレスバーで表示される
8. 50行/関数、800行/ファイルのルールを守る

## 参考ファイル
- `web-app/src/screens/SetupScreen.tsx` — フォーム部品の参考
- `web-app/src/screens/MyScreen.tsx` — 書き換え対象
- `web-app/src/api/healthApi.ts` — fetchProfile, updateProfile, fetchConnectionStatus
- `web-app/src/api/types.ts` — ProfileResponse, ConnectionStatusResponse
- `cloudflare-api/src/handlers/gemini-usage.ts` — handleGeminiUsageGet
- `cloudflare-api/src/constants.ts` — DEFAULT_LLM_MODEL, DEFAULT_LLM_PROVIDER
