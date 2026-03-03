# Request: 注目のポイント欄を廃止（E1）

- Date: 2026-03-03
- Owner: Codex
- Status: `todo`
- Phase: E（UX改善）
- Depends on: なし

## Background

ホーム画面の「注目のポイント」欄はルールベースで片言のメッセージを生成しており、
その下に表示されるAIレポート（専門家コメント）と役割が被っている。

設計レビューの結果、ホーム画面の情報構造は **スコア → 専門家コメント** の2層で完結するべきと判断。
注目のポイントは中途半端な中間層なので廃止する。

## 変更内容

### 1. フロントエンド: `web-app/src/screens/HomeScreen.tsx`

**「注目のポイント」セクションを丸ごと削除する。**

削除対象（L256〜L285付近）:
```tsx
{/* Attention Points — Stich order: hero → attention → domains */}
{content.attentionPoints.length > 0 ? (
  <section className="home-insights-section">
    ...insight-card-teal全体...
  </section>
) : null}
```

また、`attentionPoints` を参照している以下の箇所も整理:
- L192: `const attentionPoints = summary.attentionPoints ?? []` → 削除
- L202: `attentionPoints,` → 削除
- 関連する型・destructuringの整理

### 2. フロントエンド: `web-app/src/screens/HomeScreen.css`

`insight-card-teal`, `insight-icon-wrapper`, `insight-text-content`, `insight-heading`, `insight-text-body`, `home-insights-section` など注目のポイント専用スタイルを削除。
（他で使われていないことを確認の上で）

### 3. フロントエンド: `web-app/src/api/types.ts`

`HomeSummaryResponse` から `attentionPoints` と `attentionSummary` を削除（optional化でも可）。

### 4. バックエンド: `cloudflare-api/src/handlers/home-summary.ts`

attentionPoints の生成ロジック（`buildAttentionSummary` 含む）と関連型を**削除**する。
レスポンスから `attentionPoints` と `attentionSummary` フィールドを除去する。

## 変更しないもの

- スコア表示（ドーナツ + ドメインカード）
- 専門家コメント（ExpertCard / TabAiAdvice）
- headline は DB/LLM 生成時に残すが、ホーム画面には表示しない（将来使う可能性）
- `statusItems` はそのまま（スコア表示に使用中）

## Acceptance Criteria

1. ホーム画面に「注目のポイント」セクションが表示されない
2. スコア表示 → 専門家コメントが直結している
3. TypeScript ビルドが通る
4. home-summary API から attentionPoints / attentionSummary が除去されている
5. 不要なCSS・型定義がクリーンアップされている
