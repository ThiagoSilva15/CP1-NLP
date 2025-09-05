// SuporteNet – Dialogflow ES Webhook (Express)
const express = require('express');
const bodyParser = require('body-parser');

const app = express();
app.use(bodyParser.json());

// ---------------------- Funções auxiliares ----------------------

function isBusinessHour(date) {
  const day = date.getUTCDay();
  const hour = date.getUTCHours();
  const isWeekday = day >= 1 && day <= 5;
  return isWeekday && hour >= 11 && hour <= 21; // 08–18 BRT
}

function nextBusinessSlot() {
  const d = new Date();
  d.setUTCSeconds(0, 0);
  while (!isBusinessHour(d)) d.setUTCHours(d.getUTCHours() + 1);
  return d.toISOString();
}

// ✅ Validação de TELEFONE (10 a 13 dígitos, com/sem +55)
function validatePhoneNumber(n) {
  const clean = String(n || '').replace(/\D/g, '').trim();
  return clean.length >= 10 && clean.length <= 13;
}

function normalizePhone(phone) {
  const only = String(phone || '').replace(/\D/g, '');
  return only.length >= 10 && only.length <= 13 ? only : null;
}

function normalizeEmail(email) {
  const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return re.test(String(email || '').trim()) ? String(email).trim() : null;
}

function proto() {
  return 'SN-' + Math.random().toString(36).substring(2, 6).toUpperCase() + '-' + Date.now().toString().slice(-6);
}

// ---------------------- Memória local (demo) ----------------------
const tickets = {};

