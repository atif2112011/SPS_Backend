require('dotenv').config();
const app = require('./src/app');
const connectDB = require('./src/config/db');
const logger = require('./src/config/logger');
const { initFirebase } = require('./src/config/firebase');
const registerNotificationListeners = require('./src/events/notification.listeners');
const { startAssignmentReminderJobs } = require('./src/jobs/assignmentReminder.job');

const PORT = process.env.PORT || 5000;

const start = async () => {
  initFirebase();
  registerNotificationListeners();
  await connectDB();
  startAssignmentReminderJobs();
  app.listen(PORT, () => {
    logger.info(`SPS API running on port ${PORT} [${process.env.NODE_ENV}]`);
  });
};

start().catch((err) => {
  logger.error('Failed to start server', err);
  process.exit(1);
});
