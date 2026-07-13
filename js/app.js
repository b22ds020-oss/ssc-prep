/* app.js — SSC CGL Flashcards SPA logic */

const viewRoot = document.getElementById("view-root");
const crumbEl = document.getElementById("crumb");
const modalRoot = document.getElementById("modal-root");
const toastEl = document.getElementById("toast");

const State = {
  view: "dashboard",
  currentFolderId: null,       // folder currently open in Folders view
  study: null,                 // active study session
  importTargetFolderId: null,
  importMode: "two",
};

// ---------------- Utilities ----------------
function esc(str) {
  return (str || "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}
function showToast(msg) {
  toastEl.textContent = msg;
  toastEl.classList.add("show");
  clearTimeout(showToast._t);
  showToast._t = setTimeout(() => toastEl.classList.remove("show"), 2200);
}
function closeModal() { modalRoot.innerHTML = ""; }
function openModal(html) { modalRoot.innerHTML = `<div class="modal-backdrop" id="modal-backdrop"><div class="modal fade-in">${html}</div></div>`;
  document.getElementById("modal-backdrop").addEventListener("click", (e) => { if (e.target.id === "modal-backdrop") closeModal(); });
}
function relTime(dateStr) {
  if (!dateStr) return "";
  const diff = Math.round((new Date(dateStr) - new Date(DB.todayStr())) / 86400000);
  if (diff <= 0) return "Due now";
  if (diff === 1) return "Due tomorrow";
  return `Due in ${diff}d`;
}

// ---------------- Init ----------------
async function init() {
  await DB.openDB();
  await Seed.seedIfEmpty();
  applyTheme(await DB.getMeta("theme", "dark"));
  wireShell();
  await refreshStreakChip();
  navigate("dashboard");
  registerSW();
}

function wireShell() {
  document.querySelectorAll("[data-nav]").forEach((el) => {
    el.addEventListener("click", () => navigate(el.dataset.nav));
  });
  document.getElementById("bnav-fab").addEventListener("click", () => navigate("import"));
  document.getElementById("theme-btn").addEventListener("click", toggleTheme);
  document.getElementById("search-btn").addEventListener("click", openSearchModal);
  document.getElementById("sidebar-roadmap-btn").addEventListener("click", openRoadmapModal);
}

function setActiveNav(view) {
  document.querySelectorAll("[data-nav]").forEach((el) => {
    el.classList.toggle("active", el.dataset.nav === view);
  });
}

async function refreshStreakChip() {
  const streak = await DB.getMeta("streak", { count: 0, lastDate: null });
  document.getElementById("streak-count").textContent = streak.count || 0;
}

function applyTheme(theme) {
  document.body.setAttribute("data-theme", theme);
  document.getElementById("theme-btn").textContent = theme === "dark" ? "🌙" : "☀️";
}
async function toggleTheme() {
  const cur = document.body.getAttribute("data-theme");
  const next = cur === "dark" ? "light" : "dark";
  applyTheme(next);
  await DB.setMeta("theme", next);
}

function registerSW() {
  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.register("sw.js").catch(() => {});
  }
}

// ---------------- Router ----------------
async function navigate(view, opts = {}) {
  State.view = view;
  setActiveNav(view);
  if (view === "dashboard") await renderDashboard();
  else if (view === "folders") await renderFolders(opts.folderId ?? State.currentFolderId);
  else if (view === "browse") await renderBrowse(opts);
  else if (view === "import") await renderImport(opts.folderId ?? null);
  else if (view === "study") await renderStudy(opts);
  else if (view === "statistics") await renderStatistics();
  else if (view === "settings") await renderSettings();
  viewRoot.classList.remove("fade-in"); void viewRoot.offsetWidth; viewRoot.classList.add("fade-in");
}

function setCrumb(parts) {
  // parts: [{label, onClick}]
  crumbEl.innerHTML = parts.map((p, i) => {
    const sep = i > 0 ? '<span class="sep">/</span>' : "";
    return `${sep}<b data-crumb="${i}">${esc(p.label)}</b>`;
  }).join("");
  crumbEl.querySelectorAll("[data-crumb]").forEach((el, i) => {
    el.addEventListener("click", () => parts[i].onClick && parts[i].onClick());
  });
}

// ================================================================
// DASHBOARD
// ================================================================
async function renderDashboard() {
  setCrumb([{ label: "Dashboard" }]);
  const [folders, cards, streak, activity, reviewStats] = await Promise.all([
    DB.getAllFolders(), DB.getAllCards(),
    DB.getMeta("streak", { count: 0, lastDate: null }),
    DB.getMeta("activity", {}),
    DB.getMeta("reviewStats", { total: 0, correct: 0 }),
  ]);
  const dueCount = cards.filter((c) => SRS.isDue(c.srs)).length;
  const mastered = cards.filter((c) => c.srs.status === "mastered").length;
  const accuracy = reviewStats.total ? Math.round((reviewStats.correct / reviewStats.total) * 100) : 0;

  const weekBars = lastNDaysActivity(activity, 7);
  const maxBar = Math.max(1, ...weekBars.map((d) => d.count));

  const topFolders = folders.filter((f) => f.parentId !== null || folders.some((x) => x.parentId === f.id) === false)
    .slice(0, 0); // unused placeholder
  const recentFolders = [...folders].sort((a, b) => b.createdAt - a.createdAt).slice(0, 5);
  const folderCountRows = await Promise.all(recentFolders.map(async (f) => {
    const ids = await DB.getAllDescendantFolderIds(f.id);
    const n = await DB.countCardsInFolders(ids);
    return { f, n };
  }));

  viewRoot.innerHTML = `
    <h1 style="font-size:22px;">Good to see you 👋</h1>
    <p style="color:var(--text-dim); margin-top:4px; font-size:13.5px;">Let's make today's revision count.</p>

    <div class="grid grid-4" style="margin-top:20px;">
      <div class="card stat-card stat-accent-purple"><div class="label">Total Cards</div><div class="value num">${cards.length}</div><div class="sub">${folders.length} folders</div></div>
      <div class="card stat-card stat-accent-blue"><div class="label">Due Today</div><div class="value num">${dueCount}</div><div class="sub">${dueCount ? "Ready to review" : "All caught up"}</div></div>
      <div class="card stat-card stat-accent-green"><div class="label">Mastered</div><div class="value num">${mastered}</div><div class="sub">${cards.length ? Math.round((mastered/cards.length)*100) : 0}% of deck</div></div>
      <div class="card stat-card stat-accent-yellow"><div class="label">Accuracy</div><div class="value num">${accuracy}%</div><div class="sub">${reviewStats.total} reviews logged</div></div>
    </div>

    <div class="grid grid-2" style="margin-top:22px; align-items:stretch;">
      <div class="card card-pad">
        <div style="display:flex; justify-content:space-between; align-items:center;">
          <h2 style="font-size:14px;">This week</h2>
          <span style="font-size:11px; color:var(--text-mute);">reviews / day</span>
        </div>
        <div style="display:flex; align-items:flex-end; gap:10px; height:90px; margin-top:16px;">
          ${weekBars.map((d) => `
            <div style="flex:1; display:flex; flex-direction:column; align-items:center; gap:6px;">
              <div style="width:100%; height:${Math.max(4, (d.count / maxBar) * 68)}px; border-radius:6px; background:${d.count ? "var(--grad-brand)" : "var(--surface)"}; border:1px solid var(--border);"></div>
              <span style="font-size:10px; color:var(--text-mute);">${d.label}</span>
            </div>`).join("")}
        </div>
      </div>
      <div class="card card-pad">
        <h2 style="font-size:14px;">Quick actions</h2>
        <div style="display:flex; flex-direction:column; gap:10px; margin-top:14px;">
          <button class="btn btn-primary btn-block" id="qa-study">▶️ Study due cards (${dueCount})</button>
          <button class="btn btn-block" id="qa-import">📥 Import new questions</button>
          <button class="btn btn-block" id="qa-browse">🗂️ Browse all cards</button>
        </div>
      </div>
    </div>

    <div class="section-head"><h2>Recent folders</h2><span class="link" id="see-all-folders">See all →</span></div>
    <div class="card">
      ${recentFolders.length ? folderCountRows.map(({ f, n }) => `
        <div class="folder-row" data-open-folder="${f.id}">
          <div class="fic">📁</div>
          <div class="meta"><div class="name">${esc(f.name)}</div><div class="count">${n} card${n === 1 ? "" : "s"}</div></div>
          <div class="chev">›</div>
        </div>`).join("") : `<div class="empty-state"><div class="glyph">📁</div>No folders yet.</div>`}
    </div>
  `;

  document.getElementById("qa-study").addEventListener("click", () => navigate("study", { scope: "due" }));
  document.getElementById("qa-import").addEventListener("click", () => navigate("import"));
  document.getElementById("qa-browse").addEventListener("click", () => navigate("browse"));
  document.getElementById("see-all-folders").addEventListener("click", () => navigate("folders", { folderId: null }));
  viewRoot.querySelectorAll("[data-open-folder]").forEach((el) => {
    el.addEventListener("click", () => navigate("folders", { folderId: el.dataset.openFolder }));
  });
}

function lastNDaysActivity(activity, n) {
  const out = [];
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(); d.setDate(d.getDate() - i);
    const key = d.toISOString().slice(0, 10);
    out.push({ key, count: activity[key] || 0, label: d.toLocaleDateString(undefined, { weekday: "narrow" }) });
  }
  return out;
}

