# Codex 実装指示書 — Step 2 & 3: UI リデザイン + API 追加

対象タスク: T06〜T14

---

## 概要

`pc-server/app/ui_template.html` を改修し、スマホ向け UI をリデザインする。
合わせて `main.py` と `nutrition.py` に削除エンドポイントを追加する。

**実装ベース**: Vanilla HTML / CSS / JavaScript（React 化しない）
**デザイン仕様の詳細**: `UI_REDESIGN_SPEC.md` を必ず参照すること

---

## 実装順序

```
1. CSS 変数・フォント確認（T06）
2. ヘッダー + ボトムナビ変更（T07）
3. 運動タブ追加（T08）
4. AI タブ リデザイン（T09）
5. 各タブのサマリー行（T10）
6. 栄養素の折りたたみ（T11）
7. 食事削除ボタン（T12）
8. DELETE エンドポイント実装（T13）
9. 全体調整（T14）
```

---

## T06: デザイントークン + フォント

`UI_REDESIGN_SPEC.md` の「デザイントークン」セクションを参照。
既存の CSS 変数が以下と一致しているか確認し、不足分を補完する：

```css
--bg:       #09132a;
--surface:  #152847;
--accent:   #33ff20;
--good:     #85ff9f;
--warn:     #ffc676;
--danger:   #ff90a6;
--muted:    #9fb3d8;
--text:     #ffffff;
```

---

## T07: ナビゲーション変更

### 変更内容

| 変更前 | 変更後 |
|---|---|
| 🏠ホーム / 🍽食事 / ❤️健康 / 🤖AI / ⚙️設定（5タブ） | 🏠ホーム / 🍽食事 / 🏃運動 / ❤️健康 / 🤖AIレポート（5タブ）+ ☰設定 |
| 絵文字アイコン | **SVG アイコン**（縁：ライトグリーン `#85ff9f`、中：白） |

### SVG アイコン仕様

- サイズ: 24×24px
- stroke-color: `#85ff9f`（`var(--good)`）
- fill: `white` または `none`
- スタイル: シンプルなアウトラインアイコン（heroicons / lucide 系）
- AI タブはグラフ・レポート系のアイコン（ロボット禁止）

### ヘッダー変更

`UI_REDESIGN_SPEC.md` の「ヘッダー HTML」セクションのコードを適用する。

### 設定パネル

☰ クリックで設定オーバーレイを表示する。
`UI_REDESIGN_SPEC.md` の「設定パネル」セクションのコードを適用する。

---

## T08: 運動タブ（新規）

`UI_REDESIGN_SPEC.md` の「🏃 運動タブ」セクションのコードを適用する。

追加の仕様:
- API: `GET /api/summary` を再利用（新エンドポイント不要）
- 週間/月間のデータ切り替えは既存 summary データから算出する
- チャートライブラリ: 既存の Chart.js をそのまま使う

---

## T09: AI タブ リデザイン

`UI_REDESIGN_SPEC.md` の「🤖 AI タブ リデザイン」セクションのコードを適用する。

追加の仕様:
- エージェントコメント抽出は `UI_REDESIGN_SPEC.md` の JavaScript を使う
- タブ名を「AI」→「AIレポート」に変更する
- Markdown レンダリングは既存の `marked.js` をそのまま使う

---

## T10: 各タブ最上段に一言サマリー追加

各タブの最上部（コンテンツ最上段）に、今日/今週の状態を1行で表示するカードを追加する。

| タブ | サマリー内容 | データソース |
|---|---|---|
| 食事 | 今日のタンパク質: 57g / 90g（63%） | `/api/nutrition/day` |
| 運動 | 今週の平均歩数: 7,240歩 | `/api/summary` |
| 健康 | 体重トレンド: 減量中 -0.3kg/7d | `/api/summary` |
| AI | 最後のレポート: 3日前（日次） | `/api/reports` |

表示スタイル:
```html
<div class="summary-banner">
  <span class="summary-label">今日のタンパク質:</span>
  <span class="summary-value">57g / 90g（63%）</span>
</div>
```

目標値が未設定の場合は「目標未設定」と表示する（プロフィール設定へ誘導）。

---

## T11: 栄養素タブの折りたたみ

食事タブ内の栄養素表示を以下の2段階にする：

**デフォルト表示（常に表示）:**
エネルギー・タンパク質・脂質・炭水化物・代表的なビタミン（B1/B2/C/D）・代表的なミネラル（Ca/Fe/Zn）

**▼ 詳細を見る（展開）:**
全栄養素（オメガ3・食物繊維・各種ビタミン・ミネラル全種）

実装方法: HTML `<details>` / `<summary>` タグを使う（JavaScript 不要）。

---

## T12: 食事タブ UX 改善（× 削除ボタン）

`UI_REDESIGN_SPEC.md` の「🍽 食事タブ UX改善」セクションのコードを適用する。

---

## T13: DELETE /api/nutrition/log/{id} 実装

### main.py に追加

```python
@app.delete("/api/nutrition/log/{event_id}")
def nutrition_log_delete(
    event_id: int,
    _: None = Depends(require_api_key),
) -> dict:
    from .nutrition import delete_event
    ok = delete_event(event_id)
    if not ok:
        raise HTTPException(status_code=404, detail="Event not found")
    return {"ok": True, "deleted_id": event_id}
```

### nutrition.py に追加

```python
def delete_event(event_id: int) -> bool:
    with db() as conn:
        cur = conn.execute(
            "DELETE FROM nutrition_events WHERE id = ?", (event_id,)
        )
    return cur.rowcount > 0
```

### 同時に nutrition_nutrients も削除する

関連するマイクロ栄養素レコードも合わせて削除すること：

```python
def delete_event(event_id: int) -> bool:
    with db() as conn:
        conn.execute(
            "DELETE FROM nutrition_nutrients WHERE event_id = ?", (event_id,)
        )
        cur = conn.execute(
            "DELETE FROM nutrition_events WHERE id = ?", (event_id,)
        )
    return cur.rowcount > 0
```

---

## T14: 全体デザイン調整

- カードの余白: `padding: 12px 16px`（統一）
- カード間のギャップ: `gap: 8px`
- モバイル最適化: `max-width: 430px; margin: 0 auto;`（全体に適用）
- ボトムナビの高さ: `60px` 固定
- コンテンツエリアのパディング: `padding-bottom: 70px`（ボトムナビ分）

---

## 完了条件

- [ ] スマホブラウザ（Chrome/Safari）で全5タブが表示される
- [ ] SVG アイコンが表示される（絵文字アイコンは残さない）
- [ ] 各タブの最上段にサマリーが表示される
- [ ] 食事ログの × ボタンで削除できる（確認ダイアログあり）
- [ ] AI タブが日次/週次/月次切り替えで動作する
- [ ] 栄養素の「▼ 詳細を見る」が動作する

---

## 注意事項

- `web-app/`（React/Vue プロジェクト）は参照しない。実装対象は `ui_template.html` のみ
- 既存の API 呼び出しパターン（`api()` 関数）を踏襲する
- 認証ヘッダー（`X-Api-Key`）の送信を忘れずに
