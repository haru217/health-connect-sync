# Request: レポート履歴画面のUI改善

- Status: `todo`
- Owner agent: `gemini`
- Requester: `claude (CTO)`
- Priority: `P1`
- Due: `none`

## Context

レポート履歴画面（ReportHistoryScreen）を新設したが、UIの見栄えとUXが粗い。CEOから「過去の表示部分が見えにくいしUX悪い」とフィードバックがあった。

また、HomeScreenの週次/月次カード下にある「過去の週次を見る」「過去の月次を見る」リンクと、「もっと詳しく」セクション下の「過去のレポートを見る」リンクも、現状はテキストリンク風で目立たない。

## Scope

以下のファイルのUI/UXを改善する。デザイン判断はGeminiに任せる。

### 1. レポート履歴画面の改善

**ファイル:** `C:/Users/senta/health-connect-sync/web-app/src/screens/ReportHistoryScreen.tsx`

改善ポイント:
- タブのデザイン（現状のセグメントコントロールが他画面と統一されているか確認）
- 一覧アイテムのカードデザイン（見出しの視認性、タップ可能であることの明示）
- 空状態の表示（「レポートがありません」の見せ方）
- 全体的な余白、フォントサイズ、色の調整
- ヘッダーのスタイル統一

### 2. HomeScreenのリンク部分の改善

**ファイル:** `C:/Users/senta/health-connect-sync/web-app/src/screens/HomeScreen.tsx`

改善ポイント:
- 「過去の週次を見る」「過去の月次を見る」「過去のレポートを見る」リンクのデザイン
- テキストリンクではなく、タップしやすいボタン風デザインや、カード下部に自然に溶け込むデザインなど

参考にすべき画面:
- `C:/Users/senta/health-connect-sync/web-app/src/screens/HomeScreen.tsx` -- カードスタイルの基準
- `C:/Users/senta/health-connect-sync/web-app/src/screens/HomeScreen.css` -- CSS変数の使い方
- `C:/Users/senta/health-connect-sync/web-app/src/screens/ReportDetailScreen.tsx` -- 詳細画面のトーン
- `C:/Users/senta/health-connect-sync/web-app/src/screens/MyScreen.tsx` -- 最近Geminiが統一したトーン

## Out of scope

- バックエンドAPI変更
- 新しい画面や機能の追加
- レポート生成ロジックの変更

## Acceptance criteria

1. 履歴画面の一覧アイテムが視認しやすく、タップ可能であることが明確
2. タブデザインが他画面と統一されている
3. HomeScreenのリンクが自然で押しやすい
4. `npx tsc --noEmit` がパスする
5. `npx vite build` がパスする

## Deliverables

- `C:/Users/senta/health-connect-sync/web-app/src/screens/ReportHistoryScreen.tsx` の更新
- `C:/Users/senta/health-connect-sync/web-app/src/screens/HomeScreen.tsx` の更新
- 必要に応じてCSSファイルの新規作成

## Notes

- デザインの具体的な判断はGeminiに委任する
- 絵文字は使わないこと
