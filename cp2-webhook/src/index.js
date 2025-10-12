// cp2-webhook/src/index.js
import express from "express";
import helmet from "helmet";
import morgan from "morgan";
import cors from "cors";
import dotenv from "dotenv";
import { ulid } from "ulid";

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

import { buildText, buildTelegram, buildResponse } from "./lib/df.js";
import { handleRestaurant, handleClinic, handleSupport } from "./lib/handlers.js";

dotenv.config();

/* -------------------------------------------------------------------------- */
/*  Bootstrap do "banco" JSON (garante data/data.json)                        */
/* -------------------------------------------------------------------------- */
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
/** Caminho do arquivo (pode ser sobrescrito via env DB_PATH) */
const DB_PATH = path.resolve(process.env.DB_PATH || path.join(__dirname, "../data/data.json"));

function ensureDataFile() {
  const dir = path.dirname(DB_PATH);
  fs.mkdirSync(dir, { recursive: true });
  if (!fs.existsSync(DB_PATH)) {
    fs.writeFileSync(DB_PATH, "[]");
    console.log("📄 Criado data.json em", DB_PATH);
  }
}
ensureDataFile();

/** Utilitário para ler o último registro salvo (independe do tipo) */
function getLastRecord() {
  try {
    if (!fs.existsSync(DB_PATH)) return null;
    const raw = fs.readFileSync(DB_PATH, "utf8");
    if (!raw?.trim()) return null;
    const data = JSON.parse(raw);

    const pick = (r) => ({
      protocolo: r.protocolo || r.id || r.codigo || r.ticket || r.orderId || r.appointmentId || "",
      nome: r.nome || r.solicitante || r.cliente || "",
      prioridade: (r.prioridade || r.priority || "").toString(),
      resumo: r.problema || r.resumo || r.descricao || r.prato || r.tipo_consulta || "",
      tipo: r._type || r.tipo || r.kind || "",
      createdAt: r.createdAt || r.ts || r.time || null
    });

    if (Array.isArray(data) && data.length) return pick(data.at(-1));

    if (data && typeof data === "object") {
      const arrays = Object.values(data).filter(Array.isArray).filter(a => a.length);
      if (!arrays.length) return null;
      const lastItems = arrays.map(a => a.at(-1));
      lastItems.sort((a, b) => new Date(a.createdAt || a.ts || a.time || 0) - new Date(b.createdAt || b.ts || b.time || 0));
      return pick(lastItems.at(-1));
    }
    return null;
  } catch {
    return null;
  }
}

/* ---------- util: ler TODOS os registros e normalizar ---------- */
function readAllRecords() {
  try {
    if (!fs.existsSync(DB_PATH)) return [];
    const raw = fs.readFileSync(DB_PATH, "utf8");
    const json = raw?.trim() ? JSON.parse(raw) : [];

    const normalize = (r = {}) => ({
      createdAt: r.createdAt || r.ts || r.time || null,
      tipo: r._type || r.tipo || r.kind || "",
      protocolo: r.protocolo || r.id || r.codigo || r.ticket || r.orderId || r.appointmentId || "",
      nome: r.nome || r.solicitante || r.cliente || "",
      prioridade: (r.prioridade || r.priority || "").toString(),
      resumo: r.problema || r.resumo || r.descricao || r.prato || r.tipo_consulta || "",
      _raw: r
    });

    if (Array.isArray(json)) {
      return json.map(normalize);
    }
    if (json && typeof json === "object") {
      // suporta formato por coleções { support:[], orders:[], ... }
      const arrs = Object.values(json).filter(Array.isArray);
      return arrs.flat().map(normalize);
    }
    return [];
  } catch {
    return [];
  }
}

