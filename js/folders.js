/* folders.js
Folder tree and folder navigation for SSC Prep v2.0
*/

const SUBJECTS = [
{ key: "maths", label: "Maths" },
{ key: "reasoning", label: "Reasoning" },
{ key: "english", label: "English" },
{ key: "gk", label: "General Knowledge" },
];

let currentFolderId = null;

async function getRootFoldersBySubject(subjectKey) {
const folders = await DB.getAllFolders();
return folders.filter((f) => f.subject === subjectKey && !f.parentId);
}

async function getFolderChildren(folderId) {
return DB.getSubfolders(folderId);
}

async function getFolderPath(folderId) {
const path = [];
let current = folderId;

while (current) {
const folder = await DB.getFolder(current);
if (!folder) break;
path.unshift(folder);
current = folder.parentId || null;
}

return path;
}

function renderTreeNode(folder, depth = 0) {
return `     <div class="tree-node" data-folder-id="${folder.id}" style="padding-left:${12 + depth * 14}px">       <span class="tree-chevron">›</span>       <span class="tree-icon">${folder.icon || "📁"}</span>       <span class="tree-name">${escapeHTML(folder.name)}</span>     </div>
  `;
}

async function renderSubjectTree(subjectKey) {
const treeId = `${subjectKey}Tree`;
const treeEl = document.getElementById(treeId);
if (!treeEl) return;

const rootFolders = await getRootFoldersBySubject(subjectKey);
const html = [];

for (const folder of rootFolders) {
html.push(renderTreeNode(folder, 0));

```
const children = await DB.getSubfolders(folder.id);
for (const child of children) {
  html.push(renderTreeNode(child, 1));
}
```

}

treeEl.innerHTML = html.join("") || `<div class="tree-empty">No folders yet</div>`;

treeEl.querySelectorAll("[data-folder-id]").forEach((node) => {
node.addEventListener("click", async () => {
await openFolder(node.dataset.folderId);
});
});
}

function toggleSubject(subjectKey) {
const tree = document.getElementById(`${subjectKey}Tree`);
if (!tree) return;

const expanded = !tree.classList.contains("expanded");
tree.classList.toggle("expanded", expanded);
tree.classList.toggle("collapsed", !expanded);

const btn = document.querySelector(`.subject-toggle[data-subject="${subjectKey}"]`);
if (btn) {
btn.textContent = `${expanded ? "▼" : "▶"} ${subjectLabel(subjectKey)}`;
}
}

function subjectLabel(subjectKey) {
const subject = SUBJECTS.find((s) => s.key === subjectKey);
return subject ? subject.label : subjectKey;
}

async function openFolder(folderId) {
currentFolderId = folderId || null;

const path = await getFolderPath(folderId);
UI.setCrumb([
{
label: "Home",
onClick: () => navigate("dashboard"),
},
{
label: "Folders",
onClick: () => navigate("folders"),
},
...path.map((item) => ({
label: item.name,
onClick: () => navigate("folders", { folderId: item.id }),
})),
]);

UI.setViewVisibility("folder-view");
UI.setActiveNav("folders");

const folderTitle = document.getElementById("folderTitle");
if (folderTitle) {
folderTitle.textContent = path.length ? path[path.length - 1].name : "All content";
}

const folders = await DB.getSubfolders(folderId);
const cards = await DB.getCardsInFolder(folderId);
const media = await DB.getMediaInFolder(folderId);
const pdfs = await DB.getPdfsInFolder(folderId);

renderFolderStats(folderId, cards, media, pdfs);
renderFolderTree(folderId, folders);
renderFolderContent(folderId, cards, media, pdfs);
}

