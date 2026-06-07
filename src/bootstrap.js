const connectDB = require('./config/db');
const logger = require('./config/logger');
const { initFirebase } = require('./config/firebase');
const registerNotificationListeners = require('./events/notification.listeners');
const { startAssignmentReminderJobs } = require('./jobs/assignmentReminder.job');
const { isVercelRuntime } = require('./utils/env');

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

module.exports = { bootstrap };
