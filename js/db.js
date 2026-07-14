/* db.js
IndexedDB for SSC Prep v2.0
Stores folders, cards, media, pdfs, notes, stats, settings.
*/

const DB_NAME = "sscPrepV2DB";
const DB_VERSION = 1;

let _db = null;

function uid(prefix = "id") {
return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 9)}`;
}

function todayStr(offsetDays = 0) {
const d = new Date();
d.setHours(0, 0, 0, 0);
d.setDate(d.getDate() + offsetDays);
return d.toISOString().slice(0, 10);
}

function reqToPromise(req) {
return new Promise((resolve, reject) => {
req.onsuccess = () => resolve(req.result);
req.onerror = () => reject(req.error);
});
}

function tx(storeNames, mode = "readonly") {
return openDB().then((db) => db.transaction(storeNames, mode));
}

async function openDB() {
if (_db) return _db;

_db = await new Promise((resolve, reject) => {
const req = indexedDB.open(DB_NAME, DB_VERSION);

```
req.onupgradeneeded = (event) => {
  const db = event.target.result;

  if (!db.objectStoreNames.contains("folders")) {
    const store = db.createObjectStore("folders", { keyPath: "id" });
    store.createIndex("parentId", "parentId", { unique: false });
    store.createIndex("subject", "subject", { unique: false });
    store.createIndex("type", "type", { unique: false });
  }

  if (!db.objectStoreNames.contains("cards")) {
    const store = db.createObjectStore("cards", { keyPath: "id" });
    store.createIndex("folderId", "folderId", { unique: false });
    store.createIndex("subject", "subject", { unique: false });
    store.createIndex("starred", "starred", { unique: false });
    store.createIndex("status", "status", { unique: false });
    store.createIndex("dueDate", "srs.dueDate", { unique: false });
  }

  if (!db.objectStoreNames.contains("media")) {
    const store = db.createObjectStore("media", { keyPath: "id" });
    store.createIndex("folderId", "folderId", { unique: false });
    store.createIndex("cardId", "cardId", { unique: false });
    store.createIndex("subject", "subject", { unique: false });
    store.createIndex("kind", "kind", { unique: false });
  }

  if (!db.objectStoreNames.contains("pdfs")) {
    const store = db.createObjectStore("pdfs", { keyPath: "id" });
    store.createIndex("folderId", "folderId", { unique: false });
    store.createIndex("subject", "subject", { unique: false });
  }

  if (!db.objectStoreNames.contains("notes")) {
    const store = db.createObjectStore("notes", { keyPath: "id" });
    store.createIndex("folderId", "folderId", { unique: false });
    store.createIndex("subject", "subject", { unique: false });
  }

  if (!db.objectStoreNames.contains("stats")) {
    const store = db.createObjectStore("stats", { keyPath: "id" });
    store.createIndex("scopeType", "scopeType", { unique: false });
    store.createIndex("scopeId", "scopeId", { unique: false });
  }

  if (!db.objectStoreNames.contains("settings")) {
    db.createObjectStore("settings", { keyPath: "key" });
  }

  if (!db.objectStoreNames.contains("meta")) {
    db.createObjectStore("meta", { keyPath: "key" });
  }
};

