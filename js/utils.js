/* utils.js
Shared utility helpers for SSC Prep v2.0
*/

function escapeHTML(value = "") {
return String(value)
.replace(/&/g, "&")
.replace(/</g, "<")
.replace(/>/g, ">")
.replace(/"/g, """)
.replace(/'/g, "'");
}

function clamp(value, min, max) {
return Math.min(max, Math.max(min, value));
}

function formatDate(dateInput) {
const d = dateInput instanceof Date ? dateInput : new Date(dateInput);
if (Number.isNaN(d.getTime())) return "";
return d.toLocaleDateString(undefined, {
year: "numeric",
month: "short",
day: "numeric"
});
}

function formatDateTime(dateInput) {
const d = dateInput instanceof Date ? dateInput : new Date(dateInput);
if (Number.isNaN(d.getTime())) return "";
return d.toLocaleString(undefined, {
year: "numeric",
month: "short",
day: "numeric",
hour: "2-digit",
minute: "2-digit"
});
}

function toDateInputValue(dateInput) {
const d = dateInput instanceof Date ? dateInput : new Date(dateInput);
if (Number.isNaN(d.getTime())) return "";
const yyyy = d.getFullYear();
const mm = String(d.getMonth() + 1).padStart(2, "0");
const dd = String(d.getDate()).padStart(2, "0");
return `${yyyy}-${mm}-${dd}`;
}

function randomChoice(list = []) {
if (!Array.isArray(list) || list.length === 0) return null;
return list[Math.floor(Math.random() * list.length)];
}

function shuffleArray(input = []) {
const arr = [...input];
for (let i = arr.length - 1; i > 0; i--) {
const j = Math.floor(Math.random() * (i + 1));
[arr[i], arr[j]] = [arr[j], arr[i]];
}
return arr;
}

function debounce(fn, delay = 200) {
let t = null;
return function (...args) {
clearTimeout(t);
t = setTimeout(() => fn.apply(this, args), delay);
};
}

function uid(prefix = "id") {
return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 9)}`;
}

function isImageMime(mime = "") {
return /^image//i.test(mime);
}

function isPdfMime(mime = "") {
return mime === "application/pdf" || mime === "application/x-pdf";
}

function fileToDataUrl(file) {
return new Promise((resolve, reject) => {
const reader = new FileReader();
reader.onload = () => resolve(reader.result);
reader.onerror = () => reject(reader.error);
reader.readAsDataURL(file);
});
}

function dataUrlToBlob(dataUrl) {
const [header, base64] = dataUrl.split(",");
const mimeMatch = header.match(/data:(.*?);base64/);
const mime = mimeMatch ? mimeMatch[1] : "application/octet-stream";
const byteString = atob(base64 || "");
const len = byteString.length;
const array = new Uint8Array(len);
for (let i = 0; i < len; i++) array[i] = byteString.charCodeAt(i);
return new Blob([array], { type: mime });
}

function downloadText(filename, text) {
const blob = new Blob([text], { type: "text/plain;charset=utf-8" });
const url = URL.createObjectURL(blob);
const a = document.createElement("a");
a.href = url;
a.download = filename;
document.body.appendChild(a);
a.click();
a.remove();
URL.revokeObjectURL(url);
}

function downloadJSON(filename, data) {
downloadText(filename, JSON.stringify(data, null, 2));
}

function ensureArray(value) {
if (Array.isArray(value)) return value;
if (value === null || value === undefined) return [];
return [value];
}

function byId(id) {
return document.getElementById(id);
}

function setHidden(el, hidden = true) {
if (!el) return;
el.hidden = hidden;
}

window.Utils = {
escapeHTML,
clamp,
formatDate,
formatDateTime,
toDateInputValue,
randomChoice,
shuffleArray,
debounce,
uid,
isImageMime,
isPdfMime,
fileToDataUrl,
dataUrlToBlob,
downloadText,
downloadJSON,
ensureArray,
byId,
setHidden
};

