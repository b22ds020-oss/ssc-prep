/* flashcards.js
Flashcard CRUD + folder-based browsing
*/

async function renderFlashcards(folderId = null) {
const list = document.getElementById("flashcardList");
if (!list) return;

const cards = folderId
? await DB.getCardsInFolder(folderId)
: await DB.getAllCards();

if (!cards.length) {
list.innerHTML = `<div class="empty-state">No flashcards yet.</div>`;
return;
}

list.innerHTML = cards.map((card) => cardCardHtml(card)).join("");

list.querySelectorAll("[data-card-id]").forEach((node) => {
node.addEventListener("click", () => openCardModal(node.dataset.cardId));
});
}

function cardCardHtml(card) {
const srs = card.srs || {};
const status = srs.status || "new";
const badge = status === "mastered" ? "badge-mastered" : status === "review" ? "badge-review" : "badge-new";

return `     <div class="card item-card flashcard-card" data-card-id="${card.id}">       <div class="item-top">         <div class="item-title">${escapeHTML(card.question || "")}</div>         <div class="item-badges">
          ${card.starred ? '<span class="chip">⭐</span>' : ""}
          ${card.important ? '<span class="chip">★</span>' : ""}           <span class="chip ${badge}">${escapeHTML(status)}</span>         </div>       </div>       <div class="item-sub">${escapeHTML(card.answer || "")}</div>     </div>
  `;
}

async function createFlashcard(folderId = null, subject = null) {
const question = prompt("Question:");
if (!question) return;

const answer = prompt("Answer:");
if (answer === null) return;

const card = await DB.addCard({
folderId,
subject,
question,
answer,
});

showToast("Flashcard created");
await renderFlashcards(folderId);
return card;
}

async function editFlashcard(cardId) {
const card = await DB.getCard(cardId);
if (!card) return;

const question = prompt("Edit question:", card.question || "");
if (question === null) return;

const answer = prompt("Edit answer:", card.answer || "");
if (answer === null) return;

card.question = question;
card.answer = answer;
await DB.updateCard(card);

showToast("Flashcard updated");
await renderFlashcards(card.folderId);
}

async function deleteFlashcard(cardId) {
const card = await DB.getCard(cardId);
if (!card) return;

const ok = confirm("Delete this flashcard?");
if (!ok) return;

await DB.deleteCard(cardId);
showToast("Flashcard deleted");
await renderFlashcards(card.folderId);
}

async function toggleStar(cardId) {
const card = await DB.getCard(cardId);
if (!card) return;

card.starred = !card.starred;
await DB.updateCard(card);
showToast(card.starred ? "Marked starred" : "Star removed");
await renderFlashcards(card.folderId);
}

async function toggleImportant(cardId) {
const card = await DB.getCard(cardId);
if (!card) return;

card.important = !card.important;
await DB.updateCard(card);
showToast(card.important ? "Marked important" : "Important removed");
await renderFlashcards(card.folderId);
}

async function attachImageToCard(cardId, file) {
const card = await DB.getCard(cardId);
if (!card || !file) return;

const dataUrl = await fileToDataUrl(file);
const media = await DB.addMedia({
cardId: card.id,
folderId: card.folderId,
subject: card.subject,
kind: "image",
name: file.name,
mime: file.type,
dataUrl,
});

card.imageId = media.id;
await DB.updateCard(card);
showToast("Image attached to flashcard");
return media;
}

async function openCardModal(cardId) {
const card = await DB.getCard(cardId);
if (!card) return;

const attachedMedia = card.imageId ? await DB.getMedia(card.imageId) : null;

UI.openModal(` <div class="modal-head"> <h3>Flashcard</h3> <button class="icon-btn" id="closeCardModal">✕</button> </div>

```
<div class="modal-body">
  <div class="modal-card-block">
    <div class="label">Question</div>
    <div class="value">${escapeHTML(card.question || "")}</div>
  </div>

  <div class="modal-card-block">
    <div class="label">Answer</div>
    <div class="value">${escapeHTML(card.answer || "")}</div>
  </div>

  ${attachedMedia ? `
    <div class="modal-card-block">
      <div class="label">Attached Image</div>
      <img class="attached-preview" src="${attachedMedia.dataUrl}" alt="${escapeHTML(attachedMedia.name)}" />
    </div>
  ` : ""}

  <div class="modal-card-actions">
    <button class="btn btn-sm" id="editCardBtn">Edit</button>
    <button class="btn btn-sm" id="starCardBtn">${card.starred ? "Unstar" : "Star"}</button>
    <button class="btn btn-sm" id="importantCardBtn">${card.important ? "Unmark Important" : "Mark Important"}</button>
    <label class="btn btn-sm" for="attachCardImage">Attach Image</label>
    <input type="file" id="attachCardImage" accept="image/*" hidden />
    <button class="btn btn-danger btn-sm" id="deleteCardBtn">Delete</button>
  </div>
</div>
```

`);

document.getElementById("closeCardModal")?.addEventListener("click", UI.closeModal);
document.getElementById("editCardBtn")?.addEventListener("click", async () => {
UI.closeModal();
await editFlashcard(cardId);
});
document.getElementById("starCardBtn")?.addEventListener("click", async () => {
await toggleStar(cardId);
UI.closeModal();
await openCardModal(cardId);
});
document.getElementById("importantCardBtn")?.addEventListener("click", async () => {
await toggleImportant(cardId);
UI.closeModal();
await openCardModal(cardId);
});
document.getElementById("deleteCardBtn")?.addEventListener("click", async () => {
UI.closeModal();
await deleteFlashcard(cardId);
});

document.getElementById("attachCardImage")?.addEventListener("change", async (e) => {
const file = e.target.files?.[0];
if (!file) return;
await attachImageToCard(cardId, file);
UI.closeModal();
await openCardModal(cardId);
});
}

window.Flashcards = {
renderFlashcards,
createFlashcard,
editFlashcard,
deleteFlashcard,
toggleStar,
toggleImportant,
attachImageToCard,
openCardModal,
};
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
