/* media.js
Image and mindmap uploads for SSC Prep v2.0
*/

async function renderMedia(folderId = null) {
const imageList = document.getElementById("imageList");
const mindmapList = document.getElementById("mindmapList");
if (!imageList || !mindmapList) return;

const media = folderId
? (await DB.getAllMedia()).filter((m) => m.folderId === folderId)
: await DB.getAllMedia();

const images = media.filter((m) => m.kind === "image");
const mindmaps = media.filter((m) => m.kind === "mindmap" || m.kind === "diagram");

imageList.innerHTML = images.length
? images.map(mediaCardHtml).join("")
: `<div class="empty-state">No images yet.</div>`;

mindmapList.innerHTML = mindmaps.length
? mindmaps.map(mediaCardHtml).join("")
: `<div class="empty-state">No mindmaps yet.</div>`;

wireMediaClicks();
}

function mediaCardHtml(item) {
return `     <div class="card item-card media-card" data-media-id="${item.id}">       <img src="${item.dataUrl}" alt="${escapeHTML(item.name || "media")}" />       <div class="item-title">${escapeHTML(item.name || "Untitled")}</div>       <div class="item-sub">${escapeHTML(item.kind || "media")}</div>     </div>
  `;
}

function wireMediaClicks() {
document.querySelectorAll("[data-media-id]").forEach((node) => {
node.addEventListener("click", async () => {
const media = await DB.getMedia(node.dataset.mediaId);
if (!media) return;
openMediaModal(media.id);
});
});
}

async function addMediaToFolder(folderId = null, kind = "image") {
const input = document.createElement("input");
input.type = "file";
input.accept = kind === "image" ? "image/*" : "image/*";
input.click();

input.addEventListener("change", async () => {
const file = input.files?.[0];
if (!file) return;

```
const dataUrl = await fileToDataUrl(file);
await DB.addMedia({
  folderId,
  subject: null,
  cardId: null,
  kind,
  name: file.name,
  mime: file.type,
  dataUrl,
});

showToast(`${kind === "mindmap" ? "Mindmap" : "Image"} uploaded`);
await renderMedia(folderId);
```

});
}

async function attachImageToFlashcard(cardId) {
const card = await DB.getCard(cardId);
if (!card) return;

const input = document.createElement("input");
input.type = "file";
input.accept = "image/*";
input.click();

input.addEventListener("change", async () => {
const file = input.files?.[0];
if (!file) return;

```
const dataUrl = await fileToDataUrl(file);
const media = await DB.addMedia({
  folderId: card.folderId,
  cardId: card.id,
  subject: card.subject,
  kind: "image",
  name: file.name,
  mime: file.type,
  dataUrl,
});

card.imageId = media.id;
await DB.updateCard(card);
showToast("Image attached to flashcard");
```

});
}

async function openMediaModal(mediaId) {
const media = await DB.getMedia(mediaId);
if (!media) return;

UI.openModal(`     <div class="modal-head">       <h3>${escapeHTML(media.name || "Media")}</h3>       <button class="icon-btn" id="closeMediaModal">✕</button>     </div>     <div class="modal-body">       <img class="media-modal-preview" src="${media.dataUrl}" alt="${escapeHTML(media.name || "media")}" />       <div class="modal-card-actions">         <button class="btn btn-sm" id="downloadMediaBtn">Download</button>         <button class="btn btn-danger btn-sm" id="deleteMediaBtn">Delete</button>       </div>     </div>
  `);

document.getElementById("closeMediaModal")?.addEventListener("click", UI.closeModal);
document.getElementById("downloadMediaBtn")?.addEventListener("click", () => {
const a = document.createElement("a");
a.href = media.dataUrl;
a.download = media.name || "media";
a.click();
});
document.getElementById("deleteMediaBtn")?.addEventListener("click", async () => {
await DB.deleteMedia(media.id);
UI.closeModal();
showToast("Media deleted");
});
}

window.Media = {
renderMedia,
addMediaToFolder,
attachImageToFlashcard,
openMediaModal
};

