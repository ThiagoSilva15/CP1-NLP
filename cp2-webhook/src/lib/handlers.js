import { ulid } from "ulid";
import { saveRecord } from "./db.js";

function required(obj, fields) {
  const missing = fields.filter((f) => !obj || obj[f] === undefined || obj[f] === null || obj[f] === "");
  if (missing.length) throw new Error(`Campos obrigatórios ausentes: ${missing.join(", ")}`);
}

function normalizeKey(k) {
  return k
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/\s+/g, "_")
    .toLowerCase();
}

function normalizeParams(params) {
  const p = {};
  for (const [k, v] of Object.entries(params || {})) {
    p[normalizeKey(k)] = typeof v === "string" ? v.trim() : v;
  }
  return p;
}

function buildContext(body, name, params, lifespan = 10) {
  const session = body?.session || "";
  return [
    {
      name: `${session}/contexts/${name}`,
      lifespanCount: lifespan,
      parameters: params,
    },
  ];
}

export async function handleRestaurant(parameters, body) {
  // Esperado: nome, prato, quantidade, observacao (opcional)
  const p = normalizeParams(parameters);
  required(p, ["nome", "prato", "quantidade"]);

  const order = {
    id: "PED-" + ulid(),
    customer: p.nome,
    item: p.prato,
    qty: Number(p.quantidade),
    note: p.observacao || null,
    channel: body?.originalDetectIntentRequest?.source || "unknown",
    session: body?.session || "n/a",
  };

  await saveRecord("orders", order);

  return {
    message: `✅ Pedido confirmado!\nNúmero: ${order.id}\nCliente: ${order.customer}\nItem: ${order.item} (x${order.qty})${order.note ? `\nObs.: ${order.note}` : ""}\n\nAcompanhe seu pedido com o número acima.`,
    outputContexts: buildContext(body, "order-context", { orderId: order.id }, 10),
  };
}

export async function handleClinic(parameters, body) {
  // Esperado: nome, data, horario, tipo_consulta
  const p = normalizeParams(parameters);
  required(p, ["nome", "data", "horario", "tipo_consulta"]);

  const appt = {
    id: "AG-" + ulid(),
    patient: p.nome,
    date: p.data,
    time: p.horario,
    kind: p.tipo_consulta,
  };

  await saveRecord("appointments", appt);

  return {
    message: `🗓️ Agendamento criado!\nProtocolo: ${appt.id}\nPaciente: ${appt.patient}\nEspecialidade: ${appt.kind}\nData: ${appt.date} às ${appt.time}\n\nVocê receberá um lembrete no dia.`,
    outputContexts: buildContext(body, "clinic-context", { appointmentId: appt.id }, 10),
  };
}

export async function handleSupport(parameters, body) {
  // Esperado: nome, problema, prioridade (opcional)
  const p = normalizeParams(parameters);
  required(p, ["nome", "problema"]);

  const ticket = {
    id: "SUP-" + ulid(),
    requester: p.nome,
    description: p.problema,
    priority: (p.prioridade || "média").toLowerCase(),
  };

  await saveRecord("tickets", ticket);

  return {
    message: `📩 Chamado aberto!\nNº: ${ticket.id}\nSolicitante: ${ticket.requester}\nPrioridade: ${ticket.priority}\nResumo: ${ticket.description}\n\nUse o número acima para consultar o status.`,
    outputContexts: buildContext(body, "support-context", { ticketId: ticket.id }, 10),
  };
}
