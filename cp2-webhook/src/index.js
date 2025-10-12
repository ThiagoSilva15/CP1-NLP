
const express = require('express');
const morgan = require('morgan');
const helmet = require('helmet');
const cors = require('cors');
const { v4: uuidv4 } = require('uuid');
const { textMessage, combine, richCard } = require('./dialogflow');
const store = require('./store');

const app = express();

app.use(helmet());
app.use(cors());
app.use(express.json({ limit: '2mb' }));
app.use(morgan('dev'));

app.get('/health', (_req, res) => {
  res.status(200).json({ ok: true, time: new Date().toISOString() });
});

// Data endpoints (helpful for evidence/prints)
app.get('/data/download', (_req, res) => {
  const data = store.readAll();
  res.status(200).json(data);
});

app.post('/data/clear', (_req, res) => {
  // reset db.json
  const fs = require('fs');
  const path = require('path');
  const DATA_DIR = path.join(__dirname, '..', 'data');
  const DB_FILE = path.join(DATA_DIR, 'db.json');
  fs.writeFileSync(DB_FILE, JSON.stringify({ chamados: [], agendamentos: [], pedidos: [] }, null, 2));
  res.status(200).json({ ok: true });
});

// --- Dialogflow Webhook ---
app.post('/webhook', async (req, res) => {
  try {
    const body = req.body || {};
    const intent = body?.queryResult?.intent?.displayName || 'unknown';
    const params = body?.queryResult?.parameters || {};
    const session = body?.session || 'no-session';

    const get = (obj, key, fallback=null) => (obj && obj[key] != null ? obj[key] : fallback);

    if (intent === 'intent.abrir_chamado') {
      const problema = get(params, 'problema');
      const endereco = get(params, 'endereco');
      const cidade = get(params, 'cidade');
      const plano = get(params, 'plano');
      const numeroCliente = get(params, 'numero_cliente');
      const janelaData = get(params, 'janela_data');
      const janelaHora = get(params, 'janela_hora');

      const missing = [];
      if (!problema) missing.push('problema');
      if (!endereco) missing.push('endereco');
      if (!cidade) missing.push('cidade');
      if (!numeroCliente) missing.push('numero_cliente');

      if (missing.length) {
        return res.json(textMessage(
          `Preciso de mais alguns dados para abrir o chamado: ${missing.join(', ')}. ` +
          `Pode me informar, por favor?`
        ));
      }

      const protocolo = 'SN-' + uuidv4().split('-')[0].toUpperCase();
      const chamado = {
        protocolo,
        problema,
        endereco,
        cidade,
        plano,
        numeroCliente,
        janela: { data: janelaData, hora: janelaHora },
        status: 'ABERTO',
        session,
        createdAt: new Date().toISOString()
      };
      store.addChamado(chamado);

      return res.json(combine([
        textMessage(`✅ Chamado aberto com sucesso!`),
        textMessage(`Protocolo: ${protocolo}`),
        textMessage(`Resumo: ${problema} em ${endereco}, ${cidade}. Plano: ${plano || 'não informado'}.`),
        textMessage(`Janela preferencial: ${janelaData || '—'} ${janelaHora || ''}`),
        richCard({
          title: `Protocolo ${protocolo}`,
          subtitle: `Status: ABERTO • Cliente: ${numeroCliente}`,
          buttons: [
            { text: 'Baixar dados', postback: '/data/download' }
          ]
        })
      ]));
    }

    if (intent === 'intent.status_chamado') {
      const protocolo = get(params, 'protocolo');
      if (!protocolo) {
        return res.json(textMessage('Qual é o número do protocolo, por favor?'));
      }
      const chamado = store.getChamadoByProtocolo(protocolo);
      if (!chamado) {
        return res.json(textMessage(`Não encontrei o protocolo ${protocolo}. Confere se está correto?`));
      }
      return res.json(combine([
        textMessage(`📄 Protocolo ${chamado.protocolo}`),
        textMessage(`Status atual: ${chamado.status}`),
        textMessage(`Abertura: ${new Date(chamado.createdAt).toLocaleString('pt-BR')}`),
      ]));
    }

    if (intent === 'intent.faq') {
      const topico = get(params, 'faq_topico') || 'geral';
      if (String(topico).toLowerCase().includes('cancelar')) {
        return res.json(textMessage('Para cancelar, acesse Área do Cliente > Assinatura > Cancelar. Posso ajudar com mais algo?'));
      }
      return res.json(textMessage('SuporteNet responde: velocidade, fatura e suporte técnico em até 24h. Qual tópico específico?'));
    }

    if (intent === 'intent.welcome_identificacao') {
      const nome = get(params, 'nome') || 'cliente';
      const contato = get(params, 'contato') || 'não informado';
      return res.json(textMessage(`Olá, ${nome}! Já registrei seu contato (${contato}). Como posso ajudar hoje?`));
    }

    if (intent === 'restaurante.pedido') {
      const sabor = get(params, 'sabor') || 'marguerita';
      const tamanho = get(params, 'tamanho') || 'médio';
      const id = 'PED-' + uuidv4().split('-')[0].toUpperCase();
      store.addPedido({ id, sabor, tamanho, createdAt: new Date().toISOString() });
      return res.json(textMessage(`🍕 Pedido ${id} registrado: ${tamanho} ${sabor}.`));
    }

    if (intent === 'clinica.agendar') {
      const nome = get(params, 'nome') || 'Paciente';
      const data = get(params, 'data');
      const especialidade = get(params, 'especialidade') || 'Clínico Geral';
      const id = 'AG-' + uuidv4().split('-')[0].toUpperCase();
      store.addAgendamento({ id, nome, data, especialidade, createdAt: new Date().toISOString() });
      return res.json(textMessage(`🗓️ Agendamento ${id} feito para ${nome} em ${data || 'data a combinar'} (${especialidade}).`));
    }

    return res.json(textMessage(`Intent '${intent}' recebida no webhook. Configure a lógica conforme necessário.`));
  } catch (err) {
    console.error('Webhook error', err);
    return res.json(textMessage('Ocorreu um erro no webhook. Tente novamente em instantes.'));
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`CP2 Webhook listening on :${PORT}`);
});
