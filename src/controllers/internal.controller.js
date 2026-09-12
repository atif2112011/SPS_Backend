import { sendSuccess, sendError } from '../utils/responseHelper.js';
import asyncWrapper from '../utils/asyncWrapper.js';
import notificationWorkerService from '../services/notificationWorker.service.js';
import ERROR_CODES from '../constants/errorCodes.js';

const runNotificationWorker = asyncWrapper(async (req, res) => {
  const configuredSecret = process.env.NOTIFICATION_WORKER_SECRET || process.env.CRON_SECRET;
  const suppliedSecret = req.headers.authorization?.replace(/^Bearer\s+/i, '');
  if (!configuredSecret || suppliedSecret !== configuredSecret) {
    return sendError(res, {
      message: 'Invalid worker credentials',
      errorCode: ERROR_CODES.UNAUTHORIZED,
      statusCode: 401,
      traceId: req.traceId,
    });
  }
  const result = await notificationWorkerService.runNotificationWorker();
  sendSuccess(res, { message: 'Notification worker completed', data: result });
});

export { runNotificationWorker };
export default { runNotificationWorker };