// ================================================================
// FOLDERS
// ================================================================
async function renderFolders(folderId) {
  State.currentFolderId = folderId || null;
  const [allFolders, allCards] = await Promise.all([DB.getAllFolders(), DB.getAllCards()]);
  const path = await folderPath(folderId);
  setCrumb([{ label: "Folders", onClick: () => navigate("folders", { folderId: null }) }, ...path.map((f) => ({ label: f.name, onClick: () => navigate("folders", { folderId: f.id }) }))]);

  const subfolders = allFolders.filter((f) => f.parentId === (folderId || null));
  const rows = await Promise.all(subfolders.map(async (f) => {
    const ids = await DB.getAllDescendantFolderIds(f.id);
    const n = await DB.countCardsInFolders(ids);
    return { f, n };
  }));

  let folderCardsBlock = "";
  if (folderId) {
    const ids = await DB.getAllDescendantFolderIds(folderId);
    const cards = await DB.getCardsInFolders(ids);
    const mastered = cards.filter((c) => c.srs.status === "mastered").length;
    const review = cards.filter((c) => c.srs.status === "review" || c.srs.status === "relearning").length;
    const fresh = cards.filter((c) => c.srs.status === "new").length;
    const due = cards.filter((c) => SRS.isDue(c.srs)).length;

    folderCardsBlock = `
      <div class="grid grid-4" style="margin:18px 0;">
        <div class="card stat-card"><div class="label">Cards</div><div class="value num">${cards.length}</div></div>
        <div class="card stat-card stat-accent-green"><div class="label">Mastered</div><div class="value num">${mastered}</div></div>
        <div class="card stat-card stat-accent-yellow"><div class="label">Revision</div><div class="value num">${review}</div></div>
        <div class="card stat-card stat-accent-blue"><div class="label">New</div><div class="value num">${fresh}</div></div>
      </div>
      <div style="display:flex; gap:10px; flex-wrap:wrap; margin-bottom:22px;">
        <button class="btn btn-primary" id="fd-study" ${cards.length ? "" : "disabled"}>▶️ Study${due ? ` (${due} due)` : " all"}</button>
        <button class="btn" id="fd-browse" ${cards.length ? "" : "disabled"}>🗂️ Browse cards</button>
        <button class="btn" id="fd-import">📥 Import here</button>
        <button class="btn" id="fd-export" ${cards.length ? "" : "disabled"}>📤 Export</button>
        <button class="btn btn-danger" id="fd-delete">🗑️ Delete folder</button>
      </div>
    `;
  }

  viewRoot.innerHTML = `
    <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:10px;">
      <h1 style="font-size:20px;">${folderId ? esc(path[path.length - 1].name) : "Folders"}</h1>
      <button class="btn btn-primary btn-sm" id="new-folder-btn">＋ New Folder</button>
    </div>
    ${folderCardsBlock}
    <div class="section-head" style="margin-top:${folderId ? "6" : "18"}px;"><h2>${folderId ? "Subfolders" : "All folders"}</h2></div>
    <div class="card">
      ${rows.length ? rows.map(({ f, n }) => `
        <div class="folder-row" data-open-folder="${f.id}">
          <div class="fic">📁</div>
          <div class="meta"><div class="name">${esc(f.name)}</div><div class="count">${n} card${n === 1 ? "" : "s"}</div></div>
          <div class="row-actions">
            <div class="icon-btn btn-sm" style="width:30px;height:30px;" data-rename="${f.id}" title="Rename">✏️</div>
          </div>
          <div class="chev">›</div>
        </div>`).join("") : `<div class="empty-state"><div class="glyph">📁</div>No subfolders yet.<div class="cta"><button class="btn btn-primary btn-sm" id="empty-new-folder">＋ Create one</button></div></div>`}
    </div>
  `;

  document.getElementById("new-folder-btn").addEventListener("click", () => openFolderModal({ parentId: folderId || null }));
  document.getElementById("empty-new-folder")?.addEventListener("click", () => openFolderModal({ parentId: folderId || null }));
  viewRoot.querySelectorAll("[data-open-folder]").forEach((el) => {
    el.addEventListener("click", (e) => { if (e.target.closest("[data-rename]")) return; navigate("folders", { folderId: el.dataset.openFolder }); });
  });
  viewRoot.querySelectorAll("[data-rename]").forEach((el) => {
    el.addEventListener("click", (e) => { e.stopPropagation(); openFolderModal({ renameId: el.dataset.rename }); });
  });

  if (folderId) {
    document.getElementById("fd-study").addEventListener("click", () => navigate("study", { folderId, scope: "all" }));
    document.getElementById("fd-browse").addEventListener("click", () => navigate("browse", { folderId }));
    document.getElementById("fd-import").addEventListener("click", () => navigate("import", { folderId }));
    document.getElementById("fd-export").addEventListener("click", () => exportFolder(folderId));
    document.getElementById("fd-delete").addEventListener("click", () => confirmDeleteFolder(folderId, path));
  }
}

