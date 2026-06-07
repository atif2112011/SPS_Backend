import eventBus from './eventBus.js';
import EVENTS from '../constants/events.js';
import Notice from '../models/Notice.model.js';
import Assignment from '../models/Assignment.model.js';
import Timetable from '../models/Timetable.model.js';
import ReportCard from '../models/ReportCard.model.js';
import Result from '../models/Result.model.js';
import notificationService from '../services/notification.service.js';
import logger from '../config/logger.js';

let listenersRegistered = false;

const onAsync = (eventName, handler) => {
  eventBus.on(eventName, (...args) => {
    handler(...args).catch((err) => {
      logger.error('Notification listener failed', { eventName, error: err.message });
    });
  });
};

const registerNotificationListeners = () => {
  if (listenersRegistered) return;
  listenersRegistered = true;

  onAsync(EVENTS.NOTICE_CREATED, async ({ noticeId }) => {
    const notice = await Notice.findById(noticeId);
    if (!notice || notice.status !== 'active' || notice.isDeleted) return;

    const recipients = await notificationService.resolveStudentRecipients({
      audienceType: notice.audienceType,
      classIds: notice.classIds,
      studentIds: notice.studentIds,
    });

    await notificationService.notifyFromEvent({
      recipients,
      title: 'New notice',
      body: notice.title,
      type: 'notice',
      entityType: 'Notice',
      entityId: notice._id,
      dedupeKeyPrefix: `notice:${notice._id}`,
    });
  });

  onAsync(EVENTS.ASSIGNMENT_CREATED, async ({ assignmentId }) => {
    const assignment = await Assignment.findById(assignmentId);
    if (!assignment || assignment.status !== 'active' || assignment.isDeleted) return;

    const classRecipients = await notificationService.getStudentRecipientsForClassIds(assignment.classIds);
    const recipients = [...classRecipients, ...assignment.studentIds.map(String)];

    await notificationService.notifyFromEvent({
      recipients,
      title: 'New assignment',
      body: assignment.title,
      type: 'assignment',
      entityType: 'Assignment',
      entityId: assignment._id,
      dedupeKeyPrefix: `assignment:${assignment._id}:created`,
    });
  });

  onAsync(EVENTS.TIMETABLE_UPDATED, async ({ timetableId, classId }) => {
    const timetable = await Timetable.findById(timetableId);
    if (!timetable) return;

    const recipients = await notificationService.getStudentRecipientsForClassIds([classId || timetable.classId]);

    await notificationService.notifyFromEvent({
      recipients,
      title: 'Timetable updated',
      body: 'Your class timetable has been updated',
      type: 'timetable',
      entityType: 'Timetable',
      entityId: timetable._id,
      dedupeKeyPrefix: `timetable:${timetable._id}:${Date.now()}`,
    });
  });

  onAsync(EVENTS.REPORT_CARD_UPLOADED, async ({ reportCardId }) => {
    const reportCard = await ReportCard.findById(reportCardId);
    if (!reportCard || reportCard.isDeleted) return;

    await notificationService.notifyFromEvent({
      recipients: [reportCard.studentId],
      title: 'Report card uploaded',
      body: `${reportCard.term} report card is available`,
      type: 'reportCard',
      entityType: 'ReportCard',
      entityId: reportCard._id,
      dedupeKeyPrefix: `reportCard:${reportCard._id}:uploaded`,
    });
  });

  onAsync(EVENTS.RESULT_UPDATED, async ({ resultId }) => {
    const result = await Result.findById(resultId);
    if (!result || result.isDeleted) return;

    await notificationService.notifyFromEvent({
      recipients: [result.studentId],
      title: 'Result updated',
      body: `${result.examName} result is available`,
      type: 'result',
      entityType: 'Result',
      entityId: result._id,
      dedupeKeyPrefix: `result:${result._id}:updated`,
    });
  });

  eventBus.on('error', (err) => {
    logger.error('Notification event bus error', { error: err.message });
  });
};

export default registerNotificationListeners;