const esc = (s) =>
  String(s ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");

/* -------------------------------------------------------------------------- */
/*  App                                                                       */
/* -------------------------------------------------------------------------- */
const app = express();
const PORT = process.env.PORT || 3000;

app.use(helmet());
app.use(cors());
app.use(express.json({ limit: "1mb" }));
app.use(morgan("dev"));

/* ---------------------------------- HOME ---------------------------------- */
app.get("/", (req, res) => {
  const base = `${req.protocol}://${req.get("host")}`;
  const now = new Date().toLocaleString("pt-BR");
  res.type("html").send(`<!doctype html>
<html lang="pt-br"><meta charset="utf-8">
<title>SuporteNet • Webhook</title>
<meta name="viewport" content="width=device-width, initial-scale=1">
<style>
  :root{--bg:#0b0f1a;--fg:#e8ecf1;--muted:#a5b0c2;--brand:#7c5cff;--brand-2:#00e5ff;--ok:#22c55e;--card:#0f1524cc;--border:#24314a;--code:#0b1222;}
  *{box-sizing:border-box} html,body{height:100%}
  body{margin:0;color:var(--fg);background:radial-gradient(1200px 800px at 10% -10%,#1a245a33,transparent 60%),radial-gradient(900px 600px at 110% 10%,#00e5ff22,transparent 50%),linear-gradient(160deg,#0b0f1a,#0b1220);font:15px/1.6 system-ui,-apple-system,Segoe UI,Roboto,Ubuntu,Cantarell,Helvetica,Arial,"Noto Sans";letter-spacing:.2px}
  .container{max-width:1024px;margin:80px auto;padding:0 20px}
  .row{display:flex;gap:18px;flex-wrap:wrap}
  .left{flex:1 1 520px}.right{flex:1 1 360px}
  .logo{width:44px;height:44px;border-radius:12px;background:conic-gradient(from 210deg at 50% 50%,var(--brand),var(--brand-2),var(--brand));filter:drop-shadow(0 6px 18px #7c5cff33)}
  h1{margin:0 0 6px;font-weight:700;letter-spacing:.3px;font-size:28px}
  .status{display:inline-flex;align-items:center;gap:8px;padding:6px 10px;border-radius:999px;font-size:12px;background:#142034;border:1px solid var(--border)}
  .dot{width:8px;height:8px;border-radius:999px;background:var(--ok);box-shadow:0 0 0 4px #22c55e22}
  .card{background:var(--card);backdrop-filter:blur(10px);border:1px solid var(--border);border-radius:16px;padding:18px;box-shadow:0 10px 30px #00000040}
  .chips{display:flex;flex-wrap:wrap;gap:10px;margin-top:6px}
  .chip{display:inline-flex;align-items:center;gap:8px;height:34px;padding:0 12px;border-radius:999px;background:linear-gradient(180deg,#121a2e,#0f1727);border:1px solid var(--border)}
  .chip a{color:inherit;text-decoration:none}
  pre{background:var(--code);border:1px solid #142034;color:#e3e8f4;padding:14px;border-radius:12px;overflow:auto}
  .muted{color:var(--muted)}
  .title{display:flex;gap:12px;align-items:center;margin-bottom:12px}
  .kv{display:grid;grid-template-columns:120px 1fr;gap:8px 12px}
  .kv div{padding:10px 12px;border:1px solid var(--border);border-radius:12px;background:#0d1529}
</style>

<div class="container">
  <div class="title">
    <div class="logo"></div>
    <div>
      <h1>SuporteNet • <span style="background:linear-gradient(90deg,#7c5cff,#00e5ff);-webkit-background-clip:text;background-clip:text;color:transparent;">Webhook</span></h1>
      <div class="status"><span class="dot"></span> Online em ${now}</div>
    </div>
  </div>

  <div class="row">
    <section class="card left">
      <h3 style="margin:0 0 6px">Endpoints</h3>
      <div class="chips">
        <span class="chip"><strong>GET</strong>&nbsp;<a href="${base}/health">/health</a></span>
        <span class="chip"><strong>GET</strong>&nbsp;<a href="${base}/data">/data</a></span>
        <span class="chip"><strong>POST</strong>&nbsp;/webhook</span>
      </div>
      <p class="muted" style="margin-top:10px">Use <code>POST /webhook</code> com o JSON do Dialogflow ES.</p>

      <h3 style="margin:14px 0 6px">Teste rápido (PowerShell)</h3>
      <pre>Invoke-RestMethod -Uri ${base}/webhook -Method Post -ContentType 'application/json; charset=utf-8' -Body '{
  "queryResult":{"action":"support.open","parameters":{"nome":"Thiago","problema":"Wi-Fi sem conexão","prioridade":"Alta"}}
}'</pre>
    </section>

    <section class="card right">
      <h3 style="margin:0 0 10px">Último chamado</h3>
      ${(() => {
      const r = getLastRecord();
      if (!r) return "<p class='muted'>Sem registros ainda. Abra um chamado via Dialogflow/Telegram.</p>";
      return `
          <div class="kv">
            <div><strong>Nº</strong></div><div>${r.protocolo || "-"}</div>
            <div><strong>Solicitante</strong></div><div>${r.nome || "-"}</div>
            <div><strong>Prioridade</strong></div><div>${(r.prioridade || "").toString().toLowerCase()}</div>
            <div><strong>Resumo</strong></div><div>${r.resumo || "-"}</div>
          </div>
          <p class="muted" style="margin-top:10px">Use o número para consultar o status.</p>
        `;
    })()}
      <p class="muted" style="margin-top:12px;font-size:12px">Para JSON cru, acesse <a href="${base}/health?raw=1">/health?raw=1</a>.</p>
    </section>
  </div>
</div>
</html>`);
});

/* ---------------------------------- GET /webhook --------------------------- */
app.get("/webhook", (_req, res) => {
  res.status(200).send("Webhook ativo. Use POST neste endpoint com o JSON do Dialogflow.");
});

/* ---------------------------------- GET /health ---------------------------- */
/** HTML estilizado com último chamado; JSON em ?raw=1 ou Accept: application/json */
app.get("/health", (req, res) => {
  const last = getLastRecord();
  const now = new Date().toISOString();
  const wantsJson = req.query.raw === "1" || String(req.headers.accept || "").includes("application/json");

  if (wantsJson) return res.json({ ok: true, now, last });

  const html = `<!doctype html><meta charset="utf-8"><title>Saúde</title>
  <style>body{background:#0b0f1a;color:#e8ecf1;font-family:system-ui;margin:40px}
  .card{max-width:680px;margin:auto;background:#0f1524cc;border:1px solid #24314a;border-radius:14px;padding:18px}
  .kv{display:grid;grid-template-columns:140px 1fr;gap:8px 12px}
  .kv div{padding:10px 12px;border:1px solid #24314a;border-radius:10px;background:#0d1529}
  a{color:#9fd6ff}</style>
  <div class="card">
    <h2>📈 Saúde do Webhook</h2>
    <p><b>ok:</b> true</p>
    <p><b>now:</b> ${now}</p>
    <hr style="border-color:#24314a;margin:12px 0">
    <h3>Último chamado</h3>
    ${last
      ? `<div class="kv">
             <div><b>Nº</b></div><div>${last.protocolo || "-"}</div>
             <div><b>Solicitante</b></div><div>${last.nome || "-"}</div>
             <div><b>Prioridade</b></div><div>${(last.prioridade || "").toString().toLowerCase()}</div>
             <div><b>Resumo</b></div><div>${last.resumo || "-"}</div>
           </div>`
      : `<p>Sem registros ainda. Faça um POST em <code>/webhook</code>.</p>`
    }
    <p style="margin-top:10px"><a href="/health?raw=1">Ver JSON</a> • <a href="/">Home</a></p>
  </div>`;
  res.type("html").send(html);
});

/* ---------------------------------- GET /data ------------------------------ */
/** Lista registros com filtros; JSON em ?raw=1 ou Accept: application/json
 *  Query:
 *   - raw=1            -> JSON
 *   - limit=50         -> limite (1..500)
 *   - type=support|order|clinic
 *   - q=texto          -> busca em protocolo/nome/resumo
 */
app.get("/data", (req, res) => {
  const wantsJson = req.query.raw === "1" || String(req.headers.accept || "").includes("application/json");
  const limit = Math.max(1, Math.min(500, parseInt(req.query.limit ?? "50", 10) || 50));
  const type = String(req.query.type ?? "").trim().toLowerCase(); // support|order|clinic
  const q = String(req.query.q ?? "").trim().toLowerCase();

  // carrega, ordena desc por createdAt (ou mantém ordem de inserção se faltar ts)
  let items = readAllRecords();
  items.sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));

  if (type) {
    items = items.filter(r => (r.tipo || "").toLowerCase().includes(type));
  }
  if (q) {
    items = items.filter(r => {
      const hay = [r.protocolo, r.nome, r.resumo].join(" ").toLowerCase();
      return hay.includes(q);
    });
  }

  const total = items.length;
  items = items.slice(0, limit);

  if (wantsJson) {
    return res.json({ ok: true, count: items.length, total, limit, items });
  }

  const rows = items.map(r => `
    <tr>
      <td>${esc(r.createdAt || "-")}</td>
      <td><code>${esc(r.tipo || "-")}</code></td>
      <td><code>${esc(r.protocolo || "-")}</code></td>
      <td>${esc(r.nome || "-")}</td>
      <td>${esc((r.prioridade || "").toLowerCase())}</td>
      <td>${esc(r.resumo || "-")}</td>
    </tr>
  `).join("");

  res.type("html").send(`<!doctype html><meta charset="utf-8"><title>Dados</title>
  <style>
    body{background:#0b0f1a;color:#e8ecf1;font-family:system-ui;margin:24px}
    .card{background:#0f1524cc;border:1px solid #24314a;border-radius:14px;padding:18px;max-width:1100px;margin:auto}
    table{width:100%;border-collapse:collapse;margin-top:12px}
    th,td{border:1px solid #24314a;padding:8px 10px;font-size:14px;vertical-align:top}
    th{background:#121a31;text-align:left}
    code{background:#0b1222;padding:2px 6px;border-radius:6px;border:1px solid #1c2742}
    .muted{color:#a5b0c2}
    .filters{display:flex;gap:8px;flex-wrap:wrap}
    input,select{background:#0d1529;border:1px solid #24314a;color:#e8ecf1;border-radius:8px;padding:6px 10px}
    a{color:#9fd6ff}
  </style>
  <div class="card">
    <h2>📦 Registros coletados</h2>
    <p class="muted">total: ${total} • exibindo: ${items.length} • <a href="/data?raw=1">JSON</a> • <a href="/">Home</a></p>

    <form class="filters" method="get" action="/data">
      <label>tipo:
        <select name="type">
          <option value="">(todos)</option>
          <option value="support" ${type === "support" ? "selected" : ""}>support</option>
          <option value="order"   ${type === "order" ? "selected" : ""}>order</option>
          <option value="clinic"  ${type === "clinic" ? "selected" : ""}>clinic</option>
        </select>
      </label>
      <label>q:
        <input name="q" value="${esc(q)}" placeholder="buscar por protocolo, nome, resumo"/>
      </label>
      <label>limit:
        <input name="limit" type="number" min="1" max="500" value="${limit}"/>
      </label>
      <button style="background:#142034;border:1px solid #24314a;color:#e8ecf1;border-radius:8px;padding:6px 12px;cursor:pointer">Filtrar</button>
    </form>

    <table>
      <thead>
        <tr><th>createdAt</th><th>tipo</th><th>protocolo</th><th>nome</th><th>prioridade</th><th>resumo</th></tr>
      </thead>
      <tbody>${rows || `<tr><td colspan="6" class="muted">Sem registros.</td></tr>`}</tbody>
    </table>
  </div>`);
});

