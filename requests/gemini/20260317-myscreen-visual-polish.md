# Request: MyScreen のビジュアルトーン統一

- Status: `todo`
- Owner agent: `gemini`
- Requester: `claude (CTO)`
- Priority: `P1`
- Due: `none`

## Context

MyScreen（マイページ）のビジュアルトーンが、他の画面（Home, Health, Exercise, Meal）と明らかに異なる。他の画面はカード影、丸みのあるborder-radius、CSS変数による統一された色使い、適度な余白とタイポグラフィの階層がある。一方MyScreenはフォームUIが中心で、色・フォントサイズ・カードスタイルが他画面と揃っていない。

ユーザー（CEO）から「見た目のトーンや文字の色が他と違う」という指摘があった。

## Scope

`web-app/src/screens/MyScreen.tsx` のビジュアルデザインを他画面と統一する。

具体的な改善ポイント（デザイン判断はGeminiに任せる）:
- カードスタイル、影、border-radiusの統一
- 文字色、フォントサイズ、フォントウェイトの階層整理
- セクション見出しのスタイル統一
- フォーム要素（input, select, toggle）のスタイル改善
- ステータス表示（接続状況、Gemini使用量）のビジュアル改善
- 全体的な余白とリズムの調整

参考にすべき画面:
- `web-app/src/screens/HomeScreen.tsx` -- カードスタイルの基準
- `web-app/src/screens/HomeScreen.css` -- CSS変数の使い方
- `web-app/src/screens/HealthScreen.tsx` -- データ表示のトーン

使用中のCSS変数:
- `--surface`, `--text-primary`, `--text-muted`, `--border-color`, `--accent-color`
- `--accent-red`, `--accent-blue`, `--accent-yellow`, `--accent-indigo`

## Out of scope

- 機能追加や新しいセクションの追加
- バックエンドAPI変更
- プロフィール項目の追加・削除
- ExpertCard / 旧エージェント体制のUI（廃止済み）

## Acceptance criteria

1. MyScreenの見た目のトーン（カード影、角丸、色使い）が他画面と統一されている
2. 文字色・サイズの階層が他画面と一致している
3. フォーム要素が洗練されたスタイルになっている
4. `npx tsc --noEmit` がパスする
5. `npx vite build` がパスする

## Deliverables

- `web-app/src/screens/MyScreen.tsx` の更新
- 必要に応じて `web-app/src/screens/MyScreen.css` の新規作成

## Notes

- デザインの具体的な判断はGeminiに委任する。他画面のトーンを見て最適な統一を行ってほしい
- インラインスタイルをCSS変数ベースに寄せることを推奨
- 絵文字は使わないこと（ダサいのでプロジェクト全体で禁止）
