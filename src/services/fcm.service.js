import { getMessaging } from '../config/firebase.js';

const sendPushBatch = async ({ tokens, title, body, data = {} }) => {
  if (!tokens?.length) return [];
  const messaging = getMessaging();
  const response = await messaging.sendEachForMulticast({
    tokens,
    notification: { title, body },
    android: {
      priority: 'high',
      notification: { channelId: 'default', sound: 'default' },
    },
    data: Object.fromEntries(Object.entries(data).map(([key, value]) => [key, String(value)])),
  });
  return response.responses.map((result) => ({
    success: result.success,
    messageId: result.messageId,
    errorCode: result.error?.code,
    errorMessage: result.error?.message,
  }));
};

export { sendPushBatch };
export default { sendPushBatch };