/* ---------------------------------- POST /webhook -------------------------- */
app.post("/webhook", async (req, res) => {
  const requestId = ulid();
  try {
    const body = req.body;
    if (!body?.queryResult) {
      return res
        .status(400)
        .json(buildResponse([buildText("Requisição inválida: payload do Dialogflow ausente.")]));
    }

    const { intent, parameters, action } = body.queryResult;
    const intentName = intent?.displayName || "";
    const act = action || "";

    let result;

    if (act === "order.create" || /pedido|restaurante/i.test(intentName)) {
      result = await handleRestaurant(parameters, body);

    } else if (act === "clinic.schedule" || /cl[ií]nica|consulta|agendamento/i.test(intentName)) {
      result = await handleClinic(parameters, body);

    } else if (act === "support.open" || /suporte|chamado/i.test(intentName)) {
      // Guard: evita 500 quando faltar campos obrigatórios
      const params = {
        nome: (parameters?.nome ?? "").toString().trim() || null,
        problema: (parameters?.problema ?? "").toString().trim() || null,
        prioridade: (parameters?.prioridade ?? "Média").toString()
      };
      const missing = ["nome", "problema"].filter(k => !params[k]);
      if (missing.length) {
        const msg = `⚠️ Campos obrigatórios ausentes: ${missing.join(", ")}.\n` +
          `Exemplo: "Abrir chamado: Wi-Fi sem conexão. Meu nome é Thiago."`;
        return res.json(
          buildResponse([buildText(msg)], [
            { name: "support-context", lifespanCount: 2, parameters: params }
          ])
        );
      }
      result = await handleSupport(params, body);

    } else {
      return res.json(
        buildResponse([
          buildText('Não reconheci a ação para este intent. Confira o "Action" ou ative o webhook no intent.')
        ])
      );
    }

    const messages = [buildText(result.message)];

    // Teclado rápido quando origem for Telegram
    const source = body?.originalDetectIntentRequest?.source;
    if (source && String(source).toLowerCase() === "telegram") {
      messages.push(
        buildTelegram({
          text: result.message,
          reply_markup: {
            keyboard: [[{ text: "Novo pedido" }], [{ text: "Novo agendamento" }], [{ text: "Abrir chamado" }]],
            resize_keyboard: true,
            one_time_keyboard: false
          }
        })
      );
    }

    return res.json(buildResponse(messages, result.outputContexts));
  } catch (err) {
    console.error(`[${requestId}]`, err);
    return res
      .status(500)
      .json(buildResponse([buildText("Falha ao processar sua solicitação. Tente novamente em instantes.")]));
  }
});

