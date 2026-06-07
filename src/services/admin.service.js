import User from '../models/User.model.js';
import Class from '../models/Class.model.js';
import Notice from '../models/Notice.model.js';
import Assignment from '../models/Assignment.model.js';
import Timetable from '../models/Timetable.model.js';
import ReportCard from '../models/ReportCard.model.js';
import Result from '../models/Result.model.js';
import Notification from '../models/Notification.model.js';
import ActivityLog from '../models/ActivityLog.model.js';
import { parsePagination, buildPaginationMeta } from '../utils/paginationHelper.js';

const getOverviewMetrics = async () => {
  const now = new Date();
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

  const [
    totalStudents,
    activeStudents,
    blockedStudents,
    totalTeachers,
    activeTeachers,
    totalClasses,
    activeNotices,
    activeAssignments,
    upcomingAssignments,
    timetables,
    reportCards,
    results,
    unreadNotifications,
    recentActivityCount,
    recentActivity,
  ] = await Promise.all([
    User.countDocuments({ role: 'student', status: { $ne: 'deleted' } }),
    User.countDocuments({ role: 'student', status: 'active' }),
    User.countDocuments({ role: 'student', status: 'blocked' }),
    User.countDocuments({ role: 'teacher', status: { $ne: 'deleted' } }),
    User.countDocuments({ role: 'teacher', status: 'active' }),
    Class.countDocuments({ isDeleted: false }),
    Notice.countDocuments({ isDeleted: false, status: 'active' }),
    Assignment.countDocuments({ isDeleted: false, status: 'active' }),
    Assignment.countDocuments({ isDeleted: false, status: 'active', deadline: { $gte: now } }),
    Timetable.countDocuments({}),
    ReportCard.countDocuments({ isDeleted: false }),
    Result.countDocuments({ isDeleted: false }),
    Notification.countDocuments({ isRead: false }),
    ActivityLog.countDocuments({ createdAt: { $gte: sevenDaysAgo } }),
    ActivityLog.find({}).sort({ createdAt: -1 }).limit(8),
  ]);

  return {
    users: {
      students: { total: totalStudents, active: activeStudents, blocked: blockedStudents },
      teachers: { total: totalTeachers, active: activeTeachers },
    },
    academics: {
      classes: totalClasses,
      timetables,
      reportCards,
      results,
    },
    communication: {
      activeNotices,
      activeAssignments,
      upcomingAssignments,
      unreadNotifications,
    },
    activity: {
      last7Days: recentActivityCount,
      recent: recentActivity,
    },
  };
};

const listActivityLogs = async (query) => {
  const { page, limit, skip, sortBy, sortOrder } = parsePagination(query);
  const filter = {};

  if (query.actorRole) filter.actorRole = query.actorRole;
  if (query.actionType) filter.actionType = query.actionType;
  if (query.entityType) filter.entityType = query.entityType;

  const [logs, total] = await Promise.all([
    ActivityLog.find(filter).sort({ [sortBy]: sortOrder }).skip(skip).limit(limit),
    ActivityLog.countDocuments(filter),
  ]);

  return { logs, pagination: buildPaginationMeta(total, page, limit) };
};

export { getOverviewMetrics, listActivityLogs };
export default { getOverviewMetrics, listActivityLogs };
