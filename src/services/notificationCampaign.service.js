import NotificationCampaign from '../models/NotificationCampaign.model.js';
import NotificationDelivery from '../models/NotificationDelivery.model.js';
import DeviceToken from '../models/DeviceToken.model.js';
import StudentProfile from '../models/StudentProfile.model.js';
import User from '../models/User.model.js';
import { parsePagination, buildPaginationMeta, buildSearchRegex } from '../utils/paginationHelper.js';
import ERROR_CODES from '../constants/errorCodes.js';

const appError = (message, statusCode, errorCode) => {
  const err = new Error(message);
  err.statusCode = statusCode;
  err.errorCode = errorCode;
  return err;
};

const uniqueIds = (values) => [...new Set((values || []).map(String))];

const resolveAudience = async ({ audienceType, classIds = [], studentIds = [] }) => {
  let candidateIds = [];
  if (audienceType === 'all_classes') {
    const users = await User.find({ role: 'student', status: 'active' }).select('_id').lean();
    candidateIds = users.map((user) => user._id);
  } else if (audienceType === 'specific_classes') {
    const profiles = await StudentProfile.find({ classId: { $in: classIds } }).select('userId').lean();
    candidateIds = profiles.map((profile) => profile.userId);
  } else {
    candidateIds = studentIds;
  }

  const resolvedIds = uniqueIds(candidateIds);
  if (resolvedIds.length === 0) return { users: [], devices: [], recipientsWithoutDevices: 0 };

  const users = await User.find({ _id: { $in: resolvedIds }, role: 'student', status: 'active' })
    .select('_id name username')
    .lean();
  const userIds = users.map((user) => user._id);
  const devices = await DeviceToken.find({ userId: { $in: userIds }, platform: 'android', enabled: true })
    .select('_id userId token platform')
    .lean();
  const usersWithDevices = new Set(devices.map((device) => String(device.userId)));

  return {
    users,
    devices,
    recipientsWithoutDevices: users.filter((user) => !usersWithDevices.has(String(user._id))).length,
  };
};

const previewCampaign = async (data) => {
  const audience = await resolveAudience(data);
  return {
    recipientCount: audience.users.length,
    deviceCount: audience.devices.length,
    recipientsWithoutDevices: audience.recipientsWithoutDevices,
  };
};

const createCampaign = async (data, actor) => {
  if (data.idempotencyKey) {
    const existing = await NotificationCampaign.findOne({ idempotencyKey: data.idempotencyKey });
    if (existing) return { campaign: existing, duplicate: true };
  }

  const audience = await resolveAudience(data);
  const scheduledAt = data.scheduledAt ? new Date(data.scheduledAt) : new Date();
  const isScheduled = scheduledAt.getTime() > Date.now();
  const status = audience.devices.length === 0 ? 'failed' : isScheduled ? 'scheduled' : 'queued';
  const campaign = await NotificationCampaign.create({
    title: data.title,
    body: data.body,
    audienceType: data.audienceType,
    classIds: data.audienceType === 'specific_classes' ? uniqueIds(data.classIds) : [],
    studentIds: data.audienceType === 'specific_students' ? uniqueIds(data.studentIds) : [],
    destination: data.destination || 'home',
    scheduledAt,
    status,
    recipientCount: audience.users.length,
    deviceCount: audience.devices.length,
    recipientsWithoutDevices: audience.recipientsWithoutDevices,
    pendingCount: audience.devices.length,
    createdBy: actor.userId,
    idempotencyKey: data.idempotencyKey,
  });

  if (audience.devices.length > 0) {
    await NotificationDelivery.insertMany(audience.devices.map((device) => ({
      campaignId: campaign._id,
      recipientUserId: device.userId,
      deviceTokenId: device._id,
      token: device.token,
      platform: 'android',
      status: 'pending',
      nextAttemptAt: scheduledAt,
    })), { ordered: false });
  }

  return { campaign, duplicate: false };
};

