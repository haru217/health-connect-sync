# タスク依頼: /api/home-summary を cloudflare-api に実装する

- 依頼日: 2026-02-26
- 依頼者: Claude (PMO)
- 担当: Codex
- 優先度: 高

## 背景

CEOの認識では cloudflare-api がホームタブ改修の成果物を提供している想定だった。
しかし PMO 調査の結果、以下の状況が判明した。

- `pc-server/app/main.py` には `/api/home-summary` が完全実装済み
  - `statusItems`（数値付き充足度）
  - `attentionPoints`（注目ポイント、ルールベース生成）
  - Graceful Degradation（A/B/C状態）
- `cloudflare-api/src/index.ts` には `/api/home-summary` が存在しない

`PROJECT_STATE.md` では cloudflare-api が本番 primary と明記されており、
pc-server は legacy 扱い。フロントエンドが cloudflare-api を向いている場合、
ホームタブ改修の機能（注目ポイント・数値付き充足度）が実際には動いていないことになる。

## 作業内容

1. `pc-server/app/main.py` の `/api/home-summary` 実装を参照し、
   同等のロジックを `cloudflare-api/src/index.ts` に実装する
2. レスポンス型（`statusItems`, `attentionPoints`）は `web-app/src/api/types.ts` の定義に合わせる
3. 注目ポイント生成ロジック（閾値ベース・トレンドベース・達成ベース）も含めて実装する

## 完了条件

- `GET /api/home-summary?date=YYYY-MM-DD` が cloudflare-api から動作すること
- `attentionPoints` と `statusItems` を含むレスポンスが返ること
- web-app がこのエンドポイントを呼び出して画面に反映されること

## 参照先

- 実装参照: `pc-server/app/main.py`（/api/home-summary, line 1348-2091 付近）
- 型定義: `web-app/src/api/types.ts`
- 閾値根拠: `docs/threshold_evidence.md`
