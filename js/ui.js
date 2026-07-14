/* ui.js
Shared UI helpers for SSC Prep v2.0
*/

function showToast(message, type = "info") {
const toast = document.getElementById("toast");
if (!toast) return;

toast.textContent = message;
toast.dataset.type = type;
toast.classList.add("show");

clearTimeout(showToast._timer);
showToast._timer = setTimeout(() => {
toast.classList.remove("show");
}, 2200);
}

function openModal(contentHtml) {
const root = document.getElementById("modal-root");
if (!root) return;

root.innerHTML = `     <div class="modal-backdrop" id="modal-backdrop">       <div class="modal-card">
        ${contentHtml}       </div>     </div>
  `;

const backdrop = document.getElementById("modal-backdrop");
backdrop?.addEventListener("click", (e) => {
if (e.target === backdrop) closeModal();
});
}

function closeModal() {
const root = document.getElementById("modal-root");
if (root) root.innerHTML = "";
}

function setViewVisibility(activeId) {
const ids = [
"dashboard-view",
"folder-view",
"study-view",
"analytics-view",
"settings-view"
];

ids.forEach((id) => {
const el = document.getElementById(id);
if (!el) return;
el.hidden = id !== activeId;
});
}

function setActiveNav(viewName) {
document.querySelectorAll("[data-nav]").forEach((el) => {
el.classList.toggle("active", el.dataset.nav === viewName);
});
}

function setCrumb(parts = []) {
const crumb = document.getElementById("crumb");
if (!crumb) return;

crumb.innerHTML = parts
.map((part, index) => {
const sep = index === 0 ? "" : '<span class="sep">/</span>';
return `${sep}<b data-crumb="${index}">${escapeHTML(part.label)}</b>`;
})
.join("");

crumb.querySelectorAll("[data-crumb]").forEach((node, index) => {
node.addEventListener("click", () => {
if (typeof parts[index]?.onClick === "function") {
parts[index].onClick();
}
});
});
}

function renderEmptyState(target, icon, title, subtitle, actionHtml = "") {
if (!target) return;
target.innerHTML = `     <div class="empty-state">       <div class="empty-icon">${icon}</div>       <h3>${escapeHTML(title)}</h3>       <p>${escapeHTML(subtitle)}</p>
      ${actionHtml}     </div>
  `;
}

function renderStatCard({ label, value, sub, accent = "" }) {
return `     <div class="card stat-card ${accent}">       <div class="label">${escapeHTML(label)}</div>       <div class="value">${escapeHTML(String(value))}</div>       <div class="sub">${escapeHTML(sub || "")}</div>     </div>
  `;
}

function createFolderRow(folder, count = 0) {
return `     <div class="folder-row" data-folder-id="${folder.id}">       <div class="fic">${folder.icon || "📁"}</div>       <div class="meta">         <div class="name">${escapeHTML(folder.name)}</div>         <div class="count">${count} item${count === 1 ? "" : "s"}</div>       </div>       <div class="chev">›</div>     </div>
  `;
}

function toggleTree(treeId, expanded) {
const tree = document.getElementById(treeId);
if (!tree) return;
tree.classList.toggle("collapsed", !expanded);
tree.classList.toggle("expanded", expanded);
}

function createSubjectTreeItem(label, id, depth = 0) {
return `     <div class="tree-item" data-folder-id="${id}" style="padding-left:${12 + depth * 14}px">       <span class="tree-dot">•</span>       <span class="tree-label">${escapeHTML(label)}</span>     </div>
  `;
}

function renderPathBreadcrumbs(pathItems = []) {
const container = document.getElementById("folderBreadcrumbs");
if (!container) return;

container.innerHTML = pathItems
.map((item, i) => `       <span class="folder-crumb" data-index="${i}">${escapeHTML(item.name)}</span>
    `)
.join(" / ");
}

function wireTopNav() {
document.querySelectorAll("[data-nav]").forEach((el) => {
el.addEventListener("click", () => {
if (typeof window.navigate === "function") {
window.navigate(el.dataset.nav);
}
});
});

document.getElementById("bnav-fab")?.addEventListener("click", () => {
if (typeof window.navigate === "function") {
window.navigate("folders");
}
});
}

window.UI = {
showToast,
openModal,
closeModal,
setViewVisibility,
setActiveNav,
setCrumb,
renderEmptyState,
renderStatCard,
createFolderRow,
toggleTree,
createSubjectTreeItem,
renderPathBreadcrumbs,
wireTopNav
};

