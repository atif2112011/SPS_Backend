const User = require('../models/User.model');
const Class = require('../models/Class.model');
const Notice = require('../models/Notice.model');
const Assignment = require('../models/Assignment.model');
const Timetable = require('../models/Timetable.model');
const ReportCard = require('../models/ReportCard.model');
const Result = require('../models/Result.model');
const Notification = require('../models/Notification.model');
const ActivityLog = require('../models/ActivityLog.model');
const { parsePagination, buildPaginationMeta } = require('../utils/paginationHelper');

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

module.exports = { getOverviewMetrics, listActivityLogs };
