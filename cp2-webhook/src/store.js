
const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, '..', 'data');
const DB_FILE = path.join(DATA_DIR, 'db.json');

function ensureDB() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  if (!fs.existsSync(DB_FILE)) {
    fs.writeFileSync(DB_FILE, JSON.stringify({ chamados: [], agendamentos: [], pedidos: [] }, null, 2));
  }
}

function readDB() {
  ensureDB();
  try {
    const raw = fs.readFileSync(DB_FILE, 'utf-8');
    return JSON.parse(raw);
  } catch (e) {
    return { chamados: [], agendamentos: [], pedidos: [] };
  }
}

function writeDB(db) {
  ensureDB();
  fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2));
}

function addChamado(chamado) {
  const db = readDB();
  db.chamados.push(chamado);
  writeDB(db);
  return chamado;
}

function getChamadoByProtocolo(protocolo) {
  const db = readDB();
  return db.chamados.find(c => c.protocolo === protocolo);
}

function addAgendamento(ag) {
  const db = readDB();
  db.agendamentos.push(ag);
  writeDB(db);
  return ag;
}

function addPedido(ped) {
  const db = readDB();
  db.pedidos.push(ped);
  writeDB(db);
  return ped;
}

function readAll() {
  return readDB();
}

module.exports = {
  addChamado,
  getChamadoByProtocolo,
  addAgendamento,
  addPedido,
  readAll
};
