import cron from 'node-cron';
import Assignment from '../models/Assignment.model.js';
import notificationService from '../services/notification.service.js';
import logger from '../config/logger.js';

let jobsStarted = false;

const sendAssignmentReminder = async ({ assignment, label, title, body }) => {
  const classRecipients = await notificationService.getStudentRecipientsForClassIds(assignment.classIds);
  const recipients = [...classRecipients, ...assignment.studentIds.map(String)];

  await notificationService.notifyFromEvent({
    recipients,
    title,
    body,
    type: 'reminder',
    entityType: 'Assignment',
    entityId: assignment._id,
    dedupeKeyPrefix: `assignment:${assignment._id}:${label}`,
  });
};

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
    await sendAssignmentReminder({
      assignment,
      label: 'reminder1d',
      title: 'Assignment due tomorrow',
      body: assignment.title,
    });
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
    await sendAssignmentReminder({
      assignment,
      label: 'due',
      title: 'Assignment due soon',
      body: assignment.title,
    });
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
