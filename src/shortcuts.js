const fs = require("fs");
const path = require("path");

const STORE_DIR = path.resolve(__dirname, "..", "data");
const STORE_FILE = path.join(STORE_DIR, "shortcuts.json");

function ensureStore() {
  if (!fs.existsSync(STORE_DIR)) {
    fs.mkdirSync(STORE_DIR, {recursive: true});
  }
  if (!fs.existsSync(STORE_FILE)) {
    fs.writeFileSync(STORE_FILE, "[]", "utf8");
  }
}

function readAll() {
  ensureStore();
  try {
    const raw = fs.readFileSync(STORE_FILE, "utf8");
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (err) {
    return [];
  }
}

/**
 *
 * @param {any[]} data
 */
function writeAll(data) {
  ensureStore();
  fs.writeFileSync(STORE_FILE, JSON.stringify(data, null, 2), "utf8");
}

function createId() {
  return `${Date.now()}_${Math.random().toString(16).slice(2, 10)}`;
}

function listShortcuts() {
  return readAll();
}

/**
 *
 * @param {string} name
 * @param {string} command
 */
function createShortcut(name, command) {
  const now = new Date().toISOString();
  const all = readAll();
  const item = {
    id: createId(),
    name,
    command,
    createdAt: now,
    updatedAt: now,
  };
  all.push(item);
  writeAll(all);
  return item;
}

/**
 *
 * @param {string} id
 * @param {string} name
 * @param {string} command
 */
function updateShortcut(id, name, command) {
  const all = readAll();
  const index = all.findIndex((item) => item.id === id);
  if (index < 0) {
    return null;
  }
  const updated = {
    ...all[index],
    name,
    command,
    updatedAt: new Date().toISOString(),
  };
  all[index] = updated;
  writeAll(all);
  return updated;
}

/**
 *
 * @param {string} id
 */
function deleteShortcut(id) {
  const all = readAll();
  const index = all.findIndex((item) => item.id === id);
  if (index < 0) {
    return false;
  }
  all.splice(index, 1);
  writeAll(all);
  return true;
}

module.exports = {
  listShortcuts,
  createShortcut,
  updateShortcut,
  deleteShortcut,
};
