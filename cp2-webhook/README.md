
# CP2 Webhook — SuporteNet (Dialogflow ES)

Webhook pronto para integrar o seu bot SuporteNet (anexo) ao backend, atendendo aos requisitos do CP2.

## O que já está implementado

- Endpoint do Dialogflow: POST /webhook
- Fluxos dinâmicos (com persistência em disco data/db.json):
  - intent.abrir_chamado: abre chamado e gera protocolo SN-XXXXXX
  - intent.status_chamado: consulta status por protocolo
  - intent.faq: resposta dinâmica simples por tópico
  - Exemplos extras: restaurante.pedido, clinica.agendar (opcionais)
- Evidências (para prints):
  - GET /health — healthcheck
  - GET /data/download — dump do banco para anexar no relatório
  - POST /data/clear — limpa dados (útil para regravar o vídeo)
- Segurança e logs: Helmet, CORS e Morgan

Importante: os nomes dos intents foram lidos do seu agente anexo. Principais:
- intent.abrir_chamado (params: problema, endereco, cidade, plano, numero_cliente, janela_data, janela_hora)
- intent.status_chamado (params: protocolo, contato)
- intent.faq (params: faq_topico)
- intent.welcome_identificacao (params: nome, contato)

## Como rodar localmente

npm install
npm run dev   # ou: npm start
# Em outro terminal, inicialize o "banco":
npm run seed

Endpoints locais:
- http://localhost:3000/health
- http://localhost:3000/webhook
- http://localhost:3000/data/download
- http://localhost:3000/data/clear

## Deploy (Render)

1. Suba este projeto para um repositório GitHub.
2. No Render, crie um Web Service → conecte seu repositório.
3. Build Command: npm install
4. Start Command: npm start
5. Após deploy, copie a URL pública (ex.: https://cp2-webhook.onrender.com).

## Configurar no Dialogflow (Fulfillment)

1. Dialogflow ES → Fulfillment → Enable webhook:
   - URL: https://SEU-APP.onrender.com/webhook
2. Em Intents → abra os intents que exigem lógica (ex.: intent.abrir_chamado e intent.status_chamado):
   - Marque Use webhook (Fulfillment).
3. Teste no Simulator do Dialogflow:
   - "Quero abrir um chamado" → informe parâmetros solicitados.
   - Você deve receber Protocolo SN-XXXXXX.
   - Depois: "status do protocolo SN-XXXXXX" → retorna o status.

## Exemplos de payload (para evidência em Postman/cURL)

Abrir chamado
curl -X POST https://SEU-APP.onrender.com/webhook   -H 'Content-Type: application/json'   -d '{
    "session": "projects/demo/agent/sessions/abc",
    "queryResult": {
      "intent": { "displayName": "intent.abrir_chamado" },
      "parameters": {
        "problema": "Sem conexão",
        "endereco": "Rua das Flores, 123",
        "cidade": "São Paulo",
        "plano": "300 Mega",
        "numero_cliente": "CLI-778899",
        "janela_data": "2025-10-12",
        "janela_hora": "14:00"
      }
    }
  }'

Status do chamado
curl -X POST https://SEU-APP.onrender.com/webhook   -H 'Content-Type: application/json'   -d '{
    "session": "projects/demo/agent/sessions/abc",
    "queryResult": {
      "intent": { "displayName": "intent.status_chamado" },
      "parameters": { "protocolo": "SN-XXXXXX" }
    }
  }'

Baixar evidência dos dados
curl https://SEU-APP.onrender.com/data/download

## Roteiro do vídeo (≤ 3 min)

1) Contexto (10s) — "Este é o SuporteNet integrado a um webhook no Render."
2) Dialogflow (45s) — Mostrar:
   - Fulfillment habilitado e URL do webhook.
   - Em intent.abrir_chamado, checkbox Use webhook marcado.
3) Teste (60s) — No simulator ou Telegram:
   - Abrir chamado → receber protocolo.
   - Consultar status_chamado com o protocolo.
4) Evidência backend (30s) — Abrir https://SEU-APP.onrender.com/data/download e mostrar o JSON com o chamado gravado.
5) Encerramento (10s) — "Integração concluída: validação de parâmetros, geração de protocolo e retorno em fulfillmentMessages."

## Estrutura

cp2-webhook/
  ├─ src/
  │  ├─ index.js
  │  ├─ dialogflow.js
  │  └─ store.js
  ├─ data/
  │  └─ seeds/faq.json
  ├─ package.json
  └─ README.md

Se quiser, posso adaptar o webhook para Glitch ou Heroku. Também posso incluir logs persistentes (SQLite) — para o CP, o JSON em disco é suficiente para prints.
