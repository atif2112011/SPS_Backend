import 'dotenv/config';
import mongoose from 'mongoose';
import connectDB from '../src/config/db.js';
import User from '../src/models/User.model.js';
import RefreshToken from '../src/models/RefreshToken.model.js';
import ActivityLog from '../src/models/ActivityLog.model.js';
import Notification from '../src/models/Notification.model.js';
import DeviceToken from '../src/models/DeviceToken.model.js';
import NotificationDelivery from '../src/models/NotificationDelivery.model.js';
import TeacherProfile from '../src/models/TeacherProfile.model.js';
import { hashPassword } from '../src/utils/hashUtils.js';

const [action, runId] = process.argv.slice(2);
const password = process.env.E2E_FIXTURE_PASSWORD;
const username = `admin_browser_${runId}`;

if (!['create', 'cleanup'].includes(action) || !/^\d{12,18}$/.test(runId || '')) {
  console.error('Usage: node scripts/admin-browser-fixture.mjs <create|cleanup> <numeric-run-id>');
  process.exit(1);
}

if (action === 'create' && !password) {
  console.error('E2E_FIXTURE_PASSWORD is required when creating the browser fixture.');
  process.exit(1);
}

try {
  await connectDB();

  if (action === 'create') {
    const existing = await User.findOne({ username }).lean();
    if (existing) throw new Error(`Fixture ${username} already exists`);
    const user = await User.create({
      role: 'admin',
      username,
      name: 'Admin Browser Release Check',
      passwordHash: await hashPassword(password),
      status: 'active',
      firstPasswordChange: true,
    });
    console.log(`E2E_FIXTURE=${JSON.stringify({ username, userId: String(user._id) })}`);
  } else {
    const users = await User.find({ username: { $regex: `^(admin|teacher)_browser_${runId}` } }).select('_id').lean();
    const userIds = users.map((user) => user._id);

    await Promise.all([
      RefreshToken.deleteMany({ userId: { $in: userIds } }),
      ActivityLog.deleteMany({ $or: [{ actorId: { $in: userIds } }, { targetId: { $in: userIds } }, { entityId: { $in: userIds } }] }),
      Notification.deleteMany({ recipientUserId: { $in: userIds } }),
      NotificationDelivery.deleteMany({ recipientUserId: { $in: userIds } }),
      DeviceToken.deleteMany({ userId: { $in: userIds } }),
      TeacherProfile.deleteMany({ userId: { $in: userIds } }),
    ]);
    await User.deleteMany({ _id: { $in: userIds } });

    const leftovers = {
      users: await User.countDocuments({ username: { $regex: `^(admin|teacher)_browser_${runId}` } }),
      teacherProfiles: await TeacherProfile.countDocuments({ userId: { $in: userIds } }),
      refreshTokens: await RefreshToken.countDocuments({ userId: { $in: userIds } }),
      activityLogs: await ActivityLog.countDocuments({ $or: [{ actorId: { $in: userIds } }, { targetId: { $in: userIds } }, { entityId: { $in: userIds } }] }),
      notifications: await Notification.countDocuments({ recipientUserId: { $in: userIds } }),
      deliveries: await NotificationDelivery.countDocuments({ recipientUserId: { $in: userIds } }),
      devices: await DeviceToken.countDocuments({ userId: { $in: userIds } }),
    };
    const total = Object.values(leftovers).reduce((sum, count) => sum + count, 0);
    console.log(`E2E_CLEANUP=${JSON.stringify({ username, total, leftovers })}`);
    if (total) process.exitCode = 1;
  }
} catch (error) {
  console.error(`Admin browser fixture ${action} failed: ${error.stack || error.message}`);
  process.exitCode = 1;
} finally {
  await mongoose.disconnect().catch(() => {});
}
