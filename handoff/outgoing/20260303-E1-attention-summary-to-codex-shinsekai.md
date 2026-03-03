# Handoff: E1 注目のポイント統合サマリー → codex-shinsekai

- Date: 2026-03-03
- From: Claude
- To: Codex-shinsekai (via codex-shinsekai MCP)
- Request file: `requests/codex-shinsekai/20260303-E1-attention-summary-unification.md`

## タスク概要

ホーム画面の「注目のポイント」表示を改善する。現在は個別メッセージをスペース結合しており不自然。バックエンドで統合サマリー文を生成し、フロントで自然な文章表示にする。

## 実行手順

新しいセッションで codex-shinsekai MCP を使って以下を実行：

1. codex-shinsekai MCPツールでリクエスト内容を送信
2. リクエストファイル: `requests/codex-shinsekai/20260303-E1-attention-summary-unification.md`

## 変更対象（3ファイル）

| ファイル | 変更内容 |
|---------|---------|
| `cloudflare-api/src/handlers/home-summary.ts` | `buildAttentionSummary()` 追加、レスポンスに `attentionSummary` フィールド追加 |
| `web-app/src/api/types.ts` | `HomeSummaryResponse` に `attentionSummary: string` 追加 |
| `web-app/src/screens/HomeScreen.tsx` | `.join(' ')` → `attentionSummary` 表示、「。」で改行 |

## 統合ロジック要約

- positive 2件以上 → ラベルを「・」結合（例: `睡眠・歩数は目標達成できています`）
- positive 1件 → そのまま
- 非positive → 個別メッセージをそのまま追加
- すべてを「。」で結合

## 注意事項

- 既存の `attentionPoints` 配列は削除しない（後方互換性）
- `.mcp.json` をプロジェクトルートに新規作成済み（codex-shinsekai MCP有効化のため）
- TypeScript ビルド確認必須
