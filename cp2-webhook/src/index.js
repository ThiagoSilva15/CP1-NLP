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

const app = express();
const PORT = process.env.PORT || 3000;

/* caminho do "banco" JSON */
const __filename = fileURLToPath(import.meta.url);
const __dirname  = path.dirname(__filename);
const DB_PATH = path.resolve(process.env.DB_PATH || path.join(__dirname, "../data/data.json"));

app.use(helmet());
app.use(cors());
app.use(express.json({ limit: "1mb" }));
app.use(morgan("dev"));

/* util: pega o último registro salvo (qualquer fluxo) */
function getLastRecord() {
  try {
    if (!fs.existsSync(DB_PATH)) return null;
    const raw = fs.readFileSync(DB_PATH, "utf8");
    if (!raw?.trim()) return null;
    const data = JSON.parse(raw);

    const pickFields = (r) => ({
      protocolo: r.protocolo || r.id || r.codigo || r.ticket || r.orderId || r.appointmentId || "",
      nome: r.nome || r.solicitante || r.cliente || "",
      prioridade: (r.prioridade || r.priority || "").toString(),
      resumo: r.problema || r.resumo || r.descricao || r.prato || r.tipo_consulta || "",
      tipo: r.tipo || r._type || r.kind || ""
    });

    if (Array.isArray(data) && data.length) return pickFields(data.at(-1));

    if (data && typeof data === "object") {
      const arrays = Object.values(data).filter(Array.isArray).filter(arr => arr.length);
      if (!arrays.length) return null;

      // tenta escolher pelo timestamp; se não houver, pega o último elemento de cada array e usa o mais "novo" disponível
      const lastItems = arrays.map(a => a.at(-1));
      lastItems.sort((a,b) => new Date(a.createdAt || a.ts || a.time || 0) - new Date(b.createdAt || b.ts || b.time || 0));
      return pickFields(lastItems.at(-1));
    }

    return null;
  } catch {
    return null;
  }
}

/* ---------- HOME (GET /) ---------- */
app.get("/", (req, res) => {
  const base = `${req.protocol}://${req.get("host")}`;
  const now  = new Date().toLocaleString("pt-BR");
  res.type("html").send(`<!doctype html>
<html lang="pt-br"><meta charset="utf-8">
<title>SuporteNet • Webhook</title><meta name="viewport" content="width=device-width, initial-scale=1">
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
            <div><strong>Prioridade</strong></div><div>${(r.prioridade||"").toString().toLowerCase()}</div>
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

/* GET /webhook — mensagem amigável no navegador */
app.get("/webhook", (_req, res) => {
  res.status(200).send("Webhook ativo. Use POST neste endpoint com o JSON do Dialogflow.");
});

/* GET /health — HTML bonito (ou JSON se ?raw=1 ou Accept: application/json) */
app.get("/health", (req, res) => {
  const last = getLastRecord();
  const now  = new Date().toISOString();
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
    ${
      last
        ? `<div class="kv">
             <div><b>Nº</b></div><div>${last.protocolo || "-"}</div>
             <div><b>Solicitante</b></div><div>${last.nome || "-"}</div>
             <div><b>Prioridade</b></div><div>${(last.prioridade||"").toString().toLowerCase()}</div>
             <div><b>Resumo</b></div><div>${last.resumo || "-"}</div>
           </div>`
        : `<p>Sem registros ainda. Faça um POST em <code>/webhook</code>.</p>`
    }
    <p style="margin-top:10px"><a href="/health?raw=1">Ver JSON</a> • <a href="/">Home</a></p>
  </div>`;
  res.type("html").send(html);
});

/* POST /webhook — principal */
app.post("/webhook", async (req, res) => {
  const requestId = ulid();
  try {
    const body = req.body;
    if (!body?.queryResult) {
      return res.status(400).json(buildResponse([buildText("Requisição inválida: payload do Dialogflow ausente.")]));
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
      result = await handleSupport(parameters, body);
    } else {
      return res.json(buildResponse([buildText('Não reconheci a ação para este intent. Confira o "Action" ou ative o webhook no intent.')]));
    }

    const messages = [buildText(result.message)];

    // Teclado rápido quando origem for Telegram
    const source = body?.originalDetectIntentRequest?.source;
    if (source && String(source).toLowerCase() === "telegram") {
      messages.push(buildTelegram({
        text: result.message,
        reply_markup: {
          keyboard: [[{ text: "Novo pedido" }], [{ text: "Novo agendamento" }], [{ text: "Abrir chamado" }]],
          resize_keyboard: true, one_time_keyboard: false
        }
      }));
    }

    return res.json(buildResponse(messages, result.outputContexts));
  } catch (err) {
    console.error(`[${requestId}]`, err);
    return res.status(500).json(buildResponse([buildText("Falha ao processar sua solicitação. Tente novamente em instantes.")]));
  }
});

/* start */
app.listen(PORT, () => console.log(`Webhook online na porta ${PORT}`));