// ---------------------- Webhook ----------------------
app.post('/webhook', (req, res) => {
  const body = req.body || {};
  const intent = body.queryResult?.intent?.displayName || '';
  const p = body.queryResult?.parameters || {};

  // Logs úteis para o Render (Live tail)
  console.log('--- WEBHOOK HIT ---');
  console.log('Intent:', intent);
  console.log('Parameters:', JSON.stringify(p));

  function dfResponse(text, outputContexts = []) {
    res.json({ fulfillmentText: text, outputContexts });
  }

  // ---------------------- Abrir chamado ----------------------
  if (intent === 'intent.abrir_chamado') {
    let {
      problema, dispositivo, endereco, cidade, plano,
      numero_cliente,             // mantém o mesmo nome do parâmetro da intent
      janela_data, janela_hora,
      preferencia_contato, nome, contato
    } = p;

    // normaliza contato (vindo da etapa de identificação)
    if (!contato) contato = body.originalDetectIntentRequest?.payload?.data?.from?.username || null;
    const phone = normalizePhone(contato);
    const email = normalizeEmail(contato);
    const contactOK = !!(phone || email);

    // LOG extra para depurar o "numero_cliente" usado como telefone
    const numeroClienteRaw = numero_cliente;
    const numeroClienteClean = String(numero_cliente || '').replace(/\D/g, '').trim();
    console.log('numero_cliente (raw):', numeroClienteRaw, ' | clean:', numeroClienteClean);

    // ✅ AGORA validamos numero_cliente como TELEFONE (10-13 dígitos)
    if (!validatePhoneNumber(numero_cliente)) {
      return dfResponse('Preciso de um **número de telefone válido com DDD** (10 a 13 dígitos). Pode confirmar?');
    }

    if (!contactOK) {
      return dfResponse('Preciso de um **telefone com DDD** ou **e-mail** válido para prosseguir. Pode me informar?');
    }

    let whenISO = null;
    if (janela_data && janela_hora) {
      try {
        const dt = new Date(`${janela_data}T${String(janela_hora).replace('Z','')}`);
        if (isNaN(dt.getTime()) || dt.getTime() < Date.now() || !isBusinessHour(dt)) {
          return dfResponse('Agendamos apenas **dias úteis** entre **08:00–18:00 (BRT)** e a data/hora precisa ser **futura**. Pode sugerir outro horário?');
        }
        whenISO = dt.toISOString();
      } catch (e) {
        console.error('Erro ao parsear data/hora:', e);
        return dfResponse('Não consegui entender a **data/horário** informados. Pode repetir?');
      }
    } else {
      whenISO = nextBusinessSlot();
    }

    const protocolo = proto();
    tickets[protocolo] = {
      protocolo, problema, dispositivo, endereco, cidade, plano,
      numero_cliente: numeroClienteClean,                    // armazena a versão limpa
      preferencia_contato: phone ? phone : email,
      nome,
      whenISO,
      etapa: 'Agendado',
      previsao: whenISO
    };

    console.log('TICKET CRIADO:', tickets[protocolo]);

    return dfResponse(
      `Chamado ${protocolo} criado para ${problema || 'problema informado'} em ${endereco}, ${cidade}. Janela: ${whenISO}. ` +
      `Você receberá atualizações pelo contato informado. Posso ajudar em mais algo?`,
      [{
        name: `${body.session}/contexts/ctx_chamado_aberto`,
        lifespanCount: 5,
        parameters: { protocolo, previsao: whenISO }
      }]
    );
  }

  // ---------------------- Status chamado ----------------------
  if (intent === 'intent.status_chamado') {
    let { protocolo, contato } = p;
    let candidate = null;

    if (protocolo && tickets[protocolo]) {
      candidate = tickets[protocolo];
    } else if (contato) {
      const phone = normalizePhone(contato), email = normalizeEmail(contato);
      candidate = Object.values(tickets).reverse().find(t => t.preferencia_contato === (phone || email));
    } else {
      const ctx = (body.queryResult?.outputContexts || []).find(c => c.name.endsWith('/contexts/ctx_chamado_aberto'));
      if (ctx?.parameters?.protocolo && tickets[ctx.parameters.protocolo]) {
        candidate = tickets[ctx.parameters.protocolo];
      }
    }

    if (!candidate) {
      return dfResponse('Não encontrei seu chamado. Informe o **protocolo** ou seu **telefone/e-mail** cadastrado para eu localizar.');
    }

    return dfResponse(`Seu chamado ${candidate.protocolo} está em **${candidate.etapa}**. Previsão de atendimento: **${candidate.previsao}**. Posso ajudar em mais algo?`);
  }

  // ---------------------- FAQ ----------------------
  if (intent === 'intent.faq') {
    const { faq_topico } = p;
    const map = {
      horario: 'Nosso suporte funciona **segunda a sábado, 08:00–18:00**.',
      planos: 'Planos: **Básico 50Mb R$79 | Plus 200Mb R$99 | Turbo 500Mb R$129 | Giga 1Gb R$159**.',
      precos: 'Preços variam por cidade; referência: **50Mb R$79, 200Mb R$99, 500Mb R$129, 1Gb R$159**.',
      preparo: 'Deixe **modem/roteador ligados** e acessíveis; tenha documento em mãos; anote luzes do equipamento.',
      reagendamento: 'Pode **reagendar sem custo até 2h** antes da janela. Informe seu protocolo.',
      senha_wifi: 'Acesse o roteador (ex.: **192.168.0.1**) → Wireless → Password e defina senha forte (10+ caracteres).'
    };

    const key = (faq_topico || '').toLowerCase();
    return dfResponse(map[key] || 'Posso falar sobre **horário, planos/preços, preparo, reagendamento ou senha do Wi-Fi**. Qual desses você quer?');
  }

  // ---------------------- Encerramento ----------------------
  if (intent === 'intent.handoff_encerramento') {
    return dfResponse('Certo! Vou te **transferir** para um atendente humano. Antes, pode me dar uma nota de **0 a 10** para este atendimento?');
  }

  // ---------------------- Fallback ----------------------
  return dfResponse('Desculpe, não entendi. Você pode **resumir em uma frase**? Exemplos: abrir chamado, status, planos, horário.');
});

// ---------------------- Start ----------------------
const PORT = process.env.PORT || 8080;
app.listen(PORT, () => console.log('SuporteNet webhook ouvindo na porta ' + PORT));
