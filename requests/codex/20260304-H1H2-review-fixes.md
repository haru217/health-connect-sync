# Request: H1/H2 コードレビュー修正（2件）

- Date: 2026-03-04
- Owner: Codex
- Status: `done`
- Phase: H（ハルUX v2）
- Priority: 中

## 概要

H1/H2実装のコードレビューで発見された2件のImportant修正。

## 修正1: forbidToday バリデーションが提案文を誤拒否する

### 問題

`report.ts` L153 の `forbidToday` チェックが `normalized.includes('今日')` で単純一致している。
しかしSystem prompt L281 では「提案のみ今日OK: 今日は〜してみると良いかもしれません」と指示しているため、LLMが正しい提案文を生成してもバリデーションで弾かれる矛盾がある。

また、System prompt L281-282 に「提案のみ今日OK」ルールが記述されていない:
```
'# 時制ルール',
'- ユーザーはこのレポートを翌朝に読みます',
'- 「今日」は絶対に使わない。「昨日」「前日」「X月X日」を使う',
```

### 修正内容

**report.ts L279-282**: System promptに「提案のみ今日OK」ルールを追加:
```typescript
'# 時制ルール',
'- ユーザーはこのレポートを翌朝に読みます',
'- 「今日」は絶対に使わない。「昨日」「前日」「X月X日」を使う',
'- 提案のみ「今日」OK: 「今日は〜してみると良いかもしれません」',
```

**report.ts L747**: `forbidToday` を `false` に変更:
```typescript
const generated = await callLlmPlainText(provider, effectiveApiKey, model, systemPrompt, userPrompt, {
  minChars: 400,
  maxChars: 800,
  forbidToday: false,  // System promptで時制ルールを指示済み。提案文での「今日」は許容する
})
```

理由: System promptで時制ルールを十分指示しており、提案文での「今日」使用は意図的。バリデーションで弾くと正しいレポートが生成不能になる。

## 修正2: normalizeGeneratedPlainText が改行を消す

### 問題

`report.ts` L146 の `\s+` が改行を含む全空白文字にマッチするため、LLMが生成した意味のある改行（段落分け）が消えて1行に連結される。

```typescript
// 現在
const normalized = stripReportEmoji(value).replace(/\s+/g, ' ').trim()
```

### 修正内容

**report.ts L146**: `\s+` を `[^\S\n]+` に変更し、改行以外の連続空白のみ正規化:
```typescript
const normalized = stripReportEmoji(value).replace(/[^\S\n]+/g, ' ').replace(/\n{3,}/g, '\n\n').trim()
```

- `[^\S\n]+` → 改行以外の連続空白を半角スペース1つに
- `\n{3,}` → 3連続以上の改行を2つに（過剰な空行防止）
- 段落構造が保持されるため、フロントエンドで「。」改行以外にも自然な段落表示が可能になる

## 変更ファイル

| ファイル | 変更内容 |
|---------|---------|
| `cloudflare-api/src/handlers/report.ts` L146 | `\s+` → `[^\S\n]+` + `\n{3,}` 正規化 |
| `cloudflare-api/src/handlers/report.ts` L279-282 | System promptに提案時制ルール追加 |
| `cloudflare-api/src/handlers/report.ts` L747 | `forbidToday: false` に変更 |

## Acceptance Criteria

1. LLMが「今日は早めに就寝してみてください」を含むレポートを生成してもエラーにならない
2. LLMが生成した段落改行が保持される
3. TypeScript ビルドが通る
