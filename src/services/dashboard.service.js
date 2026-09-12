import Assignment from '../models/Assignment.model.js';
import Notice from '../models/Notice.model.js';
import Notification from '../models/Notification.model.js';
import StudentProfile from '../models/StudentProfile.model.js';
import User from '../models/User.model.js';

const countUnreadNotices = async (userId) => {
  const noticeIds = await Notification.distinct('entityId', {
    recipientUserId: userId,
    entityType: 'Notice',
    type: 'notice',
    isRead: false,
  });

  if (noticeIds.length === 0) return 0;
  return Notice.countDocuments({
    _id: { $in: noticeIds },
    status: 'active',
    isDeleted: false,
  });
};

const countDueAssignments = async (userId) => {
  const profile = await StudentProfile.findOne({ userId }).select('classId').lean();
  const audience = profile?.classId
    ? { $or: [{ classIds: profile.classId }, { studentIds: userId }] }
    : { studentIds: userId };

  return Assignment.countDocuments({
    ...audience,
    status: 'active',
    isDeleted: false,
    deadline: { $gte: new Date() },
  });
};

const syncUnreadNoticeMetric = async (userId) => {
  const unreadNotices = await countUnreadNotices(userId);
  const user = await User.findByIdAndUpdate(
    userId,
    { $set: { 'metrics.unreadNotices': unreadNotices } },
    { returnDocument: 'after', runValidators: true }
  ).select('metrics').lean();

  return user?.metrics || { dueAssignments: 0, unreadNotices };
};

const getDashboard = async (actor) => {
  const [dueAssignments, unreadNotices] = await Promise.all([
    countDueAssignments(actor.userId),
    countUnreadNotices(actor.userId),
  ]);
  const metrics = { dueAssignments, unreadNotices };

  await User.findByIdAndUpdate(
    actor.userId,
    { $set: { metrics } },
    { runValidators: true }
  );

  return { metrics };
};

export { getDashboard, syncUnreadNoticeMetric };
export default { getDashboard, syncUnreadNoticeMetric };
