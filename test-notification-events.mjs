import dotenv from 'dotenv';
dotenv.config();

import mongoose from 'mongoose';
import User from './src/models/User.model.js';
import StudentProfile from './src/models/StudentProfile.model.js';
import Class from './src/models/Class.model.js';
import Notice from './src/models/Notice.model.js';
import Assignment from './src/models/Assignment.model.js';
import Timetable from './src/models/Timetable.model.js';
import ReportCard from './src/models/ReportCard.model.js';
import Result from './src/models/Result.model.js';
import Notification from './src/models/Notification.model.js';
import NotificationCampaign from './src/models/NotificationCampaign.model.js';
import NotificationDelivery from './src/models/NotificationDelivery.model.js';
import EVENTS from './src/constants/events.js';
import notificationEventService from './src/services/notificationEvent.service.js';

await mongoose.connect(process.env.MONGODB_URI);
const suffix = `${Date.now()}-${new mongoose.Types.ObjectId()}`;
const created = {};

try {
  created.user = await User.create({
    role: 'student',
    username: `notification-event-test-${suffix}`,
    passwordHash: 'not-used-by-test',
    status: 'active',
    name: 'Notification Event Test Student',
  });
  created.class = await Class.create({
    className: `Notification Test ${suffix}`,
    section: 'T',
    academicYear: '2099-2100',
    progressionOrder: 99,
    studentIds: [created.user._id],
  });
  created.profile = await StudentProfile.create({
    userId: created.user._id,
    admissionNo: `NOTIFY-${suffix}`,
    classId: created.class._id,
    section: 'T',
  });
  created.notice = await Notice.create({
    title: 'Temporary event notice',
    message: 'Temporary event test',
    audienceType: 'specific_students',
    studentIds: [created.user._id],
    createdBy: created.user._id,
    createdByRole: 'admin',
  });
  created.assignment = await Assignment.create({
    title: 'Temporary event assignment',
    description: 'Temporary event test',
    studentIds: [created.user._id],
    deadline: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000),
    assignedBy: created.user._id,
    assignedByRole: 'admin',
  });
  created.timetable = await Timetable.create({
    classId: created.class._id,
    schedule: [{ day: 'Monday', periods: [{ startTime: '09:00', endTime: '09:45', subject: 'Test' }] }],
    updatedBy: created.user._id,
  });
  created.reportCard = await ReportCard.create({
    studentId: created.user._id,
    classId: created.class._id,
    term: 'Temporary Term',
    academicYear: '2099-2100',
    createdBy: created.user._id,
  });
  created.result = await Result.create({
    studentId: created.user._id,
    classId: created.class._id,
    examName: 'Temporary Exam',
    academicYear: '2099-2100',
    createdBy: created.user._id,
  });

  const cases = [
    [EVENTS.NOTICE_CREATED, { noticeId: created.notice._id }, 'New notice', 'notice'],
    [EVENTS.NOTICE_UPDATED, { noticeId: created.notice._id, eventVersion: `${suffix}-notice` }, 'Notice updated', 'notice'],
    [EVENTS.ASSIGNMENT_CREATED, { assignmentId: created.assignment._id }, 'New assignment', 'assignment'],
    [EVENTS.ASSIGNMENT_UPDATED, { assignmentId: created.assignment._id, eventVersion: `${suffix}-assignment` }, 'Assignment updated', 'assignment'],
    [EVENTS.ASSIGNMENT_REMINDER_1D, { assignmentId: created.assignment._id }, 'Assignment due tomorrow', 'reminder'],
    [EVENTS.ASSIGNMENT_DUE, { assignmentId: created.assignment._id }, 'Assignment due soon', 'reminder'],
    [EVENTS.TIMETABLE_CREATED, { timetableId: created.timetable._id, classId: created.class._id }, 'Timetable published', 'timetable'],
    [EVENTS.TIMETABLE_UPDATED, { timetableId: created.timetable._id, classId: created.class._id, eventVersion: `${suffix}-timetable` }, 'Timetable updated', 'timetable'],
    [EVENTS.REPORT_CARD_UPLOADED, { reportCardId: created.reportCard._id }, 'Report card uploaded', 'reportCard'],
    [EVENTS.REPORT_CARD_UPDATED, { reportCardId: created.reportCard._id, eventVersion: `${suffix}-report` }, 'Report card updated', 'reportCard'],
    [EVENTS.RESULT_CREATED, { resultId: created.result._id }, 'New result published', 'result'],
    [EVENTS.RESULT_UPDATED, { resultId: created.result._id, eventVersion: `${suffix}-result` }, 'Result updated', 'result'],
  ];

  for (const [eventName, payload, expectedTitle, expectedType] of cases) {
    const queued = await notificationEventService.queueForEvent(eventName, payload);
    if (!queued || queued.createdCount !== 1) throw new Error(`${eventName} did not create one user notification`);
    const notification = await Notification.findOne({ recipientUserId: created.user._id, title: expectedTitle, type: expectedType });
    if (!notification) throw new Error(`${eventName} created the wrong notification payload`);
  }

  const campaigns = await NotificationCampaign.find({ studentIds: created.user._id });
  if (campaigns.length !== cases.length) throw new Error(`Expected ${cases.length} campaigns, found ${campaigns.length}`);
  if (campaigns.some((campaign) => campaign.deviceCount !== 0 || campaign.pendingCount !== 0)) {
    throw new Error('Temporary event test unexpectedly resolved a device');
  }

  console.log(`PASS ${cases.length}/${cases.length} notification event mappings queued correctly`);
} finally {
  const campaignIds = await NotificationCampaign.find({ studentIds: created.user?._id }).distinct('_id');
  if (campaignIds.length) await NotificationDelivery.deleteMany({ campaignId: { $in: campaignIds } });
  if (created.user?._id) {
    await Promise.all([
      Notification.deleteMany({ recipientUserId: created.user._id }),
      NotificationCampaign.deleteMany({ studentIds: created.user._id }),
    ]);
  }
  if (created.timetable?._id) await Timetable.deleteOne({ _id: created.timetable._id });
  if (created.result?._id) await Result.deleteOne({ _id: created.result._id });
  if (created.reportCard?._id) await ReportCard.deleteOne({ _id: created.reportCard._id });
  if (created.assignment?._id) await Assignment.deleteOne({ _id: created.assignment._id });
  if (created.notice?._id) await Notice.deleteOne({ _id: created.notice._id });
  if (created.profile?._id) await StudentProfile.deleteOne({ _id: created.profile._id });
  if (created.class?._id) await Class.deleteOne({ _id: created.class._id });
  if (created.user?._id) await User.deleteOne({ _id: created.user._id });
  await mongoose.disconnect();
}