/* ===== Persistência auxiliar (import/export) ===== */
function readRaw() {
  try {
    if (!fs.existsSync(DB_PATH)) return [];
    const raw = fs.readFileSync(DB_PATH, "utf8");
    return raw?.trim() ? JSON.parse(raw) : [];
  } catch { return []; }
}

function writeRawSafe(obj) {
  const tmp = DB_PATH + ".tmp";
  fs.writeFileSync(tmp, JSON.stringify(obj, null, 2));
  fs.renameSync(tmp, DB_PATH);
}

function toArray(json) {
  if (Array.isArray(json)) return json;
  if (json && typeof json === "object") {
    const arrs = Object.values(json).filter(Array.isArray);
    return arrs.flat();
  }
  return [];
}

const ADMIN_SECRET = process.env.ADMIN_SECRET || ""; // defina nas envs do Render
function assertAdmin(req, res) {
  if (!ADMIN_SECRET) return true; // se não definiu, não bloqueia
  const s = String(req.query.secret || req.headers["x-admin-secret"] || "");
  if (s !== ADMIN_SECRET) {
    res.status(401).json({ ok: false, error: "unauthorized" });
    return false;
  }
  return true;
}

/* ====== POST /data/import  (importar JSON) ======
 Aceita:
  - array de registros:          [ {...}, {...} ]
  - objeto com items:            { "items": [ ... ] }
  - objeto com coleções arrays:  { "support":[...], "orders":[...], ... }
 Proteção opcional por ADMIN_SECRET (?secret=... ou header x-admin-secret)
--------------------------------------------------*/
app.post("/data/import", (req, res) => {
  if (!assertAdmin(req, res)) return;
  const body = req.body;
  const items = Array.isArray(body) ? body
    : Array.isArray(body?.items) ? body.items
      : toArray(body);

  if (!Array.isArray(items) || !items.length) {
    return res.status(400).json({ ok: false, error: "Esperado um array de registros ou objeto com arrays." });
  }

  // normaliza mínimos
  const nowIso = () => new Date().toISOString();
  const enriched = items.map(r => ({
    createdAt: r.createdAt || r.ts || nowIso(),
    _type: r._type || r.tipo || r.kind || "support",
    ...r
  }));

  // junta com o que já existe (sempre salvamos como array)
  const current = toArray(readRaw());
  const merged = [...current, ...enriched];
  writeRawSafe(merged);
  return res.json({ ok: true, imported: enriched.length, total: merged.length });
});

