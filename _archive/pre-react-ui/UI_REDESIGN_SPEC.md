# UI リデザイン仕様書（Phase 2）

> **担当分担メモ（2026-02 更新）**
> - **Gemini**: UI デザイン参考のみ（`web-app/` はデザインモック、コード実装はしない）
> - **Codex**: 全コード実装（このファイルの仕様に従い `ui_template.html` を改修する）
> - **実装ベース**: `pc-server/app/ui_template.html`（Vanilla HTML/JS）— React への書き直しは Phase 2 以降
> - **詳細指示書**: `CODEX_STEP2.md` を参照

対象ファイル: `pc-server/app/ui_template.html`

---

## 変更概要

| 項目 | 現状（Phase 1） | 変更後（Phase 2） |
|---|---|---|
| タブ構成 | 🏠🍽❤️🤖⚙️（5タブ） | 🏠🍽🏃❤️🤖（5タブ）+ ☰設定 |
| 🏃 運動タブ | 健康タブ内「活動」サブタブ | **独立タブとして分離** |
| ❤️ 健康タブ | 3サブタブ（ダイエット/活動/バイタル） | **2サブタブ（ダイエット/バイタル）** |
| 🤖 AIタブ | 3サブタブ（プロンプト生成/保存/履歴） | **日次/週次/月次 + コピペ保存UI** |
| ⚙️ 設定 | タブとして存在 | **☰ハンバーガーメニューに移動** |
| カラーテーマ | Phase 1 デザイントークン | 同じ（継続） |
| フォント | M PLUS 1p + Lexend | 同じ（継続） |

---

## デザイントークン（継続使用）

```css
--bg:       #09132a;  /* ページ背景 */
--surface:  #152847;  /* カード・パネル（--panel と同値） */
--accent:   #33ff20;  /* アクティブ・ボタン（--acc と同値） */
--good:     #85ff9f;
--warn:     #ffc676;
--danger:   #ff90a6;  /* --bad と同値 */
--muted:    #9fb3d8;  /* 非アクティブ・サブテキスト */
--text:     #ffffff;  /* --txt と同値 */
```

---

## レイアウト基本仕様

```css
max-width: 430px;   /* スマホサイズ */
margin: 0 auto;     /* 中央配置 */
```

---

## ナビゲーション変更

### ボトムナビ HTML（変更後）

```html
<nav id="bottom-nav">
  <button class="active" data-tab="home" onclick="switchTab('home',this)">
    <span class="icon">🏠</span><span>ホーム</span>
  </button>
  <button data-tab="food" onclick="switchTab('food',this)">
    <span class="icon">🍽</span><span>食事</span>
  </button>
  <button data-tab="exercise" onclick="switchTab('exercise',this)">
    <span class="icon">🏃</span><span>運動</span>
  </button>
  <button data-tab="health" onclick="switchTab('health',this)">
    <span class="icon">❤️</span><span>健康</span>
  </button>
  <button data-tab="ai" onclick="switchTab('ai',this)">
    <span class="icon">🤖</span><span>AI</span>
  </button>
</nav>
```

### ヘッダー HTML（変更後）

```html
<header style="display:flex;justify-content:space-between;align-items:center;padding:12px 16px;">
  <h1 style="font-size:18px;">Health AI</h1>
  <button onclick="openSettings()" style="background:none;border:none;color:var(--muted);font-size:24px;cursor:pointer;">☰</button>
</header>
```

### 設定パネル（ドロワーまたはモーダル）

```html
<!-- ☰ クリックで開く設定オーバーレイ -->
<div id="settings-overlay" style="display:none; position:fixed; top:0; left:50%; transform:translateX(-50%);
     width:100%; max-width:430px; height:100%; background:var(--bg); z-index:200; overflow-y:auto; padding:16px;">
  <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;">
    <h2 style="font-size:16px;">⚙️ 設定</h2>
    <button onclick="closeSettings()" style="background:none;border:none;color:var(--muted);font-size:24px;">✕</button>
  </div>
  <!-- 既存の設定コンテンツをここに移植 -->
</div>
```

---

## 🏃 運動タブ（新規）

