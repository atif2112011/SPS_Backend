import connectDB from './config/db.js';
import logger from './config/logger.js';
import { initFirebase } from './config/firebase.js';
import registerNotificationListeners from './events/notification.listeners.js';
import { startAssignmentReminderJobs } from './jobs/assignmentReminder.job.js';
import { isVercelRuntime } from './utils/env.js';

let bootPromise;
let listenersRegistered = false;
let reminderJobsStarted = false;

const bootstrap = async ({ startJobs = !isVercelRuntime() } = {}) => {
  if (!bootPromise) {
    bootPromise = (async () => {
      initFirebase();
      if (!listenersRegistered) {
        registerNotificationListeners();
        listenersRegistered = true;
      }
      await connectDB();
    })().catch((err) => {
      bootPromise = undefined;
      throw err;
    });
  }

  await bootPromise;

  if (startJobs && !reminderJobsStarted) {
    startAssignmentReminderJobs();
    reminderJobsStarted = true;
  } else if (!startJobs && isVercelRuntime()) {
    logger.debug('Skipping in-process reminder jobs on Vercel');
  }
};

export { bootstrap };
export default { bootstrap };
