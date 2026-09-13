import cron from 'node-cron';
import Assignment from '../models/Assignment.model.js';
import logger from '../config/logger.js';
import { publishEvent } from '../events/eventBus.js';
import EVENTS from '../constants/events.js';

let jobsStarted = false;

const runDailyAssignmentReminders = async () => {
  const now = new Date();
  const start = new Date(now.getTime() + 23.5 * 60 * 60 * 1000);
  const end = new Date(now.getTime() + 24.5 * 60 * 60 * 1000);

  const assignments = await Assignment.find({
    isDeleted: false,
    status: 'active',
    deadline: { $gte: start, $lte: end },
  });

  for (const assignment of assignments) {
    publishEvent(EVENTS.ASSIGNMENT_REMINDER_1D, { assignmentId: assignment._id });
  }
};

const runHourlyAssignmentDueReminders = async () => {
  const now = new Date();
  const end = new Date(now.getTime() + 60 * 60 * 1000);

  const assignments = await Assignment.find({
    isDeleted: false,
    status: 'active',
    deadline: { $gte: now, $lte: end },
  });

  for (const assignment of assignments) {
    publishEvent(EVENTS.ASSIGNMENT_DUE, { assignmentId: assignment._id });
  }
};

const startAssignmentReminderJobs = () => {
  if (jobsStarted) return;
  jobsStarted = true;

  cron.schedule('0 8 * * *', () => {
    runDailyAssignmentReminders().catch((err) => {
      logger.error('Daily assignment reminder job failed', { error: err.message });
    });
  });

  cron.schedule('0 * * * *', () => {
    runHourlyAssignmentDueReminders().catch((err) => {
      logger.error('Hourly assignment reminder job failed', { error: err.message });
    });
  });

  logger.info('Assignment reminder jobs scheduled');
};

export { startAssignmentReminderJobs, runDailyAssignmentReminders, runHourlyAssignmentDueReminders };
export default { startAssignmentReminderJobs, runDailyAssignmentReminders, runHourlyAssignmentDueReminders };