const createSystemCampaign = async ({ recipients, title, body, type, entityType, entityId, dedupeKeyPrefix }) => {
  const studentIds = uniqueIds(recipients);
  if (studentIds.length === 0) return { campaign: null, duplicate: false, queuedCount: 0 };

  const idempotencyKey = dedupeKeyPrefix ? `system:${dedupeKeyPrefix}` : undefined;
  if (idempotencyKey) {
    const existing = await NotificationCampaign.findOne({ idempotencyKey });
    if (existing) return { campaign: existing, duplicate: true, queuedCount: existing.deviceCount };
  }

  const audience = await resolveAudience({ audienceType: 'specific_students', studentIds });
  const destinationByType = {
    notice: 'notices',
    assignment: 'assignments',
    reminder: 'assignments',
    timetable: 'academics',
    reportCard: 'academics',
    result: 'academics',
  };
  const campaign = await NotificationCampaign.create({
    title,
    body,
    sourceType: type,
    entityType,
    entityId,
    audienceType: 'specific_students',
    studentIds: audience.users.map((user) => user._id),
    destination: destinationByType[type] || 'home',
    scheduledAt: new Date(),
    status: audience.devices.length ? 'queued' : 'failed',
    recipientCount: audience.users.length,
    deviceCount: audience.devices.length,
    recipientsWithoutDevices: audience.recipientsWithoutDevices,
    pendingCount: audience.devices.length,
    idempotencyKey,
  });

  if (audience.devices.length) {
    await NotificationDelivery.insertMany(audience.devices.map((device) => ({
      campaignId: campaign._id,
      recipientUserId: device.userId,
      deviceTokenId: device._id,
      token: device.token,
      platform: 'android',
      status: 'pending',
      nextAttemptAt: campaign.scheduledAt,
    })), { ordered: false });
  }

  return { campaign, duplicate: false, queuedCount: audience.devices.length };
};

const listCampaigns = async (query) => {
  const { page, limit, skip, sortBy, sortOrder } = parsePagination(
    query,
    ['title', 'status', 'audienceType', 'scheduledAt', 'createdAt'],
    'createdAt'
  );
  const filter = {};
  if (query.status) filter.status = query.status;
  if (query.audienceType) filter.audienceType = query.audienceType;
  if (query.search) {
    const regex = buildSearchRegex(query.search);
    filter.$or = [{ title: regex }, { body: regex }];
  }

  const [campaigns, total] = await Promise.all([
    NotificationCampaign.find(filter).populate('createdBy', 'name username').sort({ [sortBy]: sortOrder }).skip(skip).limit(limit),
    NotificationCampaign.countDocuments(filter),
  ]);
  return { campaigns, pagination: buildPaginationMeta(total, page, limit) };
};

const getCampaign = async (campaignId) => {
  const campaign = await NotificationCampaign.findById(campaignId).populate('createdBy', 'name username');
  if (!campaign) throw appError('Notification campaign not found', 404, ERROR_CODES.NOT_FOUND);
  return campaign;
};

const listDeliveries = async (campaignId, query) => {
  await getCampaign(campaignId);
  const { page, limit, skip, sortBy, sortOrder } = parsePagination(
    query,
    ['status', 'attemptCount', 'nextAttemptAt', 'createdAt', 'updatedAt'],
    'createdAt'
  );
  const filter = { campaignId };
  if (query.status) filter.status = query.status;
  if (query.search) {
    const regex = buildSearchRegex(query.search);
    const users = await User.find({ role: 'student', $or: [{ name: regex }, { username: regex }] }).select('_id').lean();
    filter.$or = [
      { recipientUserId: { $in: users.map((user) => user._id) } },
      { lastErrorCode: regex },
      { lastErrorMessage: regex },
    ];
  }

  const [deliveries, total] = await Promise.all([
    NotificationDelivery.find(filter)
      .populate('recipientUserId', 'name username')
      .sort({ [sortBy]: sortOrder })
      .skip(skip)
      .limit(limit)
      .select('-token'),
    NotificationDelivery.countDocuments(filter),
  ]);
  return { deliveries, pagination: buildPaginationMeta(total, page, limit) };
};

const cancelCampaign = async (campaignId) => {
  const campaign = await NotificationCampaign.findOne({
    _id: campaignId,
    status: { $in: ['scheduled', 'queued', 'processing'] },
  });
  if (!campaign) throw appError('Campaign cannot be cancelled', 409, ERROR_CODES.VALIDATION_ERROR);

  await NotificationDelivery.updateMany(
    { campaignId, status: { $in: ['pending', 'retry_scheduled'] } },
    { $set: { status: 'cancelled', lockedAt: null, lockedUntil: null } }
  );
  campaign.status = 'cancelled';
  campaign.pendingCount = 0;
  await campaign.save();
  return campaign;
};

const retryFailed = async (campaignId) => {
  const campaign = await getCampaign(campaignId);
  if (campaign.status === 'cancelled') throw appError('Cancelled campaigns cannot be retried', 409, ERROR_CODES.VALIDATION_ERROR);
  const result = await NotificationDelivery.updateMany(
    { campaignId, status: 'failed', failureKind: 'transient', attemptCount: { $lt: 3 } },
    { $set: { status: 'retry_scheduled', nextAttemptAt: new Date(), lockedAt: null, lockedUntil: null } }
  );
  return { queuedCount: result.modifiedCount || 0 };
};

export { resolveAudience, previewCampaign, createCampaign, createSystemCampaign, listCampaigns, getCampaign, listDeliveries, cancelCampaign, retryFailed };
export default { resolveAudience, previewCampaign, createCampaign, createSystemCampaign, listCampaigns, getCampaign, listDeliveries, cancelCampaign, retryFailed };