既存の「健康タブ > 活動サブタブ」コンテンツを移植し、週間/月間切り替えを追加。
API は既存の `GET /api/summary` を再利用（追加エンドポイント不要）。

```html
<div id="view-exercise" class="view">
  <!-- 期間切り替え -->
  <div class="submenu">
    <button class="active" onclick="switchExercisePeriod('week', this)">週間</button>
    <button onclick="switchExercisePeriod('month', this)">月間</button>
  </div>

  <!-- サマリーグリッド（3列） -->
  <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px;margin-bottom:16px;">
    <div class="card" style="text-align:center;">
      <div class="card-title">平均歩数</div>
      <div class="card-value" id="ex-avg-steps" style="font-size:20px;">--</div>
      <div class="card-sub">歩/日</div>
    </div>
    <div class="card" style="text-align:center;">
      <div class="card-title">合計距離</div>
      <div class="card-value" id="ex-total-dist" style="font-size:20px;">--</div>
      <div class="card-sub">km</div>
    </div>
    <div class="card" style="text-align:center;">
      <div class="card-title">消費Cal</div>
      <div class="card-value" id="ex-total-cal" style="font-size:20px;">--</div>
      <div class="card-sub">kcal</div>
    </div>
  </div>

  <!-- 歩数グラフ -->
  <div class="card">
    <div class="card-title">歩数</div>
    <canvas id="chart-ex-steps" height="160"></canvas>
  </div>

  <!-- 消費カロリーグラフ -->
  <div class="card">
    <div class="card-title">消費カロリー</div>
    <canvas id="chart-ex-calories" height="140"></canvas>
  </div>
</div>
```

---

## ❤️ 健康タブ変更

活動サブタブを削除（運動タブに移管）。2サブタブ構成に変更。

```html
<div id="view-health" class="view">
  <div class="submenu">
    <button class="active" onclick="switchSub('health','health-diet',this)">ダイエット</button>
    <!-- 「活動」サブタブを削除 -->
    <button onclick="switchSub('health','health-vitals',this)">バイタル</button>
  </div>

  <!-- ダイエット・バイタルは既存と同じ -->
</div>
```

---

## 🤖 AIタブ リデザイン

### 変更前（Phase 1）
3サブタブ: プロンプト生成 / 保存 / 履歴

### 変更後（Phase 2）

```html
<div id="view-ai" class="view">
  <!-- 種別タブ -->
  <div class="submenu">
    <button class="active" onclick="switchAiType('daily', this)">日次</button>
    <button onclick="switchAiType('weekly', this)">週次</button>
    <button onclick="switchAiType('monthly', this)">月次</button>
  </div>

  <!-- 最新レポートのエージェントコメント -->
  <div id="ai-agent-comments">
    <div class="card" id="ai-comment-doctor">
      <div class="card-title">🩺 医師</div>
      <div id="ai-comment-doctor-text" class="loading">読み込み中...</div>
    </div>
    <div class="card" id="ai-comment-trainer">
      <div class="card-title">💪 トレーナー</div>
      <div id="ai-comment-trainer-text" class="loading">読み込み中...</div>
    </div>
    <div class="card" id="ai-comment-nutritionist">
      <div class="card-title">🥗 栄養士</div>
      <div id="ai-comment-nutritionist-text" class="loading">読み込み中...</div>
    </div>
  </div>

  <!-- 詳細レポート全文 -->
  <div class="section-title">レポート全文</div>
  <div class="card">
    <div id="ai-report-full" class="report-body">レポートなし</div>
  </div>

  <!-- 新しいレポートを保存 -->
  <details>
    <summary class="btn secondary" style="cursor:pointer;text-align:center;list-style:none;">
      + 新しいレポートを保存
    </summary>
    <div style="margin-top:12px;">
      <input type="date" id="save-date" />
      <textarea id="save-content" placeholder="LLMの返答をここに貼り付けてください..."></textarea>
      <button class="btn" onclick="saveReport()">保存する</button>
    </div>
  </details>
</div>
```

### エージェントコメント抽出ロジック（JavaScript）

レポート本文からタグ区間を正規表現で抽出する：