req.onsuccess = (event) => resolve(event.target.result);
req.onerror = () => reject(req.error);
```

});

return _db;
}

/* ---------------------------
Folders
---------------------------- */

async function addFolder(folder) {
const db = await openDB();
const item = {
id: uid("fld"),
name: folder.name || "Untitled Folder",
parentId: folder.parentId ?? null,
subject: folder.subject ?? null,
type: folder.type || "folder", // folder | chapter | topic | custom
icon: folder.icon || "📁",
createdAt: Date.now(),
updatedAt: Date.now(),
};
const t = db.transaction("folders", "readwrite");
t.objectStore("folders").add(item);
await new Promise((res, rej) => { t.oncomplete = res; t.onerror = () => rej(t.error); });
return item;
}

async function updateFolder(folder) {
const db = await openDB();
folder.updatedAt = Date.now();
const t = db.transaction("folders", "readwrite");
t.objectStore("folders").put(folder);
await new Promise((res, rej) => { t.oncomplete = res; t.onerror = () => rej(t.error); });
return folder;
}

async function getFolder(id) {
const db = await openDB();
const t = db.transaction("folders", "readonly");
return reqToPromise(t.objectStore("folders").get(id));
}

async function getAllFolders() {
const db = await openDB();
const t = db.transaction("folders", "readonly");
return reqToPromise(t.objectStore("folders").getAll());
}

async function getSubfolders(parentId) {
const all = await getAllFolders();
return all.filter((f) => f.parentId === parentId);
}

async function getAllDescendantFolderIds(rootId) {
const all = await getAllFolders();
const result = [];
const stack = [rootId];
while (stack.length) {
const cur = stack.pop();
if (!cur || result.includes(cur)) continue;
result.push(cur);
all.filter((f) => f.parentId === cur).forEach((f) => stack.push(f.id));
}
return result;
}

async function deleteFolder(id) {
const folderIds = await getAllDescendantFolderIds(id);
const db = await openDB();
const t = db.transaction(["folders", "cards", "media", "pdfs", "notes", "stats"], "readwrite");

const foldersStore = t.objectStore("folders");
const cardsStore = t.objectStore("cards");
const mediaStore = t.objectStore("media");
const pdfStore = t.objectStore("pdfs");
const notesStore = t.objectStore("notes");
const statsStore = t.objectStore("stats");

const allCards = await getAllCards();
const allMedia = await getAllMedia();
const allPdfs = await getAllPdfs();
const allNotes = await getAllNotes();
const allStats = await getAllStats();

for (const fid of folderIds) foldersStore.delete(fid);
allCards.filter((c) => folderIds.includes(c.folderId)).forEach((c) => cardsStore.delete(c.id));
allMedia.filter((m) => folderIds.includes(m.folderId)).forEach((m) => mediaStore.delete(m.id));
allPdfs.filter((p) => folderIds.includes(p.folderId)).forEach((p) => pdfStore.delete(p.id));
allNotes.filter((n) => folderIds.includes(n.folderId)).forEach((n) => notesStore.delete(n.id));
allStats.filter((s) => s.scopeType === "folder" && folderIds.includes(s.scopeId)).forEach((s) => statsStore.delete(s.id));

await new Promise((res, rej) => { t.oncomplete = res; t.onerror = () => rej(t.error); });
}

/* ---------------------------
Flashcards
---------------------------- */

function freshSRS() {
return {
status: "new",
interval: 0,
ease: 2.5,
reps: 0,
lapses: 0,
reviewCount: 0,
dueDate: todayStr(),
lastReviewed: null,
lastResult: null,
};
}

async function addCard(card) {
const db = await openDB();
const item = {
id: uid("card"),
folderId: card.folderId ?? null,
subject: card.subject ?? null,
question: card.question || "",
answer: card.answer || "",
explanation: card.explanation || "",
notes: card.notes || "",
mnemonic: card.mnemonic || "",
tags: Array.isArray(card.tags) ? card.tags : [],
starred: !!card.starred,
important: !!card.important,
imageId: card.imageId || null,
status: card.status || "active",
srs: card.srs || freshSRS(),
createdAt: Date.now(),
updatedAt: Date.now(),
};

const t = db.transaction("cards", "readwrite");
t.objectStore("cards").add(item);
await new Promise((res, rej) => { t.oncomplete = res; t.onerror = () => rej(t.error); });
return item;
}

async function updateCard(card) {
const db = await openDB();
card.updatedAt = Date.now();
const t = db.transaction("cards", "readwrite");
t.objectStore("cards").put(card);
await new Promise((res, rej) => { t.oncomplete = res; t.onerror = () => rej(t.error); });
return card;
}

async function deleteCard(id) {
const db = await openDB();
const t = db.transaction("cards", "readwrite");
t.objectStore("cards").delete(id);
await new Promise((res, rej) => { t.oncomplete = res; t.onerror = () => rej(t.error); });
}

async function getCard(id) {
const db = await openDB();
const t = db.transaction("cards", "readonly");
return reqToPromise(t.objectStore("cards").get(id));
}

async function getAllCards() {
const db = await openDB();
const t = db.transaction("cards", "readonly");
return reqToPromise(t.objectStore("cards").getAll());
}

async function getCardsInFolder(folderId) {
const all = await getAllCards();
return all.filter((c) => c.folderId === folderId);
}

async function getCardsInFolders(folderIds) {
const set = new Set(folderIds);
const all = await getAllCards();
return all.filter((c) => set.has(c.folderId));
}

async function bulkAddCards(folderId, pairs, subject = null) {
const added = [];
for (const p of pairs) {
added.push(await addCard({
folderId,
subject,
question: p.question,
answer: p.answer,
}));
}
return added;
}

/* ---------------------------
Media
---------------------------- */

async function addMedia(media) {
const db = await openDB();
const item = {
id: uid("med"),
folderId: media.folderId ?? null,
cardId: media.cardId ?? null,
subject: media.subject ?? null,
kind: media.kind || "image", // image | mindmap | diagram
name: media.name || "Untitled",
mime: media.mime || "application/octet-stream",
dataUrl: media.dataUrl || "",
notes: media.notes || "",
createdAt: Date.now(),
updatedAt: Date.now(),
};
const t = db.transaction("media", "readwrite");
t.objectStore("media").add(item);
await new Promise((res, rej) => { t.oncomplete = res; t.onerror = () => rej(t.error); });
return item;
}

async function updateMedia(media) {
const db = await openDB();
media.updatedAt = Date.now();
const t = db.transaction("media", "readwrite");
t.objectStore("media").put(media);
await new Promise((res, rej) => { t.oncomplete = res; t.onerror = () => rej(t.error); });
return media;
}

async function deleteMedia(id) {
const db = await openDB();
const t = db.transaction("media", "readwrite");
t.objectStore("media").delete(id);
await new Promise((res, rej) => { t.oncomplete = res; t.onerror = () => rej(t.error); });
}

async function getMedia(id) {
const db = await openDB();
const t = db.transaction("media", "readonly");
return reqToPromise(t.objectStore("media").get(id));
}

async function getAllMedia() {
const db = await openDB();
const t = db.transaction("media", "readonly");
return reqToPromise(t.objectStore("media").getAll());
}

async function getMediaInFolder(folderId) {
const all = await getAllMedia();
return all.filter((m) => m.folderId === folderId);
}

async function getMediaForCard(cardId) {
const all = await getAllMedia();
return all.filter((m) => m.cardId === cardId);
}

/* ---------------------------
PDFs
---------------------------- */

async function addPdf(pdf) {
const db = await openDB();
const item = {
id: uid("pdf"),
folderId: pdf.folderId ?? null,
subject: pdf.subject ?? null,
name: pdf.name || "Untitled PDF",
mime: pdf.mime || "application/pdf",
dataUrl: pdf.dataUrl || "",
notes: pdf.notes || "",
createdAt: Date.now(),
updatedAt: Date.now(),
};
const t = db.transaction("pdfs", "readwrite");
t.objectStore("pdfs").add(item);
await new Promise((res, rej) => { t.oncomplete = res; t.onerror = () => rej(t.error); });
return item;
}

async function updatePdf(pdf) {
const db = await openDB();
pdf.updatedAt = Date.now();
const t = db.transaction("pdfs", "readwrite");
t.objectStore("pdfs").put(pdf);
await new Promise((res, rej) => { t.oncomplete = res; t.onerror = () => rej(t.error); });
return pdf;
}

async function deletePdf(id) {
const db = await openDB();
const t = db.transaction("pdfs", "readwrite");
t.objectStore("pdfs").delete(id);
await new Promise((res, rej) => { t.oncomplete = res; t.onerror = () => rej(t.error); });
}

async function getPdf(id) {
const db = await openDB();
const t = db.transaction("pdfs", "readonly");
return reqToPromise(t.objectStore("pdfs").get(id));
}

async function getAllPdfs() {
const db = await openDB();
const t = db.transaction("pdfs", "readonly");
return reqToPromise(t.objectStore("pdfs").getAll());
}

async function getPdfsInFolder(folderId) {
const all = await getAllPdfs();
return all.filter((p) => p.folderId === folderId);
}

/* ---------------------------
Notes
---------------------------- */

async function addNote(note) {
const db = await openDB();
const item = {
id: uid("note"),
folderId: note.folderId ?? null,
subject: note.subject ?? null,
title: note.title || "Untitled Note",
body: note.body || "",
createdAt: Date.now(),
updatedAt: Date.now(),
};
const t = db.transaction("notes", "readwrite");
t.objectStore("notes").add(item);
await new Promise((res, rej) => { t.oncomplete = res; t.onerror = () => rej(t.error); });
return item;
}

async function updateNote(note) {
const db = await openDB();
note.updatedAt = Date.now();
const t = db.transaction("notes", "readwrite");
t.objectStore("notes").put(note);
await new Promise((res, rej) => { t.oncomplete = res; t.onerror = () => rej(t.error); });
return note;
}

async function deleteNote(id) {
const db = await openDB();
const t = db.transaction("notes", "readwrite");
t.objectStore("notes").delete(id);
await new Promise((res, rej) => { t.oncomplete = res; t.onerror = () => rej(t.error); });
}

async function getAllNotes() {
const db = await openDB();
const t = db.transaction("notes", "readonly");
return reqToPromise(t.objectStore("notes").getAll());
}

/* ---------------------------
Stats
---------------------------- */

async function addStat(stat) {
const db = await openDB();
const item = {
id: uid("stat"),
scopeType: stat.scopeType || "app", // app | subject | folder | chapter | card
scopeId: stat.scopeId ?? "app",
data: stat.data || {},
createdAt: Date.now(),
updatedAt: Date.now(),
};
const t = db.transaction("stats", "readwrite");
t.objectStore("stats").add(item);
await new Promise((res, rej) => { t.oncomplete = res; t.onerror = () => rej(t.error); });
return item;
}

async function updateStat(stat) {
const db = await openDB();
stat.updatedAt = Date.now();
const t = db.transaction("stats", "readwrite");
t.objectStore("stats").put(stat);
await new Promise((res, rej) => { t.oncomplete = res; t.onerror = () => rej(t.error); });
return stat;
}

async function deleteStat(id) {
const db = await openDB();
const t = db.transaction("stats", "readwrite");
t.objectStore("stats").delete(id);
await new Promise((res, rej) => { t.oncomplete = res; t.onerror = () => rej(t.error); });
}

async function getAllStats() {
const db = await openDB();
const t = db.transaction("stats", "readonly");
return reqToPromise(t.objectStore("stats").getAll());
}

async function getStatsByScope(scopeType, scopeId) {
const all = await getAllStats();
return all.filter((s) => s.scopeType === scopeType && s.scopeId === scopeId);
}

/* ---------------------------
Settings / Meta
---------------------------- */

async function setSetting(key, value) {
const db = await openDB();
const t = db.transaction("settings", "readwrite");
t.objectStore("settings").put({ key, value });
await new Promise((res, rej) => { t.oncomplete = res; t.onerror = () => rej(t.error); });
return value;
}

async function getSetting(key, fallback = null) {
const db = await openDB();
const t = db.transaction("settings", "readonly");
const result = await reqToPromise(t.objectStore("settings").get(key));
return result ? result.value : fallback;
}

async function setMeta(key, value) {
const db = await openDB();
const t = db.transaction("meta", "readwrite");
t.objectStore("meta").put({ key, value });
await new Promise((res, rej) => { t.oncomplete = res; t.onerror = () => rej(t.error); });
return value;
}

async function getMeta(key, fallback = null) {
const db = await openDB();
const t = db.transaction("meta", "readonly");
const result = await reqToPromise(t.objectStore("meta").get(key));
return result ? result.value : fallback;
}

/* ---------------------------
Export / import helpers
---------------------------- */

async function exportAll() {
return {
version: 1,
exportedAt: new Date().toISOString(),
folders: await getAllFolders(),
cards: await getAllCards(),
media: await getAllMedia(),
pdfs: await getAllPdfs(),
notes: await getAllNotes(),
stats: await getAllStats(),
settings: await getAllSettings(),
meta: await getAllMeta(),
};
}

async function getAllSettings() {
const db = await openDB();
const t = db.transaction("settings", "readonly");
return reqToPromise(t.objectStore("settings").getAll());
}

async function getAllMeta() {
const db = await openDB();
const t = db.transaction("meta", "readonly");
return reqToPromise(t.objectStore("meta").getAll());
}

async function clearStore(storeName) {
const db = await openDB();
const t = db.transaction(storeName, "readwrite");
t.objectStore(storeName).clear();
await new Promise((res, rej) => { t.oncomplete = res; t.onerror = () => rej(t.error); });
}

async function wipeAll() {
await clearStore("folders");
await clearStore("cards");
await clearStore("media");
await clearStore("pdfs");
await clearStore("notes");
await clearStore("stats");
await clearStore("settings");
await clearStore("meta");
}

window.DB = {
openDB,
uid,
todayStr,
getFolder,
getAllFolders,
getSubfolders,
getAllDescendantFolderIds,
addFolder,
updateFolder,
deleteFolder,

getCard,
getAllCards,
getCardsInFolder,
getCardsInFolders,
addCard,
updateCard,
deleteCard,
bulkAddCards,
freshSRS,

getMedia,
getAllMedia,
getMediaInFolder,
getMediaForCard,
addMedia,
updateMedia,
deleteMedia,

getPdf,
getAllPdfs,
getPdfsInFolder,
addPdf,
updatePdf,
deletePdf,

getAllNotes,
addNote,
updateNote,
deleteNote,

getAllStats,
getStatsByScope,
addStat,
updateStat,
deleteStat,

setSetting,
getSetting,
setMeta,
getMeta,

exportAll,
getAllSettings,
getAllMeta,
clearStore,
wipeAll,
};
   
