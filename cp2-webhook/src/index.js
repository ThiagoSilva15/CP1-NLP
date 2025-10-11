import express from "express";
import helmet from "helmet";
import morgan from "morgan";
import cors from "cors";
import dotenv from "dotenv";
import { ulid } from "ulid";
import { buildText, buildTelegram, buildResponse } from "./lib/df.js";
import { handleRestaurant, handleClinic, handleSupport } from "./lib/handlers.js";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

app.use(helmet());
app.use(cors());
app.use(express.json({ limit: "1mb" }));
app.use(morgan("dev"));

app.get("/", (req, res) => {
  const base = `${req.protocol}://${req.get("host")}`;
  const now = new Date().toLocaleString("pt-BR");
  res.type("html").send(`<!doctype html>
<html lang="pt-br"><meta charset="utf-8">
<title>SuporteNet • Webhook</title>
<meta name="viewport" content="width=device-width, initial-scale=1">
<style>
  :root{--bg:#0b0f1a;--fg:#e8ecf1;--muted:#a5b0c2;--brand:#7c5cff;--brand-2:#00e5ff;--ok:#22c55e;--card:#0f1524cc;--chip:#151c2e;--border:#24314a;--code:#0b1222;}
  *{box-sizing:border-box} html,body{height:100%}
  body{margin:0;color:var(--fg);background:radial-gradient(1200px 800px at 10% -10%,#1a245a33,transparent 60%),radial-gradient(900px 600px at 110% 10%,#00e5ff22,transparent 50%),linear-gradient(160deg,#0b0f1a 0%,#0b1220 100%);font:15px/1.6 system-ui,-apple-system,Segoe UI,Roboto,Ubuntu,Cantarell,Helvetica,Arial,"Noto Sans","Apple Color Emoji","Segoe UI Emoji";letter-spacing:.2px}
  .container{max-width:1024px;margin:80px auto;padding:0 20px}
  .grid{display:grid;gap:18px}
  .hero{display:flex;align-items:center;gap:14px;flex-wrap:wrap;margin-bottom:12px}
  .logo{width:44px;height:44px;border-radius:12px;background:conic-gradient(from 210deg at 50% 50%,var(--brand),var(--brand-2),var(--brand));filter:drop-shadow(0 6px 18px #7c5cff33)}
  h1{margin:0;font-weight:700;letter-spacing:.3px;font-size:28px}
  .status{display:inline-flex;align-items:center;gap:8px;padding:6px 10px;border-radius:999px;font-size:12px;background:#142034;border:1px solid var(--border)}
  .dot{width:8px;height:8px;border-radius:999px;background:var(--ok);box-shadow:0 0 0 4px #22c55e22}
  .card{background:var(--card);backdrop-filter:blur(10px);border:1px solid var(--border);border-radius:16px;padding:18px;box-shadow:0 10px 30px #00000040}
  .card h2{margin:0 0 12px;font-size:16px;letter-spacing:.3px}
  .chips{display:flex;flex-wrap:wrap;gap:10px}
  .chip,.link{display:inline-flex;align-items:center;gap:8px;height:36px;padding:0 14px;border-radius:999px;text-decoration:none;color:var(--fg);background:linear-gradient(180deg,#121a2e,#0f1727);border:1px solid var(--border)}
  .chip.badge{background:linear-gradient(180deg,#0f1b33,#0e1a2c);font-size:12px}
  .chip:hover,.link:hover{border-color:#3a4b75}
  code{font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,"Liberation Mono",monospace}
  pre{background:var(--code);border:1px solid #142034;color:#e3e8f4;padding:14px;border-radius:12px;overflow:auto}
  .muted{color:var(--muted)}
  .grid-cols{display:grid;grid-template-columns:1fr 1fr;gap:18px}
  @media (max-width:900px){.grid-cols{grid-template-columns:1fr}}
  .title-row{display:flex;align-items:center;justify-content:space-between;gap:10px;flex-wrap:wrap}
  .accent{background:linear-gradient(90deg,var(--brand),var(--brand-2));-webkit-background-clip:text;background-clip:text;color:transparent}
  .hr{height:1px;background:linear-gradient(90deg,transparent,#1f2a44,transparent);margin:8px 0 14px}
  .kbd{display:inline-block;padding:2px 6px;border:1px solid var(--border);border-bottom-color:#111a2f;background:#0c1426;border-radius:8px;font:12px/1.4 ui-monospace,SFMono-Regular,Menlo,Consolas,monospace}
  .foot{margin-top:10px;color:#8ea2c7;font-size:12px}
</style>
<div class="container grid">
  <div class="title-row">
    <div class="hero">
      <div class="logo"></div>
      <div><h1>SuporteNet <span class="accent">Webhook</span></h1><div class="status"><span class="dot"></span> Online em ${now}</div></div>
    </div>
    <a class="link" href="${base}/health">Ver saúde</a>
  </div>
  <div class="grid-cols">
    <section class="card">
      <h2>Endpoints</h2><div class="hr"></div>
      <div class="chips">
        <a class="chip" href="${base}/health"><strong>GET</strong> /health</a>
        <span class="chip"><strong>POST</strong> /webhook</span>
        <span class="chip badge">source: cp2-webhook</span>
      </div>
      <p class="muted" style="margin-top:10px">Use <span class="kbd">POST</span> no <code>/webhook</code> com o JSON do Dialogflow ES.</p>
    </section>
    <section class="card">
      <h2>Fluxos (Actions)</h2><div class="hr"></div>
      <div class="chips" style="margin-bottom:8px">
        <span class="chip">support.open</span><span class="chip">order.create</span><span class="chip">clinic.schedule</span>
      </div>
      <p class="muted">Ative <em>Enable webhook call for this intent</em> e defina a <em>Action</em> correspondente.</p>
    </section>
  </div>
  <section class="card">
    <h2>Teste rápido (PowerShell)</h2><div class="hr"></div>
    <pre>Invoke-RestMethod -Uri ${base}/webhook -Method Post -ContentType 'application/json; charset=utf-8' -Body '{
  "queryResult":{"action":"support.open","parameters":{"nome":"Thiago","problema":"Wi-Fi sem conexão","prioridade":"Alta"}}
}'</pre>
    <p class="foot">Dica: se o console quebrar acentos, rode <span class="kbd">[Console]::OutputEncoding=[System.Text.UTF8Encoding]::new()</span>.</p>
  </section>
  <p class="muted" style="text-align:center;margin-top:6px">Este serviço retorna <code>fulfillmentMessages</code> e <code>outputContexts</code> no padrão Dialogflow ES.</p>
</div>
</html>`);
});

app.get("/webhook", (_req, res) => {
  res.status(200).send("Webhook ativo. Use POST neste endpoint com o JSON do Dialogflow.");
});

app.get("/health", (_req, res) => {
  res.json({ ok: true, now: new Date().toISOString() });
});

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
      return res.json(buildResponse([buildText('Não reconheci a ação. Confira o "Action" do intent.')]));
    }

    const messages = [buildText(result.message)];
    const source = body?.originalDetectIntentRequest?.source;
    if (source && String(source).toLowerCase() === "telegram") {
      messages.push(buildTelegram({
        text: result.message,
        reply_markup: { keyboard: [[{text:"Novo pedido"}],[{text:"Novo agendamento"}],[{text:"Abrir chamado"}]], resize_keyboard:true, one_time_keyboard:false }
      }));
    }
    return res.json(buildResponse(messages, result.outputContexts));
  } catch (err) {
    console.error(`[${requestId}]`, err);
    return res.status(500).json(buildResponse([buildText("Falha ao processar sua solicitação. Tente novamente em instantes.")]));
  }
});

app.listen(PORT, () => console.log(`Webhook online na porta ${PORT}`));
