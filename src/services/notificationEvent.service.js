import Notice from '../models/Notice.model.js';
import Assignment from '../models/Assignment.model.js';
import Timetable from '../models/Timetable.model.js';
import ReportCard from '../models/ReportCard.model.js';
import Result from '../models/Result.model.js';
import EVENTS from '../constants/events.js';
import notificationService from './notification.service.js';

const activeDocument = (document) => document && !document.isDeleted && (!document.status || document.status === 'active');
const versionSuffix = (payload, document) => payload.eventVersion || document.updatedAt?.getTime() || document.createdAt?.getTime();

const noticePayload = async (eventName, payload) => {
  const notice = await Notice.findById(payload.noticeId);
  if (!activeDocument(notice)) return null;
  const recipients = await notificationService.resolveStudentRecipients({
    audienceType: notice.audienceType,
    classIds: notice.classIds,
    studentIds: notice.studentIds,
  });
  const updated = eventName === EVENTS.NOTICE_UPDATED;
  return {
    recipients,
    title: updated ? 'Notice updated' : 'New notice',
    body: notice.title,
    type: 'notice',
    entityType: 'Notice',
    entityId: notice._id,
    dedupeKeyPrefix: `notice:${notice._id}:${updated ? `updated:${versionSuffix(payload, notice)}` : 'created'}`,
  };
};

const assignmentPayload = async (eventName, payload) => {
  const assignment = await Assignment.findById(payload.assignmentId);
  if (!activeDocument(assignment)) return null;
  const classRecipients = await notificationService.getStudentRecipientsForClassIds(assignment.classIds);
  const updated = eventName === EVENTS.ASSIGNMENT_UPDATED;
  const reminder1d = eventName === EVENTS.ASSIGNMENT_REMINDER_1D;
  const dueSoon = eventName === EVENTS.ASSIGNMENT_DUE;
  const isReminder = reminder1d || dueSoon;
  const eventLabel = reminder1d
    ? 'reminder1d'
    : dueSoon
      ? 'due'
      : updated
        ? `updated:${versionSuffix(payload, assignment)}`
        : 'created';
  return {
    recipients: [...classRecipients, ...assignment.studentIds.map(String)],
    title: reminder1d
      ? 'Assignment due tomorrow'
      : dueSoon
        ? 'Assignment due soon'
        : updated
          ? 'Assignment updated'
          : 'New assignment',
    body: assignment.title,
    type: isReminder ? 'reminder' : 'assignment',
    entityType: 'Assignment',
    entityId: assignment._id,
    dedupeKeyPrefix: `assignment:${assignment._id}:${eventLabel}`,
  };
};

const timetablePayload = async (eventName, payload) => {
  const timetable = await Timetable.findById(payload.timetableId);
  if (!timetable) return null;
  const created = eventName === EVENTS.TIMETABLE_CREATED;
  return {
    recipients: await notificationService.getStudentRecipientsForClassIds([payload.classId || timetable.classId]),
    title: created ? 'Timetable published' : 'Timetable updated',
    body: created ? 'Your class timetable is now available' : 'Your class timetable has been updated',
    type: 'timetable',
    entityType: 'Timetable',
    entityId: timetable._id,
    dedupeKeyPrefix: `timetable:${timetable._id}:${created ? 'created' : `updated:${versionSuffix(payload, timetable)}`}`,
  };
};

const reportCardPayload = async (eventName, payload) => {
  const reportCard = await ReportCard.findById(payload.reportCardId);
  if (!activeDocument(reportCard)) return null;
  const updated = eventName === EVENTS.REPORT_CARD_UPDATED;
  return {
    recipients: [reportCard.studentId],
    title: updated ? 'Report card updated' : 'Report card uploaded',
    body: `${reportCard.term} report card is available`,
    type: 'reportCard',
    entityType: 'ReportCard',
    entityId: reportCard._id,
    dedupeKeyPrefix: `reportCard:${reportCard._id}:${updated ? `updated:${versionSuffix(payload, reportCard)}` : 'uploaded'}`,
  };
};

const resultPayload = async (eventName, payload) => {
  const result = await Result.findById(payload.resultId);
  if (!activeDocument(result)) return null;
  const updated = eventName === EVENTS.RESULT_UPDATED;
  return {
    recipients: [result.studentId],
    title: updated ? 'Result updated' : 'New result published',
    body: `${result.examName} result is available`,
    type: 'result',
    entityType: 'Result',
    entityId: result._id,
    dedupeKeyPrefix: `result:${result._id}:${updated ? `updated:${versionSuffix(payload, result)}` : 'created'}`,
  };
};

const builders = new Map([
  [EVENTS.NOTICE_CREATED, noticePayload],
  [EVENTS.NOTICE_UPDATED, noticePayload],
  [EVENTS.ASSIGNMENT_CREATED, assignmentPayload],
  [EVENTS.ASSIGNMENT_UPDATED, assignmentPayload],
  [EVENTS.ASSIGNMENT_REMINDER_1D, assignmentPayload],
  [EVENTS.ASSIGNMENT_DUE, assignmentPayload],
  [EVENTS.TIMETABLE_CREATED, timetablePayload],
  [EVENTS.TIMETABLE_UPDATED, timetablePayload],
  [EVENTS.REPORT_CARD_UPLOADED, reportCardPayload],
  [EVENTS.REPORT_CARD_UPDATED, reportCardPayload],
  [EVENTS.RESULT_CREATED, resultPayload],
  [EVENTS.RESULT_UPDATED, resultPayload],
]);

const queueForEvent = async (eventName, payload) => {
  const builder = builders.get(eventName);
  if (!builder) return null;
  const notification = await builder(eventName, payload);
  if (!notification || notification.recipients.length === 0) return null;
  return notificationService.notifyFromEvent(notification);
};

const supportedEvents = [...builders.keys()];

export { queueForEvent, supportedEvents };
export default { queueForEvent, supportedEvents };