```javascript
function extractAgentComments(content) {
  const doctor = content.match(/<!--DOCTOR-->([\s\S]*?)(?=<!--TRAINER-->|<!--END-->|$)/)?.[1]?.trim() ?? '';
  const trainer = content.match(/<!--TRAINER-->([\s\S]*?)(?=<!--NUTRITIONIST-->|<!--END-->|$)/)?.[1]?.trim() ?? '';
  const nutritionist = content.match(/<!--NUTRITIONIST-->([\s\S]*?)(?=<!--END-->|$)/)?.[1]?.trim() ?? '';
  return { doctor, trainer, nutritionist };
}

async function loadAiReport(type) {
  try {
    const data = await api(`/api/reports?report_type=${type}`);
    const latest = data.reports?.[0];
    if (!latest) {
      // 全コメントを「レポートなし」に
      return;
    }
    const full = await api(`/api/reports/${latest.id}`);
    const { doctor, trainer, nutritionist } = extractAgentComments(full.content ?? '');

    document.getElementById('ai-comment-doctor-text').innerHTML = marked.parse(doctor || 'コメントなし');
    document.getElementById('ai-comment-trainer-text').innerHTML = marked.parse(trainer || 'コメントなし');
    document.getElementById('ai-comment-nutritionist-text').innerHTML = marked.parse(nutritionist || 'コメントなし');
    document.getElementById('ai-report-full').innerHTML = marked.parse(full.content ?? '');
  } catch (e) {
    console.error('loadAiReport error:', e);
  }
}
```

---

## 🍽 食事タブ UX改善

### × 削除ボタン追加

食事ログの各行に削除ボタンを追加する。既存の `loadFoodLog()` の HTML テンプレート部分を変更：

```javascript
// 変更前
el.innerHTML = data.events.map(e => `
  <div class="card" style="padding:10px;">
    ...
  </div>
`).join('');

// 変更後
el.innerHTML = data.events.map(e => `
  <div class="card" style="padding:10px;display:flex;align-items:center;gap:10px;">
    <button onclick="deleteFoodLog(${e.id})"
      style="background:none;border:none;color:var(--bad);font-size:18px;cursor:pointer;flex-shrink:0;">✕</button>
    <div style="flex:1;">
      <div style="font-size:14px;font-weight:700;">${e.label}</div>
      <div style="font-size:12px;color:var(--muted);">
        ${[e.kcal && e.kcal + 'kcal', e.protein_g && 'P' + e.protein_g + 'g',
           e.fat_g && 'F' + e.fat_g + 'g', e.carbs_g && 'C' + e.carbs_g + 'g']
          .filter(Boolean).join(' / ') || '栄養素未入力'}
      </div>
    </div>
  </div>
`).join('');

// 削除関数
async function deleteFoodLog(id) {
  if (!confirm('この食事ログを削除しますか？')) return;
  try {
    await api(`/api/nutrition/log/${id}`, { method: 'DELETE' });
    loadFoodLog();
  } catch (e) {
    alert('削除エラー: ' + e.message);
  }
}
```

---

## 不足エンドポイント（バックエンド追加必要）

### DELETE `/api/nutrition/log/{id}`

`main.py` に追加：

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

`nutrition.py` に追加：

```python
def delete_event(event_id: int) -> bool:
    with db() as conn:
        cur = conn.execute(
            "DELETE FROM nutrition_events WHERE id = ?", (event_id,)
        )
    return cur.rowcount > 0
```

### PUT `/api/nutrition/log/{id}`（任意、低優先度）

編集モーダルが必要な場合のみ実装。削除と同様の構造で `UPDATE` SQL を使う。

---

## 実装順序

1. デザイントークン + Google Fonts 適用（CSS 変数確認・統一）
2. ヘッダーに ☰ ボタン追加 + 設定オーバーレイ実装
3. ボトムナビから ⚙️ を削除し 🏃 を追加
4. `view-exercise` を新規追加（運動タブ HTML + JS）
5. 健康タブから「活動」サブタブを削除
6. AI タブを日次/週次/月次構成に書き換え
7. 食事ログに × ボタン追加 + DELETE エンドポイント実装
8. 全体調整（スマホ実機確認）
