/* db.js — IndexedDB wrapper for SSC CGL Flashcards
   Stores: folders, cards, meta
*/
const DB_NAME = "sscFlashcardsDB";
const DB_VERSION = 1;
let _db = null;

function openDB() {
  return new Promise((resolve, reject) => {
    if (_db) return resolve(_db);
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = (e) => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains("folders")) {
        const fs = db.createObjectStore("folders", { keyPath: "id" });
        fs.createIndex("parentId", "parentId", { unique: false });
      }
      if (!db.objectStoreNames.contains("cards")) {
        const cs = db.createObjectStore("cards", { keyPath: "id" });
        cs.createIndex("folderId", "folderId", { unique: false });
        cs.createIndex("dueDate", "dueDate", { unique: false });
        cs.createIndex("starred", "starred", { unique: false });
        cs.createIndex("difficult", "difficult", { unique: false });
      }
      if (!db.objectStoreNames.contains("meta")) {
        db.createObjectStore("meta", { keyPath: "key" });
      }
    };
    req.onsuccess = (e) => { _db = e.target.result; resolve(_db); };
    req.onerror = (e) => reject(e.target.error);
  });
}

function tx(storeNames, mode = "readonly") {
  return openDB().then((db) => db.transaction(storeNames, mode));
}

function uid(prefix = "id") {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 9)}`;
}

// ---------- Generic helpers ----------
function reqToPromise(req) {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

// ---------- Folders ----------
async function addFolder({ name, parentId = null }) {
  const db = await openDB();
  const folder = { id: uid("fld"), name, parentId, createdAt: Date.now() };
  const t = db.transaction("folders", "readwrite");
  t.objectStore("folders").add(folder);
  await new Promise((res, rej) => { t.oncomplete = res; t.onerror = () => rej(t.error); });
  return folder;
}

async function updateFolder(folder) {
  const db = await openDB();
  const t = db.transaction("folders", "readwrite");
  t.objectStore("folders").put(folder);
  await new Promise((res, rej) => { t.oncomplete = res; t.onerror = () => rej(t.error); });
  return folder;
}

async function getAllFolders() {
  const db = await openDB();
  const t = db.transaction("folders", "readonly");
  return reqToPromise(t.objectStore("folders").getAll());
}

async function getFolder(id) {
  const db = await openDB();
  const t = db.transaction("folders", "readonly");
  return reqToPromise(t.objectStore("folders").get(id));
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
    result.push(cur);
    all.filter((f) => f.parentId === cur).forEach((f) => stack.push(f.id));
  }
  return result;
}

async function deleteFolder(id) {
  const idsToDelete = await getAllDescendantFolderIds(id);
  const db = await openDB();
  const t = db.transaction(["folders", "cards"], "readwrite");
  const folderStore = t.objectStore("folders");
  const cardStore = t.objectStore("cards");
  const cardIdx = cardStore.index("folderId");
  for (const fid of idsToDelete) {
    folderStore.delete(fid);
    const cursorReq = cardIdx.openCursor(IDBKeyRange.only(fid));
    await new Promise((resolve, reject) => {
      cursorReq.onsuccess = (e) => {
        const cursor = e.target.result;
        if (cursor) {
          cardStore.delete(cursor.primaryKey);
          cursor.continue();
        } else resolve();
      };
      cursorReq.onerror = () => reject(cursorReq.error);
    });
  }
  await new Promise((res, rej) => { t.oncomplete = res; t.onerror = () => rej(t.error); });
}

// ---------- Cards ----------
function freshSRS() {
  return { status: "new", interval: 0, ease: 2.5, reps: 0, lapses: 0, dueDate: todayStr(), lastResult: null };
}

function todayStr(offsetDays = 0) {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  return d.toISOString().slice(0, 10);
}

async function addCard(card) {
  const db = await openDB();
  const full = {
    id: uid("card"),
    folderId: card.folderId,
    question: card.question || "",
    answer: card.answer || "",
    notes: card.notes || "",
    mnemonic: card.mnemonic || "",
    tags: card.tags || [],
    starred: false,
    difficult: false,
    srs: freshSRS(),
    createdAt: Date.now(),
  };
  const t = db.transaction("cards", "readwrite");
  t.objectStore("cards").add(full);
  await new Promise((res, rej) => { t.oncomplete = res; t.onerror = () => rej(t.error); });
  return full;
}

async function bulkAddCards(folderId, pairs) {
  const db = await openDB();
  const t = db.transaction("cards", "readwrite");
  const store = t.objectStore("cards");
  const added = [];
  for (const p of pairs) {
    const full = {
      id: uid("card"),
      folderId,
      question: p.question,
      answer: p.answer,
      notes: "",
      mnemonic: "",
      tags: [],
      starred: false,
      difficult: false,
      srs: freshSRS(),
      createdAt: Date.now(),
    };
    store.add(full);
    added.push(full);
  }
  await new Promise((res, rej) => { t.oncomplete = res; t.onerror = () => rej(t.error); });
  return added;
}

async function updateCard(card) {
  const db = await openDB();
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

async function getAllCards() {
  const db = await openDB();
  const t = db.transaction("cards", "readonly");
  return reqToPromise(t.objectStore("cards").getAll());
}

async function getCardsInFolders(folderIds) {
  const all = await getAllCards();
  const set = new Set(folderIds);
  return all.filter((c) => set.has(c.folderId));
}

async function countCardsInFolders(folderIds) {
  const cards = await getCardsInFolders(folderIds);
  return cards.length;
}

// ---------- Meta (streak, theme, activity log) ----------
async function getMeta(key, fallback = null) {
  const db = await openDB();
  const t = db.transaction("meta", "readonly");
  const rec = await reqToPromise(t.objectStore("meta").get(key));
  return rec ? rec.value : fallback;
}

async function setMeta(key, value) {
  const db = await openDB();
  const t = db.transaction("meta", "readwrite");
  t.objectStore("meta").put({ key, value });
  await new Promise((res, rej) => { t.oncomplete = res; t.onerror = () => rej(t.error); });
}

// ---------- Export / Import ----------
async function exportAll() {
  const [folders, cards] = await Promise.all([getAllFolders(), getAllCards()]);
  const streak = await getMeta("streak", { count: 0, lastDate: null });
  const activity = await getMeta("activity", {});
  return {
    version: 1,
    exportedAt: new Date().toISOString(),
    folders,
    cards,
    streak,
    activity,
  };
}

async function importAll(data, { merge = false } = {}) {
  const db = await openDB();
  const t = db.transaction(["folders", "cards", "meta"], "readwrite");
  if (!merge) {
    t.objectStore("folders").clear();
    t.objectStore("cards").clear();
  }
  (data.folders || []).forEach((f) => t.objectStore("folders").put(f));
  (data.cards || []).forEach((c) => t.objectStore("cards").put(c));
  if (data.streak) t.objectStore("meta").put({ key: "streak", value: data.streak });
  if (data.activity) t.objectStore("meta").put({ key: "activity", value: data.activity });
  await new Promise((res, rej) => { t.oncomplete = res; t.onerror = () => rej(t.error); });
}

window.DB = {
  openDB, uid, todayStr,
  addFolder, updateFolder, getAllFolders, getFolder, getSubfolders, deleteFolder, getAllDescendantFolderIds,
  addCard, bulkAddCards, updateCard, deleteCard, getAllCards, getCardsInFolders, countCardsInFolders,
  getMeta, setMeta,
  exportAll, importAll,
};
