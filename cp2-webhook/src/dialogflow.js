
/**
 * Helpers to build Dialogflow ES webhook responses
 * Docs: https://cloud.google.com/dialogflow/es/docs/fulfillment-webhook#webhook_response
 */
function textMessage(text) {
  return {
    fulfillmentMessages: [
      {
        text: { text: [text] }
      }
    ]
  };
}

function payloadMessage(payload) {
  return {
    fulfillmentMessages: [
      {
        payload
      }
    ]
  };
}

function richCard({title, subtitle, buttons}) {
  return {
    fulfillmentMessages: [
      {
        card: {
          title,
          subtitle,
          buttons: buttons || []
        }
      }
    ]
  };
}

function combine(messages) {
  // Flatten multiple fulfillmentMessages arrays into one.
  const combined = [];
  messages.forEach(msg => {
    if (msg && Array.isArray(msg.fulfillmentMessages)) {
      combined.push(...msg.fulfillmentMessages);
    }
  });
  return { fulfillmentMessages: combined };
}

module.exports = {
  textMessage,
  payloadMessage,
  richCard,
  combine
};