/* ====== POST /data/seed  (popular com exemplos) ======
 Proteção opcional por ADMIN_SECRET (?secret=... ou header x-admin-secret)
------------------------------------------------------*/
app.post("/data/seed", (req, res) => {
  if (!assertAdmin(req, res)) return;
  const now = new Date();
  const pad = (n) => String(n).padStart(2, "0");
  const d = (h) => new Date(now.getTime() - h * 3600 * 1000).toISOString();

  const sample = [
    { _type: "support", protocolo: "SUP-" + ulid().toUpperCase(), nome: "Thiago", prioridade: "Alta", problema: "Wi-Fi sem conexão", createdAt: d(1) },
    { _type: "order", orderId: "PED-" + ulid().toUpperCase(), nome: "Thiago", prato: "Lasanha bolonhesa", quantidade: 1, createdAt: d(2) },
    { _type: "clinic", appointmentId: "AG-" + ulid().toUpperCase(), nome: "Thiago", tipo_consulta: "Clínico Geral", data: `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate() + 1)}`, horario: "15:00:00", createdAt: d(3) }
  ];

  const current = toArray(readRaw());
  const merged = [...current, ...sample];
  writeRawSafe(merged);
  return res.json({ ok: true, seeded: sample.length, total: merged.length });
});

/* ====== GET /data/download  (baixar JSON atual) ====== */
app.get("/data/download", (req, res) => {
  const raw = readRaw();
  res.setHeader("Content-Disposition", "attachment; filename=data.json");
  res.type("application/json").send(JSON.stringify(raw, null, 2));
});

/* ====== DELETE /data/clear  (apagar tudo) ======
 Proteção opcional por ADMIN_SECRET (?secret=... ou header x-admin-secret)
------------------------------------------------*/
app.delete("/data/clear", (req, res) => {
  if (!assertAdmin(req, res)) return;
  writeRawSafe([]);
  res.json({ ok: true, cleared: true });
});

/* ----------------------------------- Start -------------------------------- */
app.listen(PORT, () => console.log(`Webhook online na porta ${PORT}`));
