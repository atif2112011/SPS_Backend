import Assignment from '../models/Assignment.model.js';
import EVENTS from '../constants/events.js';
import notificationEventService from '../services/notificationEvent.service.js';

const queueReminderEvents = async (eventName, assignments) => {
  const results = await Promise.all(assignments.map((assignment) => (
    notificationEventService.queueForEvent(eventName, { assignmentId: assignment._id })
  )));
  return {
    matched: assignments.length,
    queued: results.filter(Boolean).length,
  };
};

const runDailyAssignmentReminders = async () => {
  const now = new Date();
  const start = new Date(now.getTime() + 23.5 * 60 * 60 * 1000);
  const end = new Date(now.getTime() + 24.5 * 60 * 60 * 1000);

  const assignments = await Assignment.find({
    isDeleted: false,
    status: 'active',
    deadline: { $gte: start, $lte: end },
  }).select('_id').lean();

  return queueReminderEvents(EVENTS.ASSIGNMENT_REMINDER_1D, assignments);
};

const runHourlyAssignmentDueReminders = async () => {
  const now = new Date();
  const end = new Date(now.getTime() + 60 * 60 * 1000);

  const assignments = await Assignment.find({
    isDeleted: false,
    status: 'active',
    deadline: { $gte: now, $lte: end },
  }).select('_id').lean();

  return queueReminderEvents(EVENTS.ASSIGNMENT_DUE, assignments);
};

export { runDailyAssignmentReminders, runHourlyAssignmentDueReminders };
export default { runDailyAssignmentReminders, runHourlyAssignmentDueReminders };
