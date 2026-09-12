import dotenv from 'dotenv';
dotenv.config();

import mongoose from 'mongoose';
import User from './src/models/User.model.js';
import StudentProfile from './src/models/StudentProfile.model.js';
import DeviceToken from './src/models/DeviceToken.model.js';
import Notification from './src/models/Notification.model.js';
import NotificationCampaign from './src/models/NotificationCampaign.model.js';
import NotificationDelivery from './src/models/NotificationDelivery.model.js';
import campaignService from './src/services/notificationCampaign.service.js';
import workerService from './src/services/notificationWorker.service.js';

const checks = [];
const check = (label, passed) => checks.push({ label, passed: Boolean(passed) });

await mongoose.connect(process.env.MONGODB_URI);
const [admin, student] = await Promise.all([
  User.findOne({ role: 'admin', status: 'active' }),
  User.findOne({ username: 'class6_test_20260912123215', role: 'student', status: 'active' }),
]);
if (!admin || !student) throw new Error('Notification test requires an active admin and the Class 6 test student');

const profile = await StudentProfile.findOne({ userId: student._id });
const suffix = `${Date.now()}-${new mongoose.Types.ObjectId()}`;
let device;
const campaignIds = [];

try {
  device = await DeviceToken.create({
    userId: student._id,
    token: `test-fcm-token-${suffix}`,
    platform: 'android',
    deviceId: `test-device-${suffix}`,
    appVersion: 'test',
    enabled: true,
  });

  const personPreview = await campaignService.previewCampaign({ audienceType: 'specific_students', studentIds: [student._id] });
  check('specific-student audience resolves an Android device', personPreview.recipientCount === 1 && personPreview.deviceCount >= 1);

  if (profile?.classId) {
    const classPreview = await campaignService.previewCampaign({ audienceType: 'specific_classes', classIds: [profile.classId] });
    check('class audience includes the assigned test student', classPreview.recipientCount >= 1 && classPreview.deviceCount >= 1);
  }

  const idempotencyKey = `notification-test-${suffix}`;
  const payload = {
    title: 'Temporary notification test',
    body: 'No real push is sent by this integration test.',
    audienceType: 'specific_students',
    studentIds: [student._id],
    destination: 'home',
    idempotencyKey,
  };
  const firstCreate = await campaignService.createCampaign(payload, { userId: admin._id, role: 'admin' });
  campaignIds.push(firstCreate.campaign._id);
  const duplicateCreate = await campaignService.createCampaign(payload, { userId: admin._id, role: 'admin' });
  check('campaign creation is idempotent', !firstCreate.duplicate && duplicateCreate.duplicate && String(firstCreate.campaign._id) === String(duplicateCreate.campaign._id));
  check('custom campaign remains push-only', await Notification.countDocuments({ entityId: firstCreate.campaign._id }) === 0);

  const transientFailure = async ({ tokens }) => tokens.map(() => ({
    success: false,
    errorCode: 'messaging/server-unavailable',
    errorMessage: 'Injected retryable test failure',
  }));

  for (let attempt = 1; attempt <= 3; attempt += 1) {
    await NotificationDelivery.updateMany(
      { campaignId: firstCreate.campaign._id, status: 'retry_scheduled' },
      { $set: { nextAttemptAt: new Date(0) } }
    );
    await workerService.runNotificationWorker({ sendBatch: transientFailure, campaignIds: [firstCreate.campaign._id] });
    const delivery = await NotificationDelivery.findOne({ campaignId: firstCreate.campaign._id });
    check(`delivery attempt ${attempt} recorded`, delivery?.attemptCount === attempt);
  }

  const fourthRun = await workerService.runNotificationWorker({ sendBatch: transientFailure, campaignIds: [firstCreate.campaign._id] });
  const finalDelivery = await NotificationDelivery.findOne({ campaignId: firstCreate.campaign._id });
  check('three total attempts are enforced', fourthRun.claimed === 0 && finalDelivery?.status === 'failed' && finalDelivery?.attemptCount === 3);

  const scheduled = await campaignService.createCampaign({
    ...payload,
    idempotencyKey: `${idempotencyKey}-scheduled`,
    scheduledAt: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
  }, { userId: admin._id, role: 'admin' });
  campaignIds.push(scheduled.campaign._id);
  const cancelled = await campaignService.cancelCampaign(scheduled.campaign._id);
  const cancelledDeliveries = await NotificationDelivery.countDocuments({ campaignId: scheduled.campaign._id, status: 'cancelled' });
  check('scheduled campaigns can be cancelled', cancelled.status === 'cancelled' && cancelledDeliveries === scheduled.campaign.deviceCount);
} finally {
  if (campaignIds.length) {
    await NotificationDelivery.deleteMany({ campaignId: { $in: campaignIds } });
    await NotificationCampaign.deleteMany({ _id: { $in: campaignIds } });
  }
  if (device?._id) await DeviceToken.deleteOne({ _id: device._id });
  await mongoose.disconnect();
}

for (const item of checks) console.log(`${item.passed ? 'PASS' : 'FAIL'} ${item.label}`);
const failures = checks.filter((item) => !item.passed);
console.log(`\n${checks.length - failures.length}/${checks.length} passed`);
if (failures.length) process.exit(1);
