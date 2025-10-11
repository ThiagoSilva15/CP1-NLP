import fs from "fs-extra";

const DB_PATH = process.env.DB_PATH || "./data/data.json";

export async function loadDB() {
  try {
    return await fs.readJSON(DB_PATH);
  } catch {
    return { orders: [], appointments: [], tickets: [] };
  }
}

export async function saveRecord(collection, record) {
  const db = await loadDB();
  if (!db[collection]) db[collection] = [];
  db[collection].push({ ...record, createdAt: new Date().toISOString() });
  await fs.ensureFile(DB_PATH);
  await fs.writeJSON(DB_PATH, db, { spaces: 2 });
  return record;
}