async function folderPath(folderId) {
  const path = [];
  let cur = folderId;
  while (cur) {
    const f = await DB.getFolder(cur);
    if (!f) break;
    path.unshift(f);
    cur = f.parentId;
  }
  return path;
}

function openFolderModal({ parentId = null, renameId = null } = {}) {
  const isRename = !!renameId;
  openModal(`
    <div class="modal-head"><h3>${isRename ? "Rename folder" : "New folder"}</h3><div class="icon-btn" id="modal-close">✕</div></div>
    <label class="field-label">Folder name</label>
    <input type="text" id="folder-name-input" placeholder="e.g. Mughal Empire" />
    <div style="display:flex; gap:10px; margin-top:18px;">
      <button class="btn btn-block" id="modal-cancel">Cancel</button>
      <button class="btn btn-primary btn-block" id="modal-save">${isRename ? "Save" : "Create"}</button>
    </div>
  `);
  document.getElementById("modal-close").addEventListener("click", closeModal);
  document.getElementById("modal-cancel").addEventListener("click", closeModal);
  const input = document.getElementById("folder-name-input");
  if (isRename) DB.getFolder(renameId).then((f) => { input.value = f.name; input.focus(); });
  else input.focus();

  document.getElementById("modal-save").addEventListener("click", async () => {
    const name = input.value.trim();
    if (!name) return showToast("Enter a folder name");
    if (isRename) {
      const f = await DB.getFolder(renameId);
      f.name = name;
      await DB.updateFolder(f);
    } else {
      await DB.addFolder({ name, parentId });
    }
    closeModal();
    showToast(isRename ? "Folder renamed" : "Folder created");
    navigate("folders", { folderId: isRename ? State.currentFolderId : parentId });
  });
}

function confirmDeleteFolder(folderId, path) {
  const name = path[path.length - 1]?.name || "this folder";
  openModal(`
    <div class="modal-head"><h3>Delete folder?</h3><div class="icon-btn" id="modal-close">✕</div></div>
    <p style="color:var(--text-dim); font-size:13.5px;">This permanently deletes <b>${esc(name)}</b>, all its subfolders, and every card inside them. This can't be undone.</p>
    <div style="display:flex; gap:10px; margin-top:18px;">
      <button class="btn btn-block" id="modal-cancel">Cancel</button>
      <button class="btn btn-danger btn-block" id="modal-confirm">Delete</button>
    </div>
  `);
  document.getElementById("modal-close").addEventListener("click", closeModal);
  document.getElementById("modal-cancel").addEventListener("click", closeModal);
  document.getElementById("modal-confirm").addEventListener("click", async () => {
    const parentId = path.length > 1 ? path[path.length - 2].id : null;
    await DB.deleteFolder(folderId);
    closeModal();
    showToast("Folder deleted");
    navigate("folders", { folderId: parentId });
  });
}

async function exportFolder(folderId) {
  const ids = await DB.getAllDescendantFolderIds(folderId);
  const cards = await DB.getCardsInFolders(ids);
  const folders = (await DB.getAllFolders()).filter((f) => ids.includes(f.id));
  downloadJSON({ version: 1, exportedAt: new Date().toISOString(), folders, cards }, `flashcards-export-${DB.todayStr()}.json`);
}