function renderFolderStats(folderId, cards = [], media = [], pdfs = []) {
const container = document.getElementById("folderStats");
if (!container) return;

const reviewed = cards.filter((c) => (c.srs?.reviewCount || 0) > 0).length;
const mastered = cards.filter((c) => (c.srs?.status === "mastered" || (c.srs?.reviewCount || 0) >= 4)).length;

container.innerHTML = [
UI.renderStatCard({ label: "Folders", value: folderId ? 1 : 0, sub: "Current scope" }),
UI.renderStatCard({ label: "Cards", value: cards.length, sub: `${reviewed} reviewed` }),
UI.renderStatCard({ label: "Media", value: media.length, sub: "Images / mindmaps" }),
UI.renderStatCard({ label: "PDFs", value: pdfs.length, sub: `${mastered} mastered` }),
].join("");
}

async function renderFolderTree(folderId, folderList = []) {
const container = document.getElementById("folderTree");
if (!container) return;

const children = folderId ? folderList : await DB.getAllFolders();
container.innerHTML = children.length
? children.map((folder) => `         <div class="folder-row" data-open-folder="${folder.id}">           <div class="fic">${folder.icon || "📁"}</div>           <div class="meta">             <div class="name">${escapeHTML(folder.name)}</div>             <div class="count">${folder.type || "folder"}</div>           </div>           <div class="chev">›</div>         </div>
      `).join("")
: `<div class="empty-state">No folders yet</div>`;

container.querySelectorAll("[data-open-folder]").forEach((row) => {
row.addEventListener("click", () => openFolder(row.dataset.openFolder));
});
}

function renderFolderContent(folderId, cards = [], media = [], pdfs = []) {
const flashcardList = document.getElementById("flashcardList");
const imageList = document.getElementById("imageList");
const mindmapList = document.getElementById("mindmapList");
const pdfList = document.getElementById("pdfList");

if (flashcardList) {
flashcardList.innerHTML = cards.length
? cards.map((card) => `           <div class="card item-card" data-card-id="${card.id}">             <div class="item-title">${escapeHTML(card.question)}</div>             <div class="item-sub">${escapeHTML(card.answer)}</div>           </div>
        `).join("")
: `<div class="empty-state">No flashcards in this folder.</div>`;
}

const images = media.filter((m) => m.kind === "image");
const mindmaps = media.filter((m) => m.kind === "mindmap" || m.kind === "diagram");

if (imageList) {
imageList.innerHTML = images.length
? images.map((item) => `           <div class="card item-card media-card" data-media-id="${item.id}">             <img src="${item.dataUrl}" alt="${escapeHTML(item.name)}" />             <div class="item-title">${escapeHTML(item.name)}</div>           </div>
        `).join("")
: `<div class="empty-state">No images in this folder.</div>`;
}

if (mindmapList) {
mindmapList.innerHTML = mindmaps.length
? mindmaps.map((item) => `           <div class="card item-card media-card" data-media-id="${item.id}">             <img src="${item.dataUrl}" alt="${escapeHTML(item.name)}" />             <div class="item-title">${escapeHTML(item.name)}</div>           </div>
        `).join("")
: `<div class="empty-state">No mindmaps in this folder.</div>`;
}

if (pdfList) {
pdfList.innerHTML = pdfs.length
? pdfs.map((item) => `           <div class="card item-card" data-pdf-id="${item.id}">             <div class="item-title">📄 ${escapeHTML(item.name)}</div>           </div>
        `).join("")
: `<div class="empty-state">No PDFs in this folder.</div>`;
}
}

async function createFolder(parentId = null, subject = null, type = "folder") {
const name = prompt("Folder name:");
if (!name) return;

const folder = await DB.addFolder({
name,
parentId,
subject,
type,
icon: "📁",
});

showToast("Folder created");
await openFolder(parentId || folder.id);
return folder;
}

async function deleteCurrentFolder(folderId) {
if (!folderId) return;
const ok = confirm("Delete this folder and everything inside it?");
if (!ok) return;

await DB.deleteFolder(folderId);
showToast("Folder deleted");
await navigate("folders");
}

window.Folders = {
SUBJECTS,
currentFolderId,
getRootFoldersBySubject,
getFolderChildren,
getFolderPath,
renderSubjectTree,
toggleSubject,
openFolder,
renderFolderStats,
renderFolderTree,
renderFolderContent,
createFolder,
deleteCurrentFolder,
subjectLabel,
};
