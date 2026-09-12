import Notification from '../models/Notification.model.js';
import DeviceToken from '../models/DeviceToken.model.js';
import User from '../models/User.model.js';
import StudentProfile from '../models/StudentProfile.model.js';
import { parsePagination, buildPaginationMeta, buildSearchRegex } from '../utils/paginationHelper.js';
import ERROR_CODES from '../constants/errorCodes.js';
import logger from '../config/logger.js';
import { syncUnreadNoticeMetric } from './dashboard.service.js';
import notificationCampaignService from './notificationCampaign.service.js';

const appError = (message, statusCode, errorCode) => {
  const err = new Error(message);
  err.statusCode = statusCode;
  err.errorCode = errorCode;
  return err;
};

const uniqueStrings = (values) => [...new Set((values || []).filter(Boolean).map(String))];

const registerDevice = async (data, actor) => {
  const token = await DeviceToken.findOneAndUpdate(
    { token: data.token },
    {
      userId: actor.userId,
      platform: data.platform,
      deviceId: data.deviceId,
      appVersion: data.appVersion,
      enabled: true,
      lastSeenAt: new Date(),
      tokenRefreshedAt: new Date(),
      disabledAt: null,
      disabledReason: null,
      consecutiveFailureCount: 0,
    },
    { upsert: true, returnDocument: 'after', setDefaultsOnInsert: true }
  );

  return token;
};

const unregisterDevice = async (data, actor) => {
  const filter = { userId: actor.userId };
  if (data.token) filter.token = data.token;
  if (data.deviceId) filter.deviceId = data.deviceId;
  const result = await DeviceToken.updateMany(filter, {
    $set: { enabled: false, disabledAt: new Date(), disabledReason: 'user_logout' },
  });
  return { disabledCount: result.modifiedCount || 0 };
};

const listNotifications = async (query, actor) => {
  const { page, limit, skip, sortBy, sortOrder } = parsePagination(query, ['title', 'type', 'isRead', 'sentAt', 'createdAt']);
  const filter = { recipientUserId: actor.userId };

  if (query.isRead) filter.isRead = query.isRead === 'true';
  if (query.type) filter.type = query.type;
  if (query.search) {
    const searchRegex = buildSearchRegex(query.search);
    filter.$or = [{ title: searchRegex }, { body: searchRegex }, { entityType: searchRegex }];
  }

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
  if (actor.role === 'student' && notification.type === 'notice') {
    await syncUnreadNoticeMetric(actor.userId);
  }
  return notification;
};

const markAllRead = async (actor) => {
  const result = await Notification.updateMany(
    { recipientUserId: actor.userId, isRead: false },
    { isRead: true }
  );

  if (actor.role === 'student') await syncUnreadNoticeMetric(actor.userId);

  return { modifiedCount: result.modifiedCount || 0 };
};

const markEntityRead = async (entityType, entityId, actor) => {
  const result = await Notification.updateMany(
    { recipientUserId: actor.userId, entityType, entityId, isRead: false },
    { isRead: true }
  );
  const metrics = actor.role === 'student'
    ? await syncUnreadNoticeMetric(actor.userId)
    : undefined;

  return { modifiedCount: result.modifiedCount || 0, metrics };
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
  if (recipientIds.length === 0) return { createdCount: 0, push: { queuedCount: 0 } };

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

  const push = await notificationCampaignService.createSystemCampaign({
    recipients: users.map((user) => user._id),
    title,
    body,
    type,
    entityType,
    entityId,
    dedupeKeyPrefix,
  });

  if (type === 'notice' && createdDocs.length > 0) {
    const createdRecipientIds = uniqueStrings(createdDocs.map((notification) => notification.recipientUserId));
    await User.updateMany(
      { _id: { $in: createdRecipientIds }, role: 'student' },
      { $inc: { 'metrics.unreadNotices': 1 } }
    );
  }

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

export { registerDevice, unregisterDevice, listNotifications, markNotificationRead, markAllRead, markEntityRead, getStudentRecipientsForClassIds, resolveStudentRecipients, createAndSendNotifications, notifyFromEvent };
export default { registerDevice, unregisterDevice, listNotifications, markNotificationRead, markAllRead, markEntityRead, getStudentRecipientsForClassIds, resolveStudentRecipients, createAndSendNotifications, notifyFromEvent };