function downloadJSON(obj, filename) {
  const blob = new Blob([JSON.stringify(obj, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = filename;
  document.body.appendChild(a); a.click(); a.remove();
  URL.revokeObjectURL(url);
  showToast("Export downloaded");
}

// ================================================================
// IMPORT
// ================================================================
async function renderImport(presetFolderId) {
  setCrumb([{ label: "Import" }]);
  const folders = await DB.getAllFolders();
  State.importTargetFolderId = presetFolderId || State.importTargetFolderId || (folders[0] ? folders[0].id : null);

  viewRoot.innerHTML = `
    <h1 style="font-size:20px;">Import questions</h1>
    <p style="color:var(--text-dim); font-size:13.5px; margin-top:4px;">Paste your Q&amp;A in any common format — numbering, "Q1)" markers and an "Answers" section are all detected automatically.</p>

    <label class="field-label">Save into folder</label>
    <div style="display:flex; gap:10px;">
      <select id="import-folder-select" style="flex:1;">
        ${renderFolderOptions(folders, State.importTargetFolderId)}
      </select>
      <button class="btn" id="import-new-folder">＋ New</button>
    </div>

    <div style="margin-top:20px;">
      <div class="tabs">
        <div class="tab ${State.importMode === "two" ? "active" : ""}" data-mode="two">Questions + Answers</div>
        <div class="tab ${State.importMode === "combined" ? "active" : ""}" data-mode="combined">Single pasted block</div>
      </div>
    </div>

    <div id="import-body" style="margin-top:16px;"></div>

    <div class="preview-box" id="import-preview" style="display:none;"></div>

    <button class="btn btn-primary" id="generate-btn" style="margin-top:16px;">✨ Generate Flashcards</button>
  `;

  renderImportBody();
  document.getElementById("import-folder-select").addEventListener("change", (e) => { State.importTargetFolderId = e.target.value; });
  document.getElementById("import-new-folder").addEventListener("click", () => openFolderModal({ parentId: null }));
  viewRoot.querySelectorAll("[data-mode]").forEach((el) => {
    el.addEventListener("click", () => { State.importMode = el.dataset.mode; renderImport(State.importTargetFolderId); });
  });
  document.getElementById("generate-btn").addEventListener("click", handleGenerate);
}

function renderFolderOptions(folders, selected) {
  const roots = folders.filter((f) => !f.parentId);
  const lines = [];
  function walk(f, depth) {
    lines.push(`<option value="${f.id}" ${f.id === selected ? "selected" : ""}>${"— ".repeat(depth)}${esc(f.name)}</option>`);
    folders.filter((c) => c.parentId === f.id).forEach((c) => walk(c, depth + 1));
  }
  roots.forEach((r) => walk(r, 0));
  return lines.join("") || `<option value="">No folders yet</option>`;
}

function renderImportBody() {
  const body = document.getElementById("import-body");
  if (State.importMode === "two") {
    body.innerHTML = `
      <label class="field-label">Paste questions (one per line, numbering optional)</label>
      <textarea id="q-box" rows="9" placeholder="1. Who built Buland Darwaza?\n2. Who built Panch Mahal?"></textarea>
      <label class="field-label">Paste answers (same order)</label>
      <textarea id="a-box" rows="9" placeholder="1. Akbar\n2. Akbar"></textarea>
    `;
  } else {
    body.innerHTML = `
      <label class="field-label">Paste the full block — questions, then an "Answers" section</label>
      <textarea id="combined-box" rows="16" placeholder="Q1) Who built Buland Darwaza?\nQ2) Who built Panch Mahal?\n\nAnswer. 1) Akbar\nAnswer 2) Akbar"></textarea>
    `;
  }
}

function currentParseResult() {
  if (State.importMode === "two") {
    const q = document.getElementById("q-box").value;
    const a = document.getElementById("a-box").value;
    return Parser.parseTwoBoxes(q, a);
  }
  const text = document.getElementById("combined-box").value;
  return Parser.parseCombined(text);
}

function handleGenerate() {
  const result = currentParseResult();
  const preview = document.getElementById("import-preview");
  preview.style.display = "block";

  if (!result.pairs || result.pairs.length === 0) {
    preview.innerHTML = `⚠️ Couldn't match any questions to answers yet. Check that both sections are numbered the same way (e.g. "1." or "Q1)"), or that your combined text includes an "Answers" section.`;
    return;
  }

  const mismatchNote = result.mismatch ? `<br>⚠️ Question/answer counts didn't match — only the first ${result.pairs.length} pairs were used.` : "";
  preview.innerHTML = `Detected <b>${result.pairs.length}</b> question${result.pairs.length === 1 ? "" : "s"} with matching answers.${mismatchNote}
    <div style="margin-top:10px; display:flex; gap:10px;">
      <button class="btn btn-primary btn-sm" id="confirm-generate">✓ Add to folder</button>
      <button class="btn btn-sm" id="preview-list">Preview list</button>
    </div>`;

  document.getElementById("confirm-generate").addEventListener("click", async () => {
    if (!State.importTargetFolderId) return showToast("Pick or create a folder first");
    await DB.bulkAddCards(State.importTargetFolderId, result.pairs);
    showToast(`Added ${result.pairs.length} flashcards`);
    navigate("folders", { folderId: State.importTargetFolderId });
  });
  document.getElementById("preview-list").addEventListener("click", () => {
    openModal(`
      <div class="modal-head"><h3>Preview (${result.pairs.length})</h3><div class="icon-btn" id="modal-close">✕</div></div>
      <div style="display:flex; flex-direction:column; gap:10px; max-height:55vh; overflow:auto;">
        ${result.pairs.map((p, i) => `<div class="card card-pad"><b>${i + 1}. ${esc(p.question)}</b><div style="color:var(--purple-soft); margin-top:6px; font-size:13px;">${esc(p.answer)}</div></div>`).join("")}
      </div>
    `);
    document.getElementById("modal-close").addEventListener("click", closeModal);
  });
}

// ================================================================
// STUDY
// ================================================================
async function renderStudy({ folderId = null, scope = "all" } = {}) {
  setCrumb([{ label: "Study" }]);
  let cards;
  if (folderId) {
    const ids = await DB.getAllDescendantFolderIds(folderId);
    cards = await DB.getCardsInFolders(ids);
  } else {
    cards = await DB.getAllCards();
  }
  if (scope === "due") cards = cards.filter((c) => SRS.isDue(c.srs));

  cards = shuffle(cards);

  if (cards.length === 0) {
    viewRoot.innerHTML = `<div class="empty-state"><div class="glyph">🎉</div>Nothing to study here right now.<div class="cta"><button class="btn btn-primary" id="back-dash">Back to dashboard</button></div></div>`;
    document.getElementById("back-dash").addEventListener("click", () => navigate("dashboard"));
    return;
  }

  State.study = { queue: cards, index: 0, again: 0, hard: 0, good: 0, easy: 0, flipped: false };
  renderStudyCard();
}

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
}

function renderStudyCard() {
  const s = State.study;
  if (s.index >= s.queue.length) return renderStudySummary();
  const card = s.queue[s.index];
  const pct = Math.round((s.index / s.queue.length) * 100);

  viewRoot.innerHTML = `
    <div class="study-wrap">
      <div class="study-progress">
        <div class="study-top-row"><span>Card ${s.index + 1} / ${s.queue.length}</span><span>${pct}%</span></div>
        <div class="study-progress-bar"><div class="study-progress-fill" style="width:${pct}%;"></div></div>
      </div>

      <div class="flashcard" id="flashcard">
        <div class="flashcard-inner">
          <div class="flashcard-face flashcard-front">
            <div class="card-star" id="star-toggle">${card.starred ? "⭐" : "☆"}</div>
            <div class="qtext">${esc(card.question)}</div>
            <div class="flashcard-hint">Tap card to flip</div>
          </div>
          <div class="flashcard-face flashcard-back">
            <div class="atext">${esc(card.answer)}</div>
            <div class="flashcard-hint">Tap to flip back</div>
          </div>
        </div>
      </div>

      <div class="rate-row">
        <div class="rate-btn rate-again" data-rate="again"><span class="ic">❌</span>Again</div>
        <div class="rate-btn rate-hard" data-rate="hard"><span class="ic">🟡</span>Hard</div>
        <div class="rate-btn rate-good" data-rate="good"><span class="ic">🟢</span>Good</div>
        <div class="rate-btn rate-easy" data-rate="easy"><span class="ic">⭐</span>Easy</div>
      </div>

      <div class="nav-arrows">
        <button class="btn btn-sm" id="study-prev" ${s.index === 0 ? "disabled" : ""}>← Previous</button>
        <button class="btn btn-sm" id="study-exit">Exit session</button>
      </div>
    </div>
  `;

  const fc = document.getElementById("flashcard");
  fc.addEventListener("click", () => fc.classList.toggle("flipped"));
  document.getElementById("star-toggle").addEventListener("click", async (e) => {
    e.stopPropagation();
    card.starred = !card.starred;
    await DB.updateCard(card);
    renderStudyCard();
  });
  viewRoot.querySelectorAll("[data-rate]").forEach((el) => {
    el.addEventListener("click", (e) => { e.stopPropagation(); rateCard(card, el.dataset.rate); });
  });
  document.getElementById("study-prev").addEventListener("click", () => { s.index = Math.max(0, s.index - 1); renderStudyCard(); });
  document.getElementById("study-exit").addEventListener("click", () => navigate("dashboard"));

  // swipe support
  let touchX = null;
  fc.addEventListener("touchstart", (e) => { touchX = e.touches[0].clientX; });
  fc.addEventListener("touchend", (e) => {
    if (touchX === null) return;
    const dx = e.changedTouches[0].clientX - touchX;
    if (Math.abs(dx) > 60) {
      if (dx < 0 && s.index < s.queue.length - 1) { s.index++; renderStudyCard(); }
      else if (dx > 0 && s.index > 0) { s.index--; renderStudyCard(); }
    }
    touchX = null;
  });
}

async function rateCard(card, rating) {
  const s = State.study;
  card.srs = SRS.schedule(card.srs, rating);
  await DB.updateCard(card);
  s[rating] = (s[rating] || 0) + 1;
  await bumpReviewStats(rating !== "again");
  await bumpActivityAndStreak();
  s.index++;
  renderStudyCard();
}

async function bumpReviewStats(correct) {
  const rs = await DB.getMeta("reviewStats", { total: 0, correct: 0 });
  rs.total += 1;
  if (correct) rs.correct += 1;
  await DB.setMeta("reviewStats", rs);
}

async function bumpActivityAndStreak() {
  const today = DB.todayStr();
  const activity = await DB.getMeta("activity", {});
  activity[today] = (activity[today] || 0) + 1;
  await DB.setMeta("activity", activity);

  const streak = await DB.getMeta("streak", { count: 0, lastDate: null });
  if (streak.lastDate === today) {
    // already counted today
  } else {
    const yesterday = SRS.addDays(today, -1);
    streak.count = streak.lastDate === yesterday ? streak.count + 1 : 1;
    streak.lastDate = today;
    await DB.setMeta("streak", streak);
    refreshStreakChip();
  }
}

function renderStudySummary() {
  const s = State.study;
  const total = s.queue.length;
  const accuracy = total ? Math.round(((s.good + s.easy + s.hard) / total) * 100) : 0;
  viewRoot.innerHTML = `
    <div class="empty-state">
      <div class="glyph">🏁</div>
      <h2 style="font-size:20px; margin-bottom:6px;">Session complete</h2>
      <p>You reviewed ${total} card${total === 1 ? "" : "s"} — ${accuracy}% recalled correctly.</p>
      <div class="grid grid-4" style="margin-top:22px; max-width:520px; margin-left:auto; margin-right:auto;">
        <div class="card stat-card"><div class="label">Again</div><div class="value num" style="color:var(--red);">${s.again}</div></div>
        <div class="card stat-card"><div class="label">Hard</div><div class="value num" style="color:var(--yellow);">${s.hard}</div></div>
        <div class="card stat-card"><div class="label">Good</div><div class="value num" style="color:var(--green);">${s.good}</div></div>
        <div class="card stat-card"><div class="label">Easy</div><div class="value num" style="color:var(--blue);">${s.easy}</div></div>
      </div>
      <div class="cta" style="display:flex; gap:10px; justify-content:center;">
        <button class="btn" id="sum-dash">Dashboard</button>
        <button class="btn btn-primary" id="sum-again">Study again</button>
      </div>
    </div>
  `;
  document.getElementById("sum-dash").addEventListener("click", () => navigate("dashboard"));
  document.getElementById("sum-again").addEventListener("click", () => renderStudy({}));
}

// ================================================================
// BROWSE
// ================================================================
async function renderBrowse({ folderId = null } = {}) {
  setCrumb([{ label: "All Cards" }]);
  let cards = await DB.getAllCards();
  const folders = await DB.getAllFolders();
  const folderName = (id) => folders.find((f) => f.id === id)?.name || "";

  viewRoot.innerHTML = `
    <h1 style="font-size:20px;">Browse cards</h1>
    <div style="display:flex; gap:10px; margin-top:14px; flex-wrap:wrap;">
      <input type="text" id="browse-search" placeholder="Search questions or answers…" style="flex:2; min-width:220px;" />
      <select id="browse-filter" style="flex:1; min-width:160px;">
        <option value="all">All cards</option>
        <option value="due">Due today</option>
        <option value="new">New</option>
        <option value="review">In revision</option>
        <option value="mastered">Mastered</option>
        <option value="starred">Starred ⭐</option>
        <option value="difficult">Difficult 🔥</option>
      </select>
    </div>
    <div class="card" id="browse-list" style="margin-top:16px;"></div>
  `;

  function draw() {
    const q = document.getElementById("browse-search").value.trim().toLowerCase();
    const filter = document.getElementById("browse-filter").value;
    let list = cards;
    if (q) list = list.filter((c) => c.question.toLowerCase().includes(q) || c.answer.toLowerCase().includes(q) || (c.tags || []).some((t) => t.toLowerCase().includes(q)));
    if (filter === "due") list = list.filter((c) => SRS.isDue(c.srs));
    else if (filter === "new") list = list.filter((c) => c.srs.status === "new");
    else if (filter === "review") list = list.filter((c) => c.srs.status === "review" || c.srs.status === "relearning");
    else if (filter === "mastered") list = list.filter((c) => c.srs.status === "mastered");
    else if (filter === "starred") list = list.filter((c) => c.starred);
    else if (filter === "difficult") list = list.filter((c) => c.difficult);

    const listEl = document.getElementById("browse-list");
    if (!list.length) { listEl.innerHTML = `<div class="empty-state"><div class="glyph">🔍</div>No cards match.</div>`; return; }
    listEl.innerHTML = list.slice(0, 300).map((c) => `
      <div class="browse-row" data-card="${c.id}">
        <div class="status-dot dot-${c.srs.status}"></div>
        <div class="qline">${esc(c.question)}</div>
        <div class="chip-row">
          ${c.starred ? '<span class="chip">⭐</span>' : ""}
          ${c.difficult ? '<span class="chip">🔥</span>' : ""}
          <span class="chip">${esc(folderName(c.folderId))}</span>
        </div>
      </div>`).join("");
    listEl.querySelectorAll("[data-card]").forEach((el) => {
      el.addEventListener("click", () => openCardModal(el.dataset.card, draw));
    });
  }
  draw();
  document.getElementById("browse-search").addEventListener("input", draw);
  document.getElementById("browse-filter").addEventListener("change", draw);
  if (folderId) document.getElementById("browse-filter").value = "all";
}

async function openCardModal(cardId, onChange) {
  const all = await DB.getAllCards();
  const card = all.find((c) => c.id === cardId);
  if (!card) return;
  const folders = await DB.getAllFolders();

  openModal(`
    <div class="modal-head"><h3>Card details</h3><div class="icon-btn" id="modal-close">✕</div></div>
    <label class="field-label">Question</label>
    <textarea id="edit-q" rows="3">${esc(card.question)}</textarea>
    <label class="field-label">Answer</label>
    <textarea id="edit-a" rows="2">${esc(card.answer)}</textarea>
    <label class="field-label">Notes / mnemonic</label>
    <textarea id="edit-notes" rows="2" placeholder="Optional mnemonic or extra context">${esc(card.notes || card.mnemonic || "")}</textarea>
    <label class="field-label">Tags (comma separated)</label>
    <input type="text" id="edit-tags" value="${esc((card.tags || []).join(", "))}" placeholder="battles, rulers" />

    <div style="display:flex; gap:8px; margin-top:14px;">
      <button class="btn btn-sm" id="toggle-star">${card.starred ? "⭐ Starred" : "☆ Star"}</button>
      <button class="btn btn-sm" id="toggle-diff">${card.difficult ? "🔥 Marked difficult" : "Mark difficult"}</button>
    </div>

    <div style="display:flex; gap:10px; margin-top:18px;">
      <button class="btn btn-danger" id="delete-card">Delete</button>
      <button class="btn btn-block" id="modal-cancel">Cancel</button>
      <button class="btn btn-primary btn-block" id="save-card">Save</button>
    </div>
  `);

  document.getElementById("modal-close").addEventListener("click", closeModal);
  document.getElementById("modal-cancel").addEventListener("click", closeModal);
  document.getElementById("toggle-star").addEventListener("click", async () => { card.starred = !card.starred; await DB.updateCard(card); closeModal(); onChange && onChange(); showToast(card.starred ? "Starred" : "Unstarred"); });
  document.getElementById("toggle-diff").addEventListener("click", async () => { card.difficult = !card.difficult; await DB.updateCard(card); closeModal(); onChange && onChange(); showToast(card.difficult ? "Marked difficult" : "Unmarked"); });
  document.getElementById("delete-card").addEventListener("click", async () => {
    await DB.deleteCard(card.id);
    closeModal(); onChange && onChange();
    showToast("Card deleted");
  });
  document.getElementById("save-card").addEventListener("click", async () => {
    card.question = document.getElementById("edit-q").value.trim();
    card.answer = document.getElementById("edit-a").value.trim();
    card.notes = document.getElementById("edit-notes").value.trim();
    card.tags = document.getElementById("edit-tags").value.split(",").map((t) => t.trim()).filter(Boolean);
    await DB.updateCard(card);
    closeModal(); onChange && onChange();
    showToast("Card saved");
  });
}

// ================================================================
// STATISTICS
// ================================================================
async function renderStatistics() {
  setCrumb([{ label: "Statistics" }]);
  const [cards, activity, reviewStats, streak] = await Promise.all([
    DB.getAllCards(), DB.getMeta("activity", {}), DB.getMeta("reviewStats", { total: 0, correct: 0 }), DB.getMeta("streak", { count: 0, lastDate: null }),
  ]);
  const mastered = cards.filter((c) => c.srs.status === "mastered").length;
  const review = cards.filter((c) => c.srs.status === "review" || c.srs.status === "relearning").length;
  const fresh = cards.filter((c) => c.srs.status === "new").length;
  const total = cards.length || 1;
  const accuracy = reviewStats.total ? Math.round((reviewStats.correct / reviewStats.total) * 100) : 0;

  const donutDeg = { mastered: (mastered / total) * 360, review: (review / total) * 360, fresh: (fresh / total) * 360 };
  const g1 = donutDeg.mastered, g2 = g1 + donutDeg.review;
  const donutStyle = `background: conic-gradient(var(--green) 0deg ${g1}deg, var(--yellow) ${g1}deg ${g2}deg, var(--blue) ${g2}deg 360deg);`;

  const heatCells = lastNWeeksHeat(activity, 12);

  viewRoot.innerHTML = `
    <h1 style="font-size:20px;">Statistics</h1>
    <div class="grid grid-4" style="margin-top:16px;">
      <div class="card stat-card"><div class="label">Total cards</div><div class="value num">${cards.length}</div></div>
      <div class="card stat-card stat-accent-yellow"><div class="label">Reviews logged</div><div class="value num">${reviewStats.total}</div></div>
      <div class="card stat-card stat-accent-green"><div class="label">Accuracy</div><div class="value num">${accuracy}%</div></div>
      <div class="card stat-card stat-accent-purple"><div class="label">Current streak</div><div class="value num">${streak.count} 🔥</div></div>
    </div>

    <div class="grid grid-2" style="margin-top:20px; align-items:center;">
      <div class="card card-pad" style="display:flex; gap:20px; align-items:center;">
        <div class="donut" style="${donutStyle}"><div class="donut-center"><b>${cards.length}</b><span>cards</span></div></div>
        <div class="legend">
          <div class="legend-item"><span class="legend-dot" style="background:var(--green);"></span>Mastered — ${mastered}</div>
          <div class="legend-item"><span class="legend-dot" style="background:var(--yellow);"></span>In revision — ${review}</div>
          <div class="legend-item"><span class="legend-dot" style="background:var(--blue);"></span>New — ${fresh}</div>
        </div>
      </div>
      <div class="card card-pad">
        <h2 style="font-size:14px; margin-bottom:12px;">Study heatmap — last 12 weeks</h2>
        <div class="heat-grid">
          ${heatCells.map((c) => `<div class="heat-cell ${c.cls}" title="${c.date}: ${c.count} review${c.count === 1 ? "" : "s"}"></div>`).join("")}
        </div>
      </div>
    </div>
  `;
}

function lastNWeeksHeat(activity, weeks) {
  const days = weeks * 7;
  const out = [];
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(); d.setDate(d.getDate() - i);
    const key = d.toISOString().slice(0, 10);
    const count = activity[key] || 0;
    let cls = "";
    if (count >= 10) cls = "heat-4"; else if (count >= 5) cls = "heat-3"; else if (count >= 1) cls = "heat-2";
    out.push({ date: key, count, cls });
  }
  return out;
}

// ================================================================
// SETTINGS
// ================================================================
async function renderSettings() {
  setCrumb([{ label: "Settings" }]);
  const theme = document.body.getAttribute("data-theme");
  viewRoot.innerHTML = `
    <h1 style="font-size:20px;">Settings</h1>
    <div class="card card-pad" style="margin-top:16px;">
      <div class="settings-row">
        <div><div class="lbl">Dark mode</div><div class="desc">Easier on the eyes for late-night revision</div></div>
        <div class="switch ${theme === "dark" ? "on" : ""}" id="theme-switch"></div>
      </div>
      <div class="settings-row">
        <div><div class="lbl">Export backup</div><div class="desc">Download all folders and cards as a JSON file</div></div>
        <button class="btn btn-sm" id="export-all">Export</button>
      </div>
      <div class="settings-row">
        <div><div class="lbl">Restore backup</div><div class="desc">Import a previously exported JSON file</div></div>
        <button class="btn btn-sm" id="import-all-btn">Import</button>
        <input type="file" id="import-all-file" accept="application/json" style="display:none;" />
      </div>
      <div class="settings-row">
        <div><div class="lbl">Reset all data</div><div class="desc">Erase every folder, card and stat on this device</div></div>
        <button class="btn btn-sm btn-danger" id="reset-all">Reset</button>
      </div>
    </div>

    <div class="card card-pad" style="margin-top:16px;">
      <div class="lbl" style="font-weight:700; font-size:13.5px;">What's built vs. what's next</div>
      <p style="color:var(--text-mute); font-size:12.5px; margin-top:6px;">This build focuses on the core loop done well — folders, smart import, spaced repetition, browse/search, stats and offline install. Ask any time to add the rest.</p>
      <button class="btn btn-sm" id="settings-roadmap" style="margin-top:10px;">🗺️ See full roadmap</button>
    </div>

    <p style="color:var(--text-mute); font-size:11.5px; margin-top:18px; text-align:center;">SSC CGL Flashcards · v1.0 · data stays on this device</p>
  `;

  document.getElementById("theme-switch").addEventListener("click", async () => { await toggleTheme(); renderSettings(); });
  document.getElementById("export-all").addEventListener("click", async () => downloadJSON(await DB.exportAll(), `ssc-flashcards-backup-${DB.todayStr()}.json`));
  document.getElementById("import-all-btn").addEventListener("click", () => document.getElementById("import-all-file").click());
  document.getElementById("import-all-file").addEventListener("change", handleRestoreFile);
  document.getElementById("reset-all").addEventListener("click", confirmReset);
  document.getElementById("settings-roadmap").addEventListener("click", openRoadmapModal);
}

function handleRestoreFile(e) {
  const file = e.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    try {
      const data = JSON.parse(reader.result);
      openModal(`
        <div class="modal-head"><h3>Restore backup</h3><div class="icon-btn" id="modal-close">✕</div></div>
        <p style="font-size:13.5px; color:var(--text-dim);">Found ${data.folders?.length || 0} folders and ${data.cards?.length || 0} cards. Merge with existing data, or replace everything?</p>
        <div style="display:flex; gap:10px; margin-top:16px;">
          <button class="btn btn-block" id="merge-btn">Merge</button>
          <button class="btn btn-danger btn-block" id="replace-btn">Replace all</button>
        </div>
      `);
      document.getElementById("modal-close").addEventListener("click", closeModal);
      document.getElementById("merge-btn").addEventListener("click", async () => { await DB.importAll(data, { merge: true }); closeModal(); showToast("Backup merged"); navigate("dashboard"); });
      document.getElementById("replace-btn").addEventListener("click", async () => { await DB.importAll(data, { merge: false }); closeModal(); showToast("Backup restored"); navigate("dashboard"); });
    } catch {
      showToast("That file doesn't look like a valid backup");
    }
  };
  reader.readAsText(file);
  e.target.value = "";
}

