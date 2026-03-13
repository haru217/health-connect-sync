# U10: レポートフォーマット改善

## 概要
LLM生成レポートの読みやすさを改善する。マークダウン記法の除去、カテゴリー構造の導入、自明な分析の排除。

## 対象ファイル
- `cloudflare-api/src/handlers/report.ts`
- `web-app/src/screens/HomeScreen.tsx`

## 変更内容

### 1. システムプロンプト改修 (`report.ts` : `buildHaruSystemPrompt`)

現在の `# 出力` セクション（364-367行目付近）を以下に置き換える:

```
# 禁止事項
- 自明な因果を述べない（例: 「歩数が減ると消費カロリーが減る」「睡眠が短いと疲れる」等は当たり前なので書かない）
- データの単なる読み上げではなく、ユーザーが気づいていない相関や変化を指摘する
- マークダウン記法は絶対に使わない（#, **, *, - 等すべて禁止）

# 出力フォーマット
- プレーンテキストのみ
- 以下の3セクション構成で書く:

【注目ポイント】異常値・パターン変化・ドメイン間の相関など最も重要な発見
【データ分析】根拠となるデータの比較・解説（数値で語る）
【今日の提案】具体的なアクション1つ

- 各セクション間は空行で区切る
- セクション見出し（【】）の直後から本文を続ける（改行不要）
- {minChars}-{maxChars}文字
```

注意: `focusBlock`（テンプレートプロンプト）は引き続き出力セクションの前に配置すること。

### 2. 後処理の強化 (`report.ts` : `normalizeGeneratedPlainText`)

既存の絵文字除去に加え、以下のマークダウン記法を除去する安全ネットを追加:

```typescript
// # ヘッダー → テキストのみ
.replace(/^#{1,6}\s+/gm, '')
// **太字** → テキストのみ
.replace(/\*\*(.+?)\*\*/g, '$1')
// *斜体* → テキストのみ
.replace(/\*(.+?)\*/g, '$1')
// - リスト記号 → 除去
.replace(/^[-*]\s+/gm, '')
```

これらは `stripReportEmoji` の後、正規化処理の前に適用する。

### 3. フロントエンド: HaruBriefing改修 (`HomeScreen.tsx` : 186-206行目付近)

現在の `。` 分割を廃止し、段落ベース + セクション見出し対応にする:

```typescript
if (briefing) {
  // 段落で分割
  const paragraphs = briefing.split(/\n\n+/).map(p => p.trim()).filter(p => p.length > 0)

  return (
    <section className="haru-briefing-section" style={{ ... /* 既存スタイル維持 */ }}>
      {/* 既存のヘッダー部分は変更なし */}
      <div style={{ fontSize: '14px', lineHeight: '1.7', color: 'var(--text-primary)' }}>
        {paragraphs.map((para, i) => {
          // 【セクション名】を検出
          const sectionMatch = para.match(/^【(.+?)】(.*)/)
          if (sectionMatch) {
            return (
              <div key={i} style={{ marginBottom: i < paragraphs.length - 1 ? '12px' : 0 }}>
                <div style={{
                  fontSize: '13px',
                  fontWeight: 'bold',
                  color: 'var(--accent-color)',
                  marginBottom: '4px',
                  marginTop: i > 0 ? '8px' : 0,
                }}>
                  {sectionMatch[1]}
                </div>
                <p style={{ margin: 0 }}>{sectionMatch[2].trim()}</p>
              </div>
            )
          }
          return <p key={i} style={{ margin: `0 0 ${i < paragraphs.length - 1 ? '8px' : '0'} 0` }}>{para}</p>
        })}
      </div>
    </section>
  )
}
```

### 4. フロントエンド: カスタムレポート履歴表示 (`HomeScreen.tsx` : 412行目付近)

カスタムレポートの `bodyText` 表示も同様に【】セクション対応する。
現在の `{bodyText}` をレンダリングヘルパーで置き換える:

```typescript
// bodyTextをレンダリングするヘルパー関数を追加
function renderReportText(text: string) {
  const paragraphs = text.split(/\n\n+/).map(p => p.trim()).filter(p => p.length > 0)
  return paragraphs.map((para, i) => {
    const sectionMatch = para.match(/^【(.+?)】(.*)/)
    if (sectionMatch) {
      return (
        <div key={i} style={{ marginBottom: '8px' }}>
          <span style={{ fontWeight: 'bold', color: 'var(--accent-color)', fontSize: '12px' }}>
            {sectionMatch[1]}
          </span>
          <br />
          {sectionMatch[2].trim()}
        </div>
      )
    }
    return <p key={i} style={{ margin: '0 0 6px 0' }}>{para}</p>
  })
}
```

412行目の `{bodyText}` → `{renderReportText(bodyText ?? '')}` に置き換え。

## 期待される出力例

変更前:
```
# 昨日の活動量と消費カロリーの分析 昨日は2,276歩と、14日間の平均5,100歩を大きく下回りました。同時に消費カロリーも337kcalで...歩数が減ると消費カロリーが減る。
```

変更後:
```
【注目ポイント】昨日の摂取カロリーが878kcalと極めて低く、血圧141/89は14日間で最も高い値です。極端な低摂取と血圧上昇の関連が示唆されます。

【データ分析】3食分の内容が1食に集中しており、朝食の記録のみです。7,000歩以上の日（2/20, 21, 24, 27）は消費平均769kcalですが、昨日は2,276歩で337kcal。活動量より摂取不足の方が深刻です。

【今日の提案】まず摂取カロリーを通常レベル（2,000-2,200kcal）に戻すことが最優先です。朝食後に15分の散歩を加えれば、活動量の底上げにもなります。
```

## テスト確認
- TypeScriptコンパイル通ること
- 既存の `normalizeGeneratedPlainText` で 400-800文字 / 300-2000文字 の制約が引き続き機能すること
- HaruBriefing が【】なしのテキスト（旧フォーマット）でも正常に表示されること（後方互換）
