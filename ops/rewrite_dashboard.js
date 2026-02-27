const fs = require('fs');
const path = require('path');

const targetPath = path.join(__dirname, 'ops', 'CEO_DASHBOARD.html');
let content = fs.readFileSync(targetPath, 'utf8');

// データ部分の抽出
const scriptMatch = content.match(/(const TASKS = \[[\s\S]+?const PRIORITY_LABELS = [^;]+;)/);
if (!scriptMatch) {
    console.error("Data block not found!");
    process.exit(1);
}
const dataBlock = scriptMatch[1];

// 新しいHTML + CSS
const newHtml = `<!doctype html>
<html lang="ja">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>AIエージェント・マルチタスク・コントロールパネル</title>
  <link href="https://fonts.googleapis.com/css2?family=Noto+Sans+JP:wght@400;500;700;800&display=swap" rel="stylesheet">
  <style>
    :root {
      --bg: #0f1115;
      --panel: #171a21;
      --surface: #1e232b;
      --line: #2a313d;
      --line-soft: #222833;
      --text-main: #e2e8f0;
      --text-muted: #94a3b8;
      --accent: #10b981;
      --accent-hover: #059669;
      --danger: #ef4444;
      --warning: #f59e0b;
      --done-text: #34d399;
      --done-bg: #064e3b;
      --prog-text: #fbbf24;
      --prog-bg: #78350f;
      --block-text: #fca5a5;
      --block-bg: #7f1d1d;
      --todo-text: #94a3b8;
      --todo-bg: #1e293b;
      --hero-a: #111827;
      --hero-b: #1e293b;
      --radius-lg: 16px;
      --radius-md: 12px;
      --radius-sm: 8px;
    }

    * { box-sizing: border-box; }
    
    body {
      margin: 0;
      font-family: "Noto Sans JP", sans-serif;
      color: var(--text-main);
      background: var(--bg);
      height: 100vh;
      overflow: hidden;
      display: flex;
    }

    .app-container {
      display: grid;
      grid-template-columns: 260px 1fr 300px;
      width: 100%;
      height: 100%;
      gap: 16px;
      padding: 16px;
    }

    .panel {
      background: var(--panel);
      border: 1px solid var(--line);
      border-radius: var(--radius-lg);
      display: flex;
      flex-direction: column;
      overflow: hidden;
    }
    
    .panel-header {
      padding: 16px 20px;
      border-bottom: 1px solid var(--line);
      font-weight: 700;
      font-size: 16px;
      display: flex;
      justify-content: space-between;
      align-items: center;
    }

    .sidebar-left {
      display: flex;
      flex-direction: column;
      gap: 8px;
    }
    .logo-area {
      padding: 8px 16px 24px;
      font-weight: 800;
      font-size: 18px;
      display: flex;
      align-items: center;
      gap: 12px;
      color: var(--text-main);
    }
    
    .nav-section {
      padding: 0 12px;
    }
    .nav-title {
      font-size: 12px;
      color: var(--text-muted);
      font-weight: 700;
      padding: 8px 12px;
      margin-bottom: 4px;
      text-transform: uppercase;
      letter-spacing: 0.05em;
    }
    
    .nav-item {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 10px 12px;
      border-radius: var(--radius-sm);
      color: var(--text-muted);
      cursor: pointer;
      font-size: 14px;
      font-weight: 500;
      transition: all 0.2s;
      margin-bottom: 2px;
    }
    .nav-item:hover {
      background: var(--surface);
      color: var(--text-main);
    }
    .nav-item.active {
      background: var(--surface);
      color: var(--text-main);
      border-left: 3px solid var(--accent);
    }
    .nav-badge {
      background: var(--line);
      color: var(--text-main);
      font-size: 11px;
      padding: 2px 8px;
      border-radius: 999px;
      font-family: monospace;
    }

    .main-content {
      overflow-y: auto;
      padding-right: 8px;
      display: flex;
      flex-direction: column;
      gap: 24px;
    }
    .main-content::-webkit-scrollbar { width: 6px; }
    .main-content::-webkit-scrollbar-thumb { background: var(--line); border-radius: 3px; }

    .hero {
      background: linear-gradient(135deg, var(--hero-a), var(--hero-b));
      border: 1px solid var(--line);
      border-radius: var(--radius-lg);
      padding: 24px;
      display: flex;
      flex-direction: column;
      gap: 16px;
    }
    .hero-h1 {
      margin: 0;
      font-size: 22px;
      font-weight: 800;
      letter-spacing: 0.5px;
    }
    .meta-row {
      display: flex;
      gap: 12px;
      flex-wrap: wrap;
    }
    .tag {
      border: 1px solid var(--line);
      border-radius: 999px;
      padding: 4px 12px;
      font-size: 12px;
      background: var(--surface);
      color: var(--text-muted);
    }
    .ctrl-row {
      display: flex;
      gap: 16px;
      align-items: center;
    }
    .ctrl-row select {
      padding: 6px 12px;
      border-radius: 8px;
      border: 1px solid var(--line);
      background: var(--surface);
      color: var(--text-main);
      font-size: 13px;
      outline: none;
      cursor: pointer;
    }

    .cards {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 16px;
    }
    .card {
      background: var(--panel);
      border: 1px solid var(--line);
      border-radius: var(--radius-md);
      padding: 16px;
    }
    .card h3 {
      margin: 0 0 12px 0;
      font-size: 13px;
      color: var(--text-muted);
      font-weight: 500;
    }
    .card .val {
      font-size: 28px;
      font-weight: 800;
      font-family: sans-serif;
      margin-bottom: 4px;
      display: flex;
      align-items: baseline;
      gap: 4px;
    }
    .card .sub {
      font-size: 12px;
      color: var(--text-muted);
    }
    
    .tasks-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 12px;
    }
    .tasks-header h2 {
      font-size: 18px;
      margin: 0;
    }
    
    /* !! 重要: タスクを3カラムグリッドにする !! */
    #task-sections {
      display: grid;
      grid-template-columns: repeat(3, minmax(0, 1fr));
      gap: 16px;
    }

    /* タスクカードデザイン */
    .task-card {
      background: var(--panel);
      border: 1px solid var(--line);
      border-radius: var(--radius-md);
      padding: 16px;
      display: flex;
      flex-direction: column;
      gap: 12px;
      transition: border-color 0.2s;
    }
    .task-card:hover {
      border-color: var(--line-soft);
    }

    .task-card-title {
      font-size: 14px;
      font-weight: 800;
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      color: var(--text-main);
    }
    
    .task-card-desc {
      font-size: 12px;
      color: var(--text-muted);
      line-height: 1.5;
      flex: 1;
    }
    
    .task-meta {
      font-size: 10px;
      color: var(--text-muted);
      margin-top: 4px;
    }

    .select-state {
      padding: 4px 8px;
      border-radius: 6px;
      border: 1px solid var(--line);
      background: var(--surface);
      color: var(--text-main);
      font-size: 11px;
      font-weight: 700;
      cursor: pointer;
      outline: none;
      width: 100%;
    }

    .chip {
      display: inline-block;
      padding: 2px 8px;
      border-radius: 4px;
      font-size: 10px;
      font-weight: 800;
    }
    .priority-highest { background: var(--block-bg); color: var(--block-text); border: 1px solid rgba(239,68,68,0.3); }
    .priority-high { background: var(--prog-bg); color: var(--prog-text); border: 1px solid rgba(245,158,11,0.3); }
    
    .thread-details {
      margin-top: 4px;
      background: var(--surface);
      border-radius: var(--radius-sm);
      border: 1px solid var(--line);
      overflow: hidden;
    }
    .thread-summary {
      padding: 8px 12px;
      font-size: 11px;
      font-weight: 700;
      cursor: pointer;
      color: var(--text-muted);
      display: flex;
      justify-content: space-between;
      background: var(--surface);
      user-select: none;
    }
    .thread-summary::-webkit-details-marker { display: none; }
    .thread-summary:hover { background: var(--line-soft); }
    
    .thread-msg {
      padding: 10px 12px;
      font-size: 11px;
      line-height: 1.5;
      border-top: 1px dashed var(--line);
      color: var(--text-main);
    }
    .thread-msg .from {
      font-weight: 800;
      display: block;
      margin-bottom: 2px;
      color: #cbd5e1;
    }
    .thread-msg.cto .from {
      color: var(--accent);
    }
    
    .stamp {
      font-family: monospace;
      font-size: 10px;
      color: var(--text-muted);
      margin-top: 6px;
      text-align: right;
    }

    /* 右カラム */
    .sidebar-right {
      display: flex;
      flex-direction: column;
      gap: 16px;
    }
    .activity-list {
      display: flex;
      flex-direction: column;
      padding: 16px;
      gap: 16px;
    }
    .activity-item {
      position: relative;
      padding-left: 16px;
      border-left: 2px solid var(--line);
    }
    .activity-item::before {
      content: '';
      position: absolute;
      left: -5px;
      top: 4px;
      width: 8px;
      height: 8px;
      border-radius: 50%;
      background: var(--text-muted);
    }
    .activity-item.active::before {
      background: var(--accent);
      box-shadow: 0 0 8px var(--accent);
    }
    .act-title {
      font-size: 12px;
      font-weight: 600;
      color: var(--text-main);
      margin-bottom: 4px;
      line-height: 1.4;
    }
    .act-time {
      font-size: 10px;
      color: var(--text-muted);
    }
    
    .health-status {
      padding: 16px;
      display: flex;
      align-items: center;
      gap: 8px;
      color: var(--accent);
      font-weight: 700;
      font-size: 14px;
    }
    .health-dot {
      width: 10px;
      height: 10px;
      background: var(--accent);
      border-radius: 50%;
      box-shadow: 0 0 10px var(--accent);
    }
  </style>
</head>
<body>
  <div class="app-container">
    <!-- 左カラム：動的ナビゲーション -->
    <aside class="sidebar-left">
      <div class="logo-area">
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="color:var(--accent)"><path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>
        業績の管理
      </div>
      <div class="nav-section" id="nav-big-categories">
        <div class="nav-title">ビッグカテゴリ</div>
        <!-- JSで置換 -->
      </div>
    </aside>

    <!-- 中央カラム -->
    <main class="main-content">
      <header class="hero">
        <h1 class="hero-h1">AIエージェント・マルチタスク・コントロールパネル</h1>
        <div class="meta-row">
          <span class="tag">最終更新日: 2026-02-26</span>
          <span class="tag">ゴール: Android正式リリース</span>
          <span class="tag">更新責任: CTO（Codex）</span>
        </div>
        <div class="ctrl-row">
          <label for="actor" style="font-size:12px; color:var(--text-muted); font-weight:700;">STAMP ACTOR</label>
          <select id="actor">
            <option>Codex</option>
            <option>Gemini</option>
            <option>CEO</option>
            <option>Claude</option>
          </select>
        </div>
      </header>

      <section class="cards">
        <article class="card">
          <h3>戦略目標の総数</h3>
          <div class="val">120</div>
          <div class="sub">Google Play公開・Android正式リリース</div>
        </article>
        <article class="card">
          <h3>完了タスク</h3>
          <div class="val"><span id="pct">0</span><span style="font-size:16px;">%</span></div>
          <div class="sub" id="frac">0 / 0 完了</div>
        </article>
        <article class="card">
          <h3>進行中タスク / フェーズ</h3>
          <div class="val" id="phase">フェーズ1</div>
          <div class="sub">イテレーションとリリーススケジュール</div>
        </article>
        <article class="card">
          <h3>ブロック中の件数</h3>
          <div class="val" id="blocked" style="color:var(--danger)">0</div>
          <div class="sub">CEO判断が必要な重要事項</div>
        </article>
      </section>

      <section>
        <div class="tasks-header">
          <h2 id="mid-category-title">ミッドカテゴリ</h2>
        </div>
        <!-- ここに3カラムでタスクカードを展開 -->
        <div id="task-sections"></div>
      </section>
    </main>

    <!-- 右カラム -->
    <aside class="sidebar-right">
      <div class="panel">
        <div class="panel-header">最新アクティビティフィード</div>
        <div class="activity-list">
          <div class="activity-item active">
            <div class="act-title">エージェントガンマ: 新しいモデルを提案</div>
            <div class="act-time">2分前</div>
          </div>
          <div class="activity-item">
            <div class="act-title">エージェントエプシロン: メッセージングの方向性を承認</div>
            <div class="act-time">5分前</div>
          </div>
          <div class="activity-item">
            <div class="act-title">エージェントゼータ: ネーミング案を提出</div>
            <div class="act-time">105分前</div>
          </div>
        </div>
      </div>
      <div class="panel">
        <div class="panel-header">システムヘルス</div>
        <div class="health-status">
          <div class="health-dot"></div> 正常稼働中
        </div>
      </div>
    </aside>
  </div>

  <script>
    (() => {
      const actor = document.getElementById("actor");
      const pct = document.getElementById("pct");
      const frac = document.getElementById("frac");
      const blocked = document.getElementById("blocked");
      const phase = document.getElementById("phase");
      const taskSections = document.getElementById("task-sections");
      const navBigCategories = document.getElementById("nav-big-categories");
      const midCategoryTitle = document.getElementById("mid-category-title");
      
      const STATE_ORDER = ["todo", "in_progress", "blocked", "done"];
      const STATE_LABELS = { todo: "未着手", in_progress: "進行中", blocked: "要対応", done: "完了" };

      ${dataBlock}

      function getTaskLabel(id) { if (TASK_LABELS[id]) return TASK_LABELS[id]; if (id.startsWith("C-")) return \`引き継ぎタスク \${id} を進めます。\`; return \`タスク \${id} を進めます。\`; }
      function getTaskMeta(id) { if (TASK_META[id]) return TASK_META[id]; if (id.startsWith("C-")) return "担当はCodexです。詳細は TASK.md を見ます。"; return "担当をこれから決めます。"; }

      const BIG_CATEGORIES = [
        { id: "iter", name: "イテレーション", isUrgent: true, tasks: TASKS.filter(t => t.id.startsWith("I")) },
        { id: "p1", name: "フェーズ1", isUrgent: true, tasks: TASKS.filter(t => t.id.startsWith("P1-")) },
        { id: "p2", name: "フェーズ2", isUrgent: false, tasks: TASKS.filter(t => t.id.startsWith("P2-")) },
        { id: "p3", name: "フェーズ3", isUrgent: false, tasks: TASKS.filter(t => t.id.startsWith("P3-")) },
        { id: "legacy", name: "引き継ぎタスク", isUrgent: false, tasks: TASKS.filter(t => t.id.startsWith("C-")) },
      ];

      let activeCategory = "iter";

      function stampNow() {
        const d = new Date(); const p = (n) => String(n).padStart(2, "0");
        return \`\${actor.value} @ \${d.getFullYear()}-\${p(d.getMonth() + 1)}-\${p(d.getDate())} \${p(d.getHours())}:\${p(d.getMinutes())}\`;
      }

      function renderNav() {
        navBigCategories.innerHTML = '<div class="nav-title">ビッグカテゴリ</div>';
        BIG_CATEGORIES.forEach(cat => {
            const div = document.createElement("div");
            div.className = \`nav-item \${activeCategory === cat.id ? 'active' : ''}\`;
            const count = cat.tasks.length;
            const badge = cat.isUrgent ? \`<span class="nav-badge" style="background:var(--block-bg);color:var(--block-text)">\${count}</span>\` : \`<span class="nav-badge">\${count}</span>\`;
            div.innerHTML = \`\${cat.name} \${badge}\`;
            div.onclick = () => { 
                activeCategory = cat.id; 
                renderNav(); 
                renderTasks(); 
            };
            navBigCategories.appendChild(div);
        });
      }

      function createTaskCard(task) {
        const card = document.createElement("div");
        card.className = "task-card leaf";
        card.dataset.id = task.id;
        card.dataset.default = task.defaultStatus;
        if (task.defaultStamp) card.dataset.stamp = task.defaultStamp;
        if (task.track) card.dataset.track = task.track;

        const questions = TASK_THREADS[task.id] || [];
        const replies = TASK_REPLIES[task.id] || [];
        const pendingCount = Math.max(questions.length - replies.length, 0);

        const prio = TASK_PRIORITY[task.id];
        const prioHtml = prio ? \`<span class="chip priority-\${prio}">\${PRIORITY_LABELS[prio]}</span>\` : '';

        const header = document.createElement("div");
        header.className = "task-card-title";
        header.innerHTML = \`<span>\${task.id}</span> \${prioHtml}\`;

        const desc = document.createElement("div");
        desc.className = "task-card-desc";
        desc.innerHTML = \`\${getTaskLabel(task.id)} <div class="task-meta">\${getTaskMeta(task.id)}</div>\`;

        const ctrl = document.createElement("div");
        const select = document.createElement("select");
        select.className = "select-state state";
        ["todo", "in_progress", "blocked", "done"].forEach((state) => {
          const option = document.createElement("option"); option.value = state; option.textContent = STATE_LABELS[state] || state; select.appendChild(option);
        });
        
        const stampStr = task.defaultStamp || "スタンプ未設定";
        const stamp = document.createElement("div");
        stamp.className = "stamp";
        stamp.textContent = stampStr;

        ctrl.appendChild(select);
        ctrl.appendChild(stamp);

        card.appendChild(header);
        card.appendChild(desc);
        card.appendChild(ctrl);

        if (questions.length > 0 || replies.length > 0) {
            const threadWrap = document.createElement("details");
            threadWrap.className = "thread-details";
            
            const summary = document.createElement("summary");
            summary.className = "thread-summary";
            const qCount = pendingCount > 0 ? \`<span style="color:var(--warning)">🔔\${pendingCount}</span>\` : "";
            summary.innerHTML = \`<span>スレッド (💬\${questions.length + replies.length})</span> \${qCount}\`;
            threadWrap.appendChild(summary);

            questions.forEach((q) => {
              const msg = document.createElement("div"); msg.className = "thread-msg";
              msg.innerHTML = \`<span class="from">Claude</span>\${q}\`;
              threadWrap.appendChild(msg);
            });
            replies.forEach((r) => {
              const msg = document.createElement("div"); msg.className = "thread-msg cto";
              msg.innerHTML = \`<span class="from">CTO</span>\${r}\`;
              threadWrap.appendChild(msg);
            });
            
            card.appendChild(threadWrap);
        }

        // イベントバインディング
        select.addEventListener("change", (e) => {
            const nextStatus = e.target.value; 
            card.dataset.default = nextStatus;
            if (nextStatus === "done") card.dataset.stamp = stampNow();
            else if (nextStatus === "todo") card.dataset.stamp = "";
            else if (nextStatus === "blocked") card.dataset.stamp = \`\${actor.value}（要対応）\`;
            else card.dataset.stamp = \`\${actor.value}（進行中）\`;
            stamp.textContent = card.dataset.stamp;
            refreshMetrics();
        });

        // 初期値
        select.value = card.dataset.default || "todo";

        return card;
      }

      function renderTasks() {
         taskSections.innerHTML = "";
         const cat = BIG_CATEGORIES.find(c => c.id === activeCategory);
         if(!cat) return;
         midCategoryTitle.textContent = \`ミッドカテゴリ: \${cat.name}\`;
         cat.tasks.forEach(t => {
            taskSections.appendChild(createTaskCard(t));
         });
         refreshMetrics();
      }

      function refreshMetrics() {
        // 全体のメトリクスを計算するため、一度すべてのstateを参照
        // ここでは簡単に iterTrack のタスク（または全体）から計算
        // DOMにないタスクのステータスは dataset.default を使う
        let total = 0, done = 0, block = 0;
        TASKS.forEach(t => {
            // もし画面に描画されているものならその select を読む手法もあるが、
            // データ側(t.defaultStatus等)や card.dataset.default を使うため DOMの同期をとる
            const card = document.querySelector(\`.task-card[data-id="\${t.id}"]\`);
            const state = card ? card.dataset.default : t.defaultStatus;
            if (t.track !== "legacy") {
                total++;
                if (state === "done") done++;
                if (state === "blocked") block++;
            }
        });
        const percent = total ? Math.round((done / total) * 100) : 0;
        pct.textContent = String(percent);
        frac.textContent = \`\${done} / \${total} 完了\`;
        blocked.textContent = String(block);
        phase.textContent = percent >= 95 ? "フェーズ3" : percent >= 70 ? "フェーズ2" : "フェーズ1";
      }

      renderNav();
      renderTasks();

    })();
  </script>
</body>
</html>\`;

fs.writeFileSync(targetPath, newHtml, 'utf8');
console.log("Successfully rebuilt CEO_DASHBOARD.html");