function confirmReset() {
  openModal(`
    <div class="modal-head"><h3>Reset all data?</h3><div class="icon-btn" id="modal-close">✕</div></div>
    <p style="font-size:13.5px; color:var(--text-dim);">This erases every folder, card, and stat stored on this device. Consider exporting a backup first.</p>
    <div style="display:flex; gap:10px; margin-top:16px;">
      <button class="btn btn-block" id="modal-cancel">Cancel</button>
      <button class="btn btn-danger btn-block" id="modal-confirm">Erase everything</button>
    </div>
  `);
  document.getElementById("modal-close").addEventListener("click", closeModal);
  document.getElementById("modal-cancel").addEventListener("click", closeModal);
  document.getElementById("modal-confirm").addEventListener("click", async () => {
    await DB.importAll({ folders: [], cards: [], streak: { count: 0, lastDate: null }, activity: {} }, { merge: false });
    closeModal();
    showToast("All data erased");
    navigate("dashboard");
  });
}

// ================================================================
// SEARCH
// ================================================================
async function openSearchModal() {
  const cards = await DB.getAllCards();
  const folders = await DB.getAllFolders();
  const folderName = (id) => folders.find((f) => f.id === id)?.name || "";

  openModal(`
    <div class="search-modal">
      <input type="text" id="global-search" placeholder="Search all cards…" autofocus />
      <div id="search-results" style="margin-top:10px; max-height:50vh; overflow:auto;"></div>
    </div>
  `);
  const input = document.getElementById("global-search");
  const results = document.getElementById("search-results");
  input.focus();
  input.addEventListener("input", () => {
    const q = input.value.trim().toLowerCase();
    if (!q) { results.innerHTML = ""; return; }
    const matches = cards.filter((c) => c.question.toLowerCase().includes(q) || c.answer.toLowerCase().includes(q)).slice(0, 30);
    results.innerHTML = matches.length ? matches.map((c) => `
      <div class="search-result" data-card="${c.id}">
        <div class="sq">${esc(c.question)}</div>
        <div class="sa">${esc(c.answer)} · ${esc(folderName(c.folderId))}</div>
      </div>`).join("") : `<div class="empty-state" style="padding:24px;">No matches.</div>`;
    results.querySelectorAll("[data-card]").forEach((el) => {
      el.addEventListener("click", () => { closeModal(); openCardModal(el.dataset.card); });
    });
  });
}

// ================================================================
// ROADMAP
// ================================================================
function openRoadmapModal() {
  const items = [
    "Image attachments on cards (mindmaps, diagrams)",
    "Timed mock-test mode with negative marking",
    "XP, levels and streak badges",
    "AI-generated extra questions from an existing chapter",
    "Fill-in-the-blank auto-conversion",
    "Rapid-fire 60-second drills",
  ];
  openModal(`
    <div class="modal-head"><h3>🗺️ Planned next</h3><div class="icon-btn" id="modal-close">✕</div></div>
    <p style="font-size:13px; color:var(--text-dim);">Built solid first: folders, smart import, spaced repetition, browse/search/tags, stats, offline install. These are next — just ask.</p>
    <div class="roadmap-list">
      ${items.map((i) => `<div class="roadmap-item"><span class="ic">›</span>${esc(i)}</div>`).join("")}
    </div>
  `);
  document.getElementById("modal-close").addEventListener("click", closeModal);
}

// ---------------- Go ----------------
init();
