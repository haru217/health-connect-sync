# Request: 注目のポイント統合サマリー文生成（E1）

- Date: 2026-03-03
- Owner: Codex-shinsekai
- Status: `todo`
- Phase: E（UX改善）
- Depends on: なし（D2リファクタリング完了後が理想だが、home-summary.ts単体で作業可能）

## Background

ホーム画面の「注目のポイント」は現在、個別の `attentionPoints` 配列をフロントエンドで `.join(' ')` して表示している。
結果として「睡眠は目標達成できています 歩数は目標達成できています」のように独立した文がスペース結合された不自然な表示になる。

## 目標

バックエンドで統合サマリー文を生成し、フロントエンドで自然な文章として表示する。

## 変更ファイル

### 1. `cloudflare-api/src/handlers/home-summary.ts`

`buildAttentionSummary(attentionPoints)` 関数を追加し、レスポンスに `attentionSummary` フィールドを追加する。

#### 統合ロジック

```typescript
function buildAttentionSummary(points: Array<{ label: string; message: string; type: string }>): string {
  const positive = points.filter(p => p.type === 'positive');
  const nonPositive = points.filter(p => p.type !== 'positive');

  const parts: string[] = [];

  // positive 2件以上 → データソースラベルを「・」結合して1文に
  if (positive.length >= 2) {
    const labels = positive.map(p => p.label).join('・');
    parts.push(`${labels}は目標達成できています`);
  } else if (positive.length === 1) {
    // positive 1件 → そのまま使用
    parts.push(positive[0].message);
  }

  // 非positive → 個別メッセージをそのまま追加
  for (const p of nonPositive) {
    parts.push(p.message);
  }

  return parts.join('。');
}
```

#### レスポンス変更

```typescript
// 既存の attentionPoints はそのまま維持
return jsonResponse({
  ...existingResponse,
  attentionSummary: buildAttentionSummary(attentionPoints),
});
```

### 2. `web-app/src/api/types.ts`

`HomeSummaryResponse` 型に `attentionSummary` フィールドを追加。

```typescript
// 既存フィールドに追加
attentionSummary: string;
```

### 3. `web-app/src/screens/HomeScreen.tsx`

現在の `.join(' ')` を `attentionSummary` の表示に置換。「。」で改行する（ExpertCard と同じ手法）。

```tsx
// Before:
// attentionPoints.map(p => p.message).join(' ')

// After:
{summary.attentionSummary.split('。').filter(Boolean).map((sentence, i) => (
  <React.Fragment key={i}>
    {sentence}。
    {i < summary.attentionSummary.split('。').filter(Boolean).length - 1 && <br />}
  </React.Fragment>
))}
```

## 制約

1. 既存の `attentionPoints` 配列はレスポンスに維持する（他で使う可能性）
2. `attentionSummary` は新規追加フィールド（後方互換性あり）
3. TypeScript ビルドが通ること
4. 統合ロジックはバックエンド側で完結させる（フロントは表示のみ）

## Acceptance Criteria

1. `attentionSummary` が API レスポンスに含まれる
2. フロントエンドで統合された自然な文章として表示される
3. 「。」で改行される（ExpertCard と同じ手法）
4. TypeScript ビルドが通る
5. 既存の `attentionPoints` 配列は維持される
