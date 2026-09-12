import dotenv from 'dotenv';
dotenv.config();

import mongoose from 'mongoose';
import User from './src/models/User.model.js';
import Notice from './src/models/Notice.model.js';
import Notification from './src/models/Notification.model.js';
import dashboardService from './src/services/dashboard.service.js';
import { signAccessToken } from './src/utils/tokenUtils.js';

const checks = [];
const check = (label, passed, detail = '') => checks.push({ label, passed: Boolean(passed), detail });

await mongoose.connect(process.env.MONGODB_URI);
const [{ default: app }, student, admin] = await Promise.all([
  import('./src/app.js'),
  User.findOne({ username: 'class6_test_20260912123215', role: 'student', status: 'active' }),
  User.findOne({ role: 'admin', status: 'active' }),
]);

if (!student || !admin) throw new Error('Dashboard validation requires an active test student and admin');

const token = signAccessToken({ userId: student._id, role: student.role });
const server = await new Promise((resolve) => {
  const instance = app.listen(0, '127.0.0.1', () => resolve(instance));
});

let notice;
let notification;

async function call(path, options = {}) {
  const response = await fetch(`http://127.0.0.1:${server.address().port}/api/v1${path}`, {
    method: options.method || 'GET',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
  });
  return { response, payload: await response.json() };
}

try {
  notice = await Notice.create({
    title: 'Dashboard metric test notice',
    message: 'Temporary record used by the dashboard integration test.',
    audienceType: 'specific_students',
    studentIds: [student._id],
    createdBy: admin._id,
    createdByRole: 'admin',
    status: 'active',
  });
  notification = await Notification.create({
    recipientUserId: student._id,
    recipientRole: 'student',
    title: 'New notice',
    body: notice.title,
    type: 'notice',
    entityType: 'Notice',
    entityId: notice._id,
    dedupeKey: `dashboard-test:${notice._id}:${student._id}`,
  });

  const initial = await call('/dashboard');
  const initialMetrics = initial.payload.data?.metrics;
  check('GET /dashboard returns metrics', initial.response.ok && Number.isInteger(initialMetrics?.dueAssignments) && Number.isInteger(initialMetrics?.unreadNotices));

  const firstRead = await call(`/notices/${notice._id}/read`, { method: 'POST' });
  const firstMetrics = firstRead.payload.data?.metrics;
  check('opening a notice reduces unread notices once', firstRead.response.ok && firstMetrics?.unreadNotices === initialMetrics.unreadNotices - 1);

  const secondRead = await call(`/notices/${notice._id}/read`, { method: 'POST' });
  const secondMetrics = secondRead.payload.data?.metrics;
  check('opening the same notice again is idempotent', secondRead.response.ok && secondRead.payload.data?.modifiedCount === 0 && secondMetrics?.unreadNotices === firstMetrics.unreadNotices);

  const savedUser = await User.findById(student._id).select('metrics').lean();
  check('dashboard metrics persist on the user', savedUser?.metrics?.unreadNotices === secondMetrics?.unreadNotices && savedUser?.metrics?.dueAssignments === initialMetrics?.dueAssignments);
} finally {
  if (notification?._id) await Notification.deleteOne({ _id: notification._id });
  if (notice?._id) await Notice.deleteOne({ _id: notice._id });
  await dashboardService.getDashboard({ userId: student._id, role: student.role });
  await new Promise((resolve) => server.close(resolve));
  await mongoose.disconnect();
}

for (const item of checks) console.log(`${item.passed ? 'PASS' : 'FAIL'} ${item.label}${item.detail ? ` — ${item.detail}` : ''}`);
const failures = checks.filter((item) => !item.passed);
console.log(`\n${checks.length - failures.length}/${checks.length} passed`);
if (failures.length) process.exit(1);
