export function buildText(text) {
  return { text: { text: [String(text)] } };
}

export function buildTelegram(payload) {
  return { payload: { telegram: payload } };
}

export function buildResponse(fulfillmentMessages, outputContexts) {
  const res = { fulfillmentMessages, source: "cp2-webhook" };
  if (outputContexts) res.outputContexts = outputContexts;
  return res;
}
