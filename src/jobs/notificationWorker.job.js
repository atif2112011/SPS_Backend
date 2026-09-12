import cron from 'node-cron';
import notificationWorkerService from '../services/notificationWorker.service.js';
import logger from '../config/logger.js';

let started = false;

const startNotificationWorkerJob = () => {
  if (started) return;
  started = true;
  cron.schedule('* * * * *', () => {
    notificationWorkerService.runNotificationWorker().catch((err) => {
      logger.error('Notification worker failed', { error: err.message });
    });
  });
  logger.info('Notification delivery worker scheduled');
};

export { startNotificationWorkerJob };
export default { startNotificationWorkerJob };
