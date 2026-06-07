const Notification = require('../models/Notification.model');
const DeviceToken = require('../models/DeviceToken.model');
const User = require('../models/User.model');
const StudentProfile = require('../models/StudentProfile.model');
const { parsePagination, buildPaginationMeta } = require('../utils/paginationHelper');
const { sendPushToTokens } = require('./fcm.service');
const ERROR_CODES = require('../constants/errorCodes');
const logger = require('../config/logger');

const appError = (message, statusCode, errorCode) => {
  const err = new Error(message);
  err.statusCode = statusCode;
  err.errorCode = errorCode;
  return err;
};

const uniqueStrings = (values) => [...new Set((values || []).filter(Boolean).map(String))];

const registerDevice = async (data, actor) => {
  const token = await DeviceToken.findOneAndUpdate(
    { userId: actor.userId, token: data.token },
    { platform: data.platform, lastSeenAt: new Date() },
    { upsert: true, returnDocument: 'after', setDefaultsOnInsert: true }
  );

  return token;
};

const listNotifications = async (query, actor) => {
  const { page, limit, skip, sortBy, sortOrder } = parsePagination(query);
  const filter = { recipientUserId: actor.userId };

  if (query.isRead) filter.isRead = query.isRead === 'true';
  if (query.type) filter.type = query.type;

  const [notifications, total] = await Promise.all([
    Notification.find(filter).sort({ [sortBy]: sortOrder }).skip(skip).limit(limit),
    Notification.countDocuments(filter),
  ]);

  return { notifications, pagination: buildPaginationMeta(total, page, limit) };
};

const markNotificationRead = async (notificationId, actor) => {
  const notification = await Notification.findOneAndUpdate(
    { _id: notificationId, recipientUserId: actor.userId },
    { isRead: true },
    { returnDocument: 'after' }
  );

  if (!notification) throw appError('Notification not found', 404, ERROR_CODES.NOT_FOUND);
  return notification;
};

const markAllRead = async (actor) => {
  const result = await Notification.updateMany(
    { recipientUserId: actor.userId, isRead: false },
    { isRead: true }
  );

  return { modifiedCount: result.modifiedCount || 0 };
};

const getStudentRecipientsForClassIds = async (classIds) => {
  const normalizedClassIds = uniqueStrings(classIds);
  if (normalizedClassIds.length === 0) return [];

  const profiles = await StudentProfile.find({ classId: { $in: normalizedClassIds } }).select('userId');
  return profiles.map((profile) => profile.userId.toString());
};

const getAllActiveStudentIds = async () => {
  const students = await User.find({ role: 'student', status: 'active' }).select('_id');
  return students.map((student) => student._id.toString());
};

const resolveStudentRecipients = async ({ audienceType, classIds = [], studentIds = [] }) => {
  if (audienceType === 'all_classes') return getAllActiveStudentIds();
  if (audienceType === 'specific_classes') return getStudentRecipientsForClassIds(classIds);
  return uniqueStrings(studentIds);
};

const createAndSendNotifications = async ({ recipients, title, body, type, entityType, entityId, dedupeKeyPrefix }) => {
  const recipientIds = uniqueStrings(recipients);
  if (recipientIds.length === 0) return { createdCount: 0, push: { successCount: 0, failureCount: 0 } };

  const users = await User.find({ _id: { $in: recipientIds }, status: 'active' }).select('_id role');
  const docs = users.map((user) => ({
    recipientUserId: user._id,
    recipientRole: user.role,
    title,
    body,
    type,
    entityType,
    entityId,
    dedupeKey: dedupeKeyPrefix ? `${dedupeKeyPrefix}:${user._id}` : undefined,
  }));

  let createdDocs = [];
  if (docs.length > 0) {
    try {
      createdDocs = await Notification.insertMany(docs, { ordered: false });
    } catch (err) {
      if (err.writeErrors) {
        createdDocs = err.insertedDocs || [];
      } else {
        throw err;
      }
    }
  }

  const deviceTokens = await DeviceToken.find({ userId: { $in: users.map((user) => user._id) } }).select('token');
  const push = await sendPushToTokens({
    tokens: deviceTokens.map((deviceToken) => deviceToken.token),
    title,
    body,
    data: { type, entityType, entityId },
  });

  return { createdCount: createdDocs.length, push };
};

const notifyFromEvent = async (payload) => {
  try {
    return await createAndSendNotifications(payload);
  } catch (err) {
    logger.error('Notification event handling failed', { error: err.message, type: payload.type, entityId: payload.entityId });
    return null;
  }
};

module.exports = {
  registerDevice,
  listNotifications,
  markNotificationRead,
  markAllRead,
  getStudentRecipientsForClassIds,
  resolveStudentRecipients,
  createAndSendNotifications,
  notifyFromEvent,
};
