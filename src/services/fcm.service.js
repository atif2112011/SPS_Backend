const { getMessaging } = require('../config/firebase');
const logger = require('../config/logger');

const chunk = (items, size) => {
  const chunks = [];
  for (let i = 0; i < items.length; i += size) chunks.push(items.slice(i, i + size));
  return chunks;
};

const sendPushToTokens = async ({ tokens, title, body, data = {} }) => {
  const uniqueTokens = [...new Set((tokens || []).filter(Boolean))];
  if (uniqueTokens.length === 0) {
    return { successCount: 0, failureCount: 0 };
  }

  let successCount = 0;
  let failureCount = 0;

  try {
    const messaging = getMessaging();
    const batches = chunk(uniqueTokens, 500);

    for (const batch of batches) {
      const response = await messaging.sendEachForMulticast({
        tokens: batch,
        notification: { title, body },
        data: Object.fromEntries(
          Object.entries(data).map(([key, value]) => [key, String(value)])
        ),
      });
      successCount += response.successCount;
      failureCount += response.failureCount;
    }
  } catch (err) {
    failureCount = uniqueTokens.length;
    logger.warn('FCM push skipped or failed', { error: err.message });
  }

  return { successCount, failureCount };
};

module.exports = { sendPushToTokens };
