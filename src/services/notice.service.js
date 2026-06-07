const Notice = require('../models/Notice.model');
const TeacherProfile = require('../models/TeacherProfile.model');
const StudentProfile = require('../models/StudentProfile.model');
const { uploadFile } = require('../utils/firebaseStorage');
const { parsePagination, buildPaginationMeta } = require('../utils/paginationHelper');
const ERROR_CODES = require('../constants/errorCodes');
const logActivity = require('../utils/activityLogger');
const eventBus = require('../events/eventBus');
const EVENTS = require('../constants/events');

const appError = (message, statusCode, errorCode) => {
  const err = new Error(message);
  err.statusCode = statusCode;
  err.errorCode = errorCode;
  return err;
};

/**
 * Get teacher's assigned classId, or throw SCOPE_VIOLATION if none.
 */
const getTeacherClassId = async (userId) => {
  const profile = await TeacherProfile.findOne({ userId });
  if (!profile || !profile.assignedClassId) {
    throw appError('Teacher has no assigned class', 400, ERROR_CODES.SCOPE_VIOLATION);
  }
  return profile.assignedClassId.toString();
};

/**
 * Upload multer files to Firebase Storage.
 * Returns array of attachment metadata.
 */
const uploadAttachments = async (files, folder) => {
  if (!files || files.length === 0) return [];
  return Promise.all(
    files.map((f) => uploadFile(f.buffer, f.originalname, f.mimetype, folder))
  );
};

/**
 * POST /notices
 * - Admin: any audienceType
 * - Teacher: specific_classes or specific_students for their assigned class only
 */
const createNotice = async (data, actor, files) => {
  const { title, message, audienceType, classIds = [], studentIds = [], status } = data;

  if (actor.role === 'teacher') {
    const assignedClassId = await getTeacherClassId(actor.userId);
    if (audienceType === 'specific_classes') {
      if (!classIds.every((id) => id === assignedClassId)) {
        throw appError('Teacher can only create notices for their assigned class', 403, ERROR_CODES.SCOPE_VIOLATION);
      }
    }
    if (audienceType === 'all_classes') {
      throw appError('Teacher cannot create notices for all classes', 403, ERROR_CODES.SCOPE_VIOLATION);
    }
  }

  const attachments = await uploadAttachments(files, 'notices');

  const notice = await Notice.create({
    title, message, attachments, audienceType,
    classIds: audienceType === 'specific_classes' ? classIds : [],
    studentIds: audienceType === 'specific_students' ? studentIds : [],
    createdBy: actor.userId,
    createdByRole: actor.role,
    status: status || 'active',
  });

  logActivity({
    actorId: actor.userId, actorName: actor.userId, actorRole: actor.role,
    actionType: 'CREATE_NOTICE', entityType: 'Notice', entityId: notice._id,
    metadata: { title, audienceType },
  });

  eventBus.emit(EVENTS.NOTICE_CREATED, { noticeId: notice._id });

  return notice;
};

/**
 * GET /notices
 * - Admin: all notices
 * - Teacher: notices for their class + global notices
 * - Student: notices targeted to their class or them specifically
 */
const listNotices = async (query, actor) => {
  const { page, limit, skip, sortBy, sortOrder } = parsePagination(query);
  const { search, audienceType, classId, status } = query;

  const filter = { isDeleted: false };
  if (status) filter.status = status;
  if (audienceType) filter.audienceType = audienceType;
  if (classId) filter.classIds = classId;
  if (search) filter.title = { $regex: search, $options: 'i' };

  if (actor.role === 'teacher') {
    const assignedClassId = await getTeacherClassId(actor.userId);
    filter.$or = [
      { audienceType: 'all_classes' },
      { classIds: assignedClassId },
    ];
  } else if (actor.role === 'student') {
    const profile = await StudentProfile.findOne({ userId: actor.userId });
    if (profile && profile.classId) {
      filter.$or = [
        { audienceType: 'all_classes' },
        { classIds: profile.classId },
        { studentIds: actor.userId },
      ];
    } else {
      filter.audienceType = 'all_classes';
    }
  }

  const [notices, total] = await Promise.all([
    Notice.find(filter).sort({ [sortBy]: sortOrder }).skip(skip).limit(limit),
    Notice.countDocuments(filter),
  ]);

  return { notices, pagination: buildPaginationMeta(total, page, limit) };
};

/**
 * GET /notices/:id
 */
const getNoticeById = async (noticeId, actor) => {
  const notice = await Notice.findOne({ _id: noticeId, isDeleted: false });
  if (!notice) throw appError('Notice not found', 404, ERROR_CODES.NOT_FOUND);

  // Scope check for teacher
  if (actor.role === 'teacher') {
    const assignedClassId = await getTeacherClassId(actor.userId);
    const isAccessible = notice.audienceType === 'all_classes'
      || notice.classIds.map(String).includes(assignedClassId)
      || notice.createdBy.toString() === actor.userId;
    if (!isAccessible) throw appError('Access denied', 403, ERROR_CODES.SCOPE_VIOLATION);
  }

  return notice;
};

/**
 * PATCH /notices/:id
 */
const updateNotice = async (noticeId, data, actor, files) => {
  const notice = await Notice.findOne({ _id: noticeId, isDeleted: false });
  if (!notice) throw appError('Notice not found', 404, ERROR_CODES.NOT_FOUND);

  // Only creator or admin can edit
  if (actor.role !== 'admin' && notice.createdBy.toString() !== actor.userId) {
    throw appError('You can only edit your own notices', 403, ERROR_CODES.SCOPE_VIOLATION);
  }

  const newAttachments = await uploadAttachments(files, 'notices');
  const updates = { ...data };
  if (newAttachments.length > 0) {
    updates.$push = { attachments: { $each: newAttachments } };
    delete updates.attachments;
  }

  const updated = await Notice.findByIdAndUpdate(noticeId, updates, { returnDocument: 'after' });

  logActivity({
    actorId: actor.userId, actorName: actor.userId, actorRole: actor.role,
    actionType: 'UPDATE_NOTICE', entityType: 'Notice', entityId: noticeId,
    metadata: { fields: Object.keys(data) },
  });

  return updated;
};

/**
 * DELETE /notices/:id (soft delete)
 */
const deleteNotice = async (noticeId, actor) => {
  const notice = await Notice.findOne({ _id: noticeId, isDeleted: false });
  if (!notice) throw appError('Notice not found', 404, ERROR_CODES.NOT_FOUND);

  if (actor.role !== 'admin' && notice.createdBy.toString() !== actor.userId) {
    throw appError('You can only delete your own notices', 403, ERROR_CODES.SCOPE_VIOLATION);
  }

  await Notice.findByIdAndUpdate(noticeId, { isDeleted: true });

  logActivity({
    actorId: actor.userId, actorName: actor.userId, actorRole: actor.role,
    actionType: 'DELETE_NOTICE', entityType: 'Notice', entityId: noticeId,
  });
};

module.exports = { createNotice, listNotices, getNoticeById, updateNotice, deleteNotice };
