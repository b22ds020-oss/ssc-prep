/* seed.js — first-run data: default folder tree + the Mughal Empire starter deck */

const SEED_MUGHAL_CARDS = [
  { q: "Who was given the charge of looking after the imperial household during the Mughal administration?", a: "Mir Saman" },
  { q: "Name the French jeweller who traveled to India at least six times during the Mughal period.", a: "Jean-Baptiste Tavernier" },
  { q: "Who built the Pathar Ki Masjid in Patna, Bihar?", a: "Parwez Shah" },
  { q: "The real name of Babur, the founder of Mughal dynasty in India was:", a: "Zahiruddin Muhammad" },
  { q: "The Mughal emperor, Babur was a devotee of the _______ Sufi Silsila.", a: "Naqshbandi" },
  { q: "Who among the following Mughal Emperors had assumed the title of Padshah?", a: "Babur" },
  { q: "The First Battle of Panipat (1526) marked the beginning of:", a: "Mughal's rule in India" },
  { q: "The last Mughal emperor of India was:", a: "Bahadur Shah II" },
  { q: "After years of wandering Babur seized Kabul in _________.", a: "1504" },
  { q: "Which of the following battles was fought between Babur and Rana Sanga in 1527?", a: "Battle of Khanwa" },
];

const DEFAULT_TREE = [
  { name: "History", children: [
    { name: "Ancient History", children: [] },
    { name: "Medieval History", children: [
      { name: "Mughal Empire", children: [] },
      { name: "Delhi Sultanate", children: [] },
      { name: "Bhakti Movement", children: [] },
      { name: "Vijayanagara Empire", children: [] },
    ]},
    { name: "Modern History", children: [] },
  ]},
  { name: "Polity", children: [] },
  { name: "Geography", children: [] },
  { name: "Economy", children: [] },
  { name: "Science", children: [] },
  { name: "Static GK", children: [] },
];

async function createTree(nodes, parentId) {
  for (const node of nodes) {
    const folder = await DB.addFolder({ name: node.name, parentId });
    if (node.children && node.children.length) {
      await createTree(node.children, folder.id);
    }
    if (node.name === "Mughal Empire") {
      window.__mughalFolderId = folder.id;
    }
  }
}

async function seedIfEmpty() {
  const existing = await DB.getAllFolders();
  if (existing.length > 0) return; // already initialised

  await createTree(DEFAULT_TREE, null);

  if (window.__mughalFolderId) {
    await DB.bulkAddCards(
      window.__mughalFolderId,
      SEED_MUGHAL_CARDS.map((c) => ({ question: c.q, answer: c.a }))
    );
  }
}

window.Seed = { seedIfEmpty };
