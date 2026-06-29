# 🚀 P2 Webhook — SuporteNet (Dialogflow ES)

Webhook desenvolvido para integração com o chatbot **SuporteNet**, utilizando **Dialogflow ES**, atendendo aos requisitos do **Checkpoint 2 (CP2)**.

O projeto recebe requisições do Dialogflow, processa as intenções do usuário e mantém um banco de dados simples em JSON para persistência dos chamados.

---

# 📋 Funcionalidades

## ✅ Integração com Dialogflow ES

- Endpoint para Webhook
- Processamento de Intents
- Respostas dinâmicas
- Persistência de dados

### Endpoint

```
POST /webhook
```

---

# ⚙️ Intents Implementadas

## 📌 Abrir Chamado

**Intent**

```
intent.abrir_chamado
```

### Parâmetros

| Parâmetro | Descrição |
|------------|------------|
| problema | Problema informado pelo cliente |
| endereco | Endereço do atendimento |
| cidade | Cidade do cliente |
| plano | Plano contratado |
| numero_cliente | Número do cliente |
| janela_data | Data desejada |
| janela_hora | Horário desejado |

### Resultado

- Geração automática de protocolo

```
SN-XXXXXX
```

- Armazenamento do chamado
- Retorno ao Dialogflow

---

## 📌 Consultar Status

**Intent**

```
intent.status_chamado
```

### Parâmetros

| Parâmetro | Descrição |
|------------|------------|
| protocolo | Número do protocolo |
| contato | Telefone ou e-mail (opcional) |

### Resultado

Consulta do chamado salvo no banco.

---

## 📌 FAQ

**Intent**

```
intent.faq
```

### Parâmetros

| Parâmetro | Descrição |
|------------|------------|
| faq_topico | Tema da dúvida |

### Resultado

Resposta dinâmica baseada no tópico informado.

---

## 📌 Identificação

**Intent**

```
intent.welcome_identificacao
```

### Parâmetros

| Parâmetro | Descrição |
|------------|------------|
| nome | Nome do cliente |
| contato | Telefone ou e-mail |

---

# 🗄 Persistência

Os dados ficam armazenados em:

```
data/db.json
```

Não é necessário banco SQL para execução.

---

# 🔒 Segurança

O projeto utiliza:

- Helmet
- CORS
- Morgan

---

# 📊 Endpoints Auxiliares

## Health Check

```
GET /health
```

Verifica se a aplicação está online.

---

## Download dos Dados

```
GET /data/download
```

Retorna todo o conteúdo do banco JSON.

Ideal para:

- evidências
- prints
- relatório

---

## Limpar Banco

```
POST /data/clear
```

Remove todos os registros armazenados.

Útil para gravar novos testes.

---

# 📁 Estrutura do Projeto

```
cp2-webhook
│
├── src
│   ├── index.js
│   ├── dialogflow.js
│   └── store.js
│
├── data
│   ├── db.json
│   └── seeds
│       └── faq.json
│
├── package.json
└── README.md
```

---

# ▶️ Executando Localmente

## 1. Instalar dependências

```bash
npm install
```

## 2. Iniciar aplicação

Modo desenvolvimento

```bash
npm run dev
```

Modo produção

```bash
npm start
```

---

## 3. Popular o banco

Em outro terminal:

```bash
npm run seed
```

---

# 🌐 Endpoints Locais

```
http://localhost:3000/health

http://localhost:3000/webhook

http://localhost:3000/data/download

http://localhost:3000/data/clear
```

---

# ☁️ Deploy no Render

## 1. Envie o projeto para o GitHub.

## 2. No Render

Crie um novo:

```
Web Service
```

Conecte o repositório.

---

### Build Command

```bash
npm install
```

### Start Command

```bash
npm start
```

Após o deploy será gerada uma URL semelhante a:

```
https://cp2-webhook.onrender.com
```

---

# 🤖 Configuração no Dialogflow ES

## Ativar Fulfillment

Acesse:

```
Dialogflow ES

→ Fulfillment

→ Enable Webhook
```

Configure:

```
https://SEU-APP.onrender.com/webhook
```

---

## Ativar Webhook nas Intents

Abra cada Intent que utiliza backend.

Exemplo:

- intent.abrir_chamado
- intent.status_chamado

Marque:

```
Use webhook
```

---

# 🧪 Testando

No Simulator do Dialogflow:

```
Quero abrir um chamado
```

Informe os dados solicitados.

Resposta esperada:

```
Protocolo gerado:

SN-123456
```

Depois consulte:

```
Status do protocolo SN-123456
```

---

# 📨 Exemplos de Requisição

## Abrir Chamado

```bash
curl -X POST https://SEU-APP.onrender.com/webhook \
-H "Content-Type: application/json" \
-d '{
  "session":"projects/demo/agent/sessions/abc",
  "queryResult":{
    "intent":{
      "displayName":"intent.abrir_chamado"
    },
    "parameters":{
      "problema":"Sem conexão",
      "endereco":"Rua das Flores, 123",
      "cidade":"São Paulo",
      "plano":"300 Mega",
      "numero_cliente":"CLI-778899",
      "janela_data":"2025-10-12",
      "janela_hora":"14:00"
    }
  }
}'
```

---

## Consultar Status

```bash
curl -X POST https://SEU-APP.onrender.com/webhook \
-H "Content-Type: application/json" \
-d '{
  "session":"projects/demo/agent/sessions/abc",
  "queryResult":{
    "intent":{
      "displayName":"intent.status_chamado"
    },
    "parameters":{
      "protocolo":"SN-123456"
    }
  }
}'
```

---

## Download do Banco

```bash
curl https://SEU-APP.onrender.com/data/download
```

---

# 🎥 Roteiro da Demonstração

Tempo máximo: **3 minutos**

## 1. Introdução (10s)

- Apresentação do projeto
- Explicação da integração Dialogflow + Webhook

---

## 2. Configuração (40s)

Mostrar:

- Fulfillment habilitado
- URL do Webhook
- Intents utilizando Webhook

---

## 3. Demonstração (60s)

Abrir um chamado.

Mostrar:

- parâmetros
- geração do protocolo
- resposta automática

Depois consultar o status do protocolo.

---

## 4. Evidência (30s)

Acessar:

```
GET /data/download
```

Mostrar o JSON contendo o chamado gravado.

---

## 5. Encerramento (10s)

Concluir demonstrando:

- Integração funcionando
- Persistência dos dados
- Geração automática do protocolo
- Comunicação completa entre Dialogflow e Backend

---

# 🛠 Tecnologias

- Node.js
- Express
- Dialogflow ES
- Helmet
- Morgan
- CORS
- JSON Storage

---

# 👨‍💻 Autor

Projeto desenvolvido para o **Checkpoint 2 (CP2)**, demonstrando a integração entre **Dialogflow ES** e um backend em **Node.js**, com persistência local e deploy em nuvem.
