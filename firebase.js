import 'dotenv/config';
import { setGlobalOptions } from 'firebase-functions/v2';
import { onRequest } from 'firebase-functions/v2/https';
import { onSchedule } from 'firebase-functions/v2/scheduler';
import app from './src/app.js';
import { bootstrap } from './src/bootstrap.js';
import logger from './src/config/logger.js';
import notificationWorkerService from './src/services/notificationWorker.service.js';
import {
  runDailyAssignmentReminders,
  runHourlyAssignmentDueReminders,
} from './src/jobs/assignmentReminder.job.js';

const REGION = 'asia-south1';

setGlobalOptions({
  region: REGION,
  memory: '512MiB',
  timeoutSeconds: 120,
  minInstances: 0,
  maxInstances: 10,
  concurrency: 20,
});

const runScheduledTask = async (taskName, task) => {
  const startedAt = Date.now();
  await bootstrap();
  const result = await task();
  logger.info('Scheduled function completed', {
    taskName,
    durationMs: Date.now() - startedAt,
    result,
  });
  return result;
};

const spsApi = onRequest({ invoker: 'public' }, async (req, res) => {
  try {
    await bootstrap();
    return app(req, res);
  } catch (error) {
    logger.error('Firebase API bootstrap failed', {
      method: req.method,
      path: req.originalUrl || req.url,
      error: error.message,
      stack: error.stack,
    });
    if (!res.headersSent) {
      return res.status(503).json({
        success: false,
        message: 'Service temporarily unavailable',
        errorCode: 'SERVICE_UNAVAILABLE',
      });
    }
    return undefined;
  }
});

const notificationWorker = onSchedule({
  schedule: '* * * * *',
  timeZone: 'Asia/Kolkata',
  timeoutSeconds: 300,
  maxInstances: 1,
  concurrency: 1,
  retryCount: 0,
}, () => runScheduledTask(
  'notificationWorker',
  () => notificationWorkerService.runNotificationWorker(),
));

const hourlyAssignmentReminders = onSchedule({
  schedule: '0 * * * *',
  timeZone: 'Asia/Kolkata',
  timeoutSeconds: 300,
  maxInstances: 1,
  concurrency: 1,
  retryCount: 0,
}, () => runScheduledTask(
  'hourlyAssignmentReminders',
  runHourlyAssignmentDueReminders,
));

const dailyAssignmentReminders = onSchedule({
  schedule: '0 8 * * *',
  timeZone: 'Asia/Kolkata',
  timeoutSeconds: 300,
  maxInstances: 1,
  concurrency: 1,
  retryCount: 0,
}, () => runScheduledTask(
  'dailyAssignmentReminders',
  runDailyAssignmentReminders,
));

export {
  spsApi,
  notificationWorker,
  hourlyAssignmentReminders,
  dailyAssignmentReminders,
};
