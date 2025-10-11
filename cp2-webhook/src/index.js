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
  res.type("html").send(`<!doctype html>
<html lang="pt-br"><meta charset="utf-8">
<title>SuporteNet Webhook</title>
<style>
  :root { color-scheme: light dark; }
  body{font-family:system-ui,Segoe UI,Arial,sans-serif;margin:2rem;line-height:1.55}
  code,pre{background:#f4f4f4;padding:.5rem .75rem;border-radius:.5rem;display:block;overflow:auto}
  a{color:inherit}
  ul{margin:.25rem 0 1rem 1.25rem}
</style>
<h1>SuporteNet Webhook</h1>
<p>✅ Online em ${new Date().toLocaleString("pt-BR")}</p>

<h2>Endpoints</h2>
<ul>
  <li>GET <a href="/health">/health</a> — status/saúde</li>
  <li>POST <code>/webhook</code> — endpoint do Dialogflow</li>
</ul>

<h3>Teste rápido (PowerShell)</h3>
<pre>Invoke-RestMethod -Uri ${base}/webhook -Method Post -ContentType 'application/json; charset=utf-8' -Body '{
  "queryResult":{"action":"support.open","parameters":{"nome":"Thiago","problema":"Wi-Fi sem conexão","prioridade":"Alta"}}
}'</pre>

<h3>Observações</h3>
<ul>
  <li>Este serviço espera payloads no formato do Dialogflow ES.</li>
  <li>Fluxos suportados: <code>support.open</code>, <code>order.create</code>, <code>clinic.schedule</code>.</li>
</ul>
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
      result = await handleSupport(parameters, body);
    } else {
      return res.json(
        buildResponse([
          buildText('Não reconheci a ação para este intent. Confira o "Action" ou ative o webhook no intent.')
        ])
      );
    }

    const messages = [buildText(result.message)];

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

app.listen(PORT, () => console.log(`Webhook online na porta ${PORT}`));
