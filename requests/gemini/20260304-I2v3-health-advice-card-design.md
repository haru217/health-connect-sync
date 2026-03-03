# Request: からだタブ アドバイスカードのデザイン改善（I2v3-UI）

- Date: 2026-03-04
- Owner: Gemini
- Status: `todo`
- Phase: I（タブ強化）
- Depends on: I2v3（Codex実装完了済み）

## Background

Codexがからだタブにルールベースのアドバイスカードを実装した（I2v3）。
機能は正しく動作しているが、UIが最低限（テキスト + 左ボーダーのみ）で質感が低い。
デザイン面を改善してほしい。

## 現状のUI

各内タブ（体重 / 血圧・心拍 / 睡眠）の最上段に以下のカードが表示される:

```
┌─────────────────────────────────────────┐
│ 💡 BMIは標準範囲内です。この調子を維持し  │
│ ましょう。                               │
└─────────────────────────────────────────┘
```

現在のCSS:
```css
.health-advice-card {
  margin: 0 16px 8px;
  padding: 12px 16px;
  background: var(--bg-card, var(--surface-color));
  border-left: 3px solid var(--accent-indigo);
  border-radius: var(--border-radius-card);
  color: var(--text-secondary);
  font-size: 13px;
  line-height: 1.6;
}
```

現在のTSX（3箇所とも同じパターン）:
```tsx
{adviceText ? <div className="health-advice-card">💡 {adviceText}</div> : null}
```

## 改善してほしいこと

### デザインの方向性
- アプリ全体のトーンに合った、ヘルスケアらしい上品なカード
- ホーム画面のExpertCard（専門家コメント）とは差別化する（こちらはアバターなし・簡潔）
- 状態に応じて色味が変わると良い（良好=緑系、注意=黄系、要注意=赤系）
- 複数文（「。」区切り）がある場合の読みやすさ

### 具体的な改善案（参考、Geminiの判断で変更OK）

1. **状態別カラーリング**: アドバイスの内容に応じて左ボーダーや背景色を変える
   - 良好系メッセージ → 緑（`--accent-color`）
   - 注意系メッセージ → 黄（`--warning-color` / `#f59e0b`）
   - 要注意系メッセージ → 赤（`--danger-color`）

2. **アイコンの改善**: 💡絵文字をSVGアイコンに置換、または状態別アイコン
   - 良好: チェックマーク or ハートアイコン
   - 注意: 注意アイコン
   - 要注意: 警告アイコン

3. **カードの質感**: 微妙なグラデーション、シャドウ、角丸などで他のカードとの差別化

4. **複数文の改行**: 「。」で改行して読みやすくする（ExpertCardのSentenceText参照）

## 変更対象ファイル

| ファイル | 変更内容 |
|---------|---------|
| `web-app/src/screens/HealthScreen.tsx` | カードのJSX改善（SVGアイコン、状態別class等） |
| `web-app/src/screens/HealthScreen.css` | `.health-advice-card` のスタイル改善 |

## 状態判定の実装ヒント

アドバイス生成関数は純粋関数として実装済み。状態別の色分けを実現するには:

1. 各generate関数の戻り値を `{ text: string, tone: 'good' | 'caution' | 'warning' } | null` に変更
2. カードに `health-advice-card--good` / `health-advice-card--caution` / `health-advice-card--warning` のモディファイアクラスを付与

**tone判定ルール**:
- 体重: BMI 18.5-25 → good、BMI 25-30 → caution、BMI<18.5 or ≥30 → warning
- 血圧: 正常 → good、高値/I度 → caution、II度以上 → warning
- 睡眠: ≥420分 → good、360-420分 → caution、<360分 → warning

## 制約

1. アドバイス生成ロジック（純粋関数）の閾値・文言は変更しない
2. カードの表示/非表示ロジックは変更しない
3. TypeScript ビルドが通ること
4. 他のタブ（ホーム・運動・食事）に影響しないこと

## デザイン参考

- ホーム画面の `ExpertCard` コンポーネント（`web-app/src/components/ExpertCard.tsx`）
- ホーム画面の `domain-card`（`web-app/src/screens/HomeScreen.css`）
- 既存の `status-badge` パターン（good/warning/danger）

## Acceptance Criteria

1. アドバイスカードがアプリのデザインに馴染んでいる
2. 状態（良好/注意/要注意）に応じて視覚的な区別がある
3. 複数文のアドバイスが読みやすい
4. 絵文字ではなくSVGアイコンが使われている
5. TypeScript ビルドが通る
6. 本番デプロイはしない
