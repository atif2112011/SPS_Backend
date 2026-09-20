import Notice from '../models/Notice.model.js';
import StudentProfile from '../models/StudentProfile.model.js';
import { deleteFile, uploadFile } from '../utils/firebaseStorage.js';
import { parsePagination, buildPaginationMeta, buildSearchRegex } from '../utils/paginationHelper.js';
import ERROR_CODES from '../constants/errorCodes.js';
import logActivity from '../utils/activityLogger.js';
import { publishEvent } from '../events/eventBus.js';
import EVENTS from '../constants/events.js';
import notificationService from './notification.service.js';
import { assertStudentsBelongToTeacher, getTeacherContext } from './teacherContext.service.js';
import { MAX_CONTENT_ATTACHMENTS } from '../constants/uploads.js';

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
  const { classId } = await getTeacherContext(userId);
  return classId.toString();
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
    if (audienceType === 'specific_students') {
      await assertStudentsBelongToTeacher(studentIds, actor.userId);
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

  await publishEvent(EVENTS.NOTICE_CREATED, { noticeId: notice._id });

  return notice;
};

/**
 * GET /notices
 * - Admin: all notices
 * - Teacher: notices for their class + global notices
 * - Student: notices targeted to their class or them specifically
 */
const listNotices = async (query, actor) => {
  const { page, limit, skip, sortBy, sortOrder } = parsePagination(query, ['title', 'audienceType', 'status', 'publishedAt', 'createdAt']);
  const { search, audienceType, classId, status, dateFrom, dateTo } = query;

  const filter = { isDeleted: false };
  if (status) filter.status = status;
  if (audienceType) filter.audienceType = audienceType;
  if (classId) filter.classIds = classId;
  if (dateFrom || dateTo) {
    filter.publishedAt = {};
    if (dateFrom) filter.publishedAt.$gte = new Date(dateFrom);
    if (dateTo) { const end = new Date(dateTo); end.setHours(23, 59, 59, 999); filter.publishedAt.$lte = end; }
  }
  const constraints = [];
  if (search) {
    const searchRegex = buildSearchRegex(search);
    constraints.push({ $or: [{ title: searchRegex }, { message: searchRegex }] });
  }

  if (actor.role === 'teacher') {
    const assignedClassId = await getTeacherClassId(actor.userId);
    constraints.push({ $or: [
      { audienceType: 'all_classes' },
      { classIds: assignedClassId },
      { createdBy: actor.userId },
    ] });
  } else if (actor.role === 'student') {
    const profile = await StudentProfile.findOne({ userId: actor.userId });
    if (profile && profile.classId) {
      constraints.push({ $or: [
        { audienceType: 'all_classes' },
        { classIds: profile.classId },
        { studentIds: actor.userId },
      ] });
    } else {
      filter.audienceType = 'all_classes';
    }
  }

  if (constraints.length) filter.$and = constraints;

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
  const notice = await Notice.findOne({ _id: noticeId, isDeleted: false })
    .populate('createdBy', 'name username role')
    .populate('classIds', 'className section academicYear')
    .populate('studentIds', 'name username status');
  if (!notice) throw appError('Notice not found', 404, ERROR_CODES.NOT_FOUND);

  // Scope check for teacher
  if (actor.role === 'teacher') {
    const assignedClassId = await getTeacherClassId(actor.userId);
    const isAccessible = notice.audienceType === 'all_classes'
      || notice.classIds.some((item) => String(item?._id || item) === assignedClassId)
      || String(notice.createdBy?._id || notice.createdBy) === actor.userId;
    if (!isAccessible) throw appError('Access denied', 403, ERROR_CODES.SCOPE_VIOLATION);
  }

  if (actor.role === 'student') {
    const profile = await StudentProfile.findOne({ userId: actor.userId }).select('classId').lean();
    const isAccessible = notice.audienceType === 'all_classes'
      || notice.studentIds.some((item) => String(item?._id || item) === actor.userId.toString())
      || (profile?.classId && notice.classIds.some((item) => String(item?._id || item) === profile.classId.toString()));
    if (!isAccessible) throw appError('Access denied', 403, ERROR_CODES.SCOPE_VIOLATION);
  }

  return normalizeNotice(notice, actor);
};

const assertCanManage = (notice, actor) => {
  if (actor.role !== 'admin' && notice.createdBy.toString() !== actor.userId) {
    throw appError('You can only change your own notices', 403, ERROR_CODES.SCOPE_VIOLATION);
  }
  if (notice.status === 'archived') {
    throw appError('Archived notices are read only', 409, ERROR_CODES.VALIDATION_ERROR);
  }
};

const normalizeNotice = (notice, actor) => {
  const value = notice.toObject ? notice.toObject() : notice;
  const creator = value.createdBy?._id ? value.createdBy : null;
  const classes = (value.classIds || []).filter((item) => item?._id);
  const students = (value.studentIds || []).filter((item) => item?._id);
  const ownerId = String(creator?._id || value.createdBy || '');
  const recipientCount = value.audienceType === 'specific_students' ? students.length : value.audienceType === 'specific_classes' ? classes.length : 0;
  return {
    ...value,
    creator,
    recipient: { type: value.audienceType, count: recipientCount, classes, students },
    createdBy: ownerId,
    classIds: (value.classIds || []).map((item) => String(item?._id || item)),
    studentIds: (value.studentIds || []).map((item) => String(item?._id || item)),
    canManage: value.status !== 'archived' && (actor.role === 'admin' || ownerId === actor.userId),
  };
};

const markNoticeRead = async (noticeId, actor) => {
  const notice = await getNoticeById(noticeId, actor);
  const result = await notificationService.markEntityRead('Notice', notice._id, actor);
  return {
    noticeId: notice._id,
    isRead: true,
    modifiedCount: result.modifiedCount,
    metrics: result.metrics,
  };
};

/**
 * PATCH /notices/:id
 */
const updateNotice = async (noticeId, data, actor, files) => {
  const notice = await Notice.findOne({ _id: noticeId, isDeleted: false });
  if (!notice) throw appError('Notice not found', 404, ERROR_CODES.NOT_FOUND);

  assertCanManage(notice, actor);
  if (actor.role === 'teacher') {
    const assignedClassId = await getTeacherClassId(actor.userId);
    if (data.audienceType === 'all_classes') {
      throw appError('Teacher cannot target all classes', 403, ERROR_CODES.SCOPE_VIOLATION);
    }
    if (data.classIds?.some((id) => id !== assignedClassId)) {
      throw appError('Teacher can only target their assigned class', 403, ERROR_CODES.SCOPE_VIOLATION);
    }
    if (data.studentIds?.length) await assertStudentsBelongToTeacher(data.studentIds, actor.userId);
  }

  if ((notice.attachments?.length || 0) + (files?.length || 0) > MAX_CONTENT_ATTACHMENTS) {
    throw appError(`A notice can have a maximum of ${MAX_CONTENT_ATTACHMENTS} attachments`, 400, ERROR_CODES.VALIDATION_ERROR);
  }

  const newAttachments = await uploadAttachments(files, 'notices');
  const updates = { ...data };
  if (newAttachments.length > 0) {
    updates.$push = { attachments: { $each: newAttachments } };
    delete updates.attachments;
  }

  const updated = await Notice.findByIdAndUpdate(noticeId, updates, { returnDocument: 'after', runValidators: true });

  logActivity({
    actorId: actor.userId, actorName: actor.userId, actorRole: actor.role,
    actionType: 'UPDATE_NOTICE', entityType: 'Notice', entityId: noticeId,
    metadata: { fields: Object.keys(data) },
  });

  await publishEvent(EVENTS.NOTICE_UPDATED, {
    noticeId: updated._id,
    eventVersion: updated.updatedAt?.getTime(),
  });

  return updated;
};

const removeNoticeAttachment = async (noticeId, path, actor) => {
  const notice = await Notice.findOne({ _id: noticeId, isDeleted: false });
  if (!notice) throw appError('Notice not found', 404, ERROR_CODES.NOT_FOUND);
  assertCanManage(notice, actor);
  const attachment = notice.attachments.find((item) => item.path === path);
  if (!attachment) throw appError('Attachment not found on this notice', 404, ERROR_CODES.NOT_FOUND);
  await deleteFile(path);
  notice.attachments = notice.attachments.filter((item) => item.path !== path);
  await notice.save();
  logActivity({ actorId: actor.userId, actorName: actor.userId, actorRole: actor.role,
    actionType: 'REMOVE_NOTICE_ATTACHMENT', entityType: 'Notice', entityId: noticeId, metadata: { path } });
  return notice;
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

export { createNotice, listNotices, getNoticeById, markNoticeRead, updateNotice, removeNoticeAttachment, deleteNotice };
export default { createNotice, listNotices, getNoticeById, markNoticeRead, updateNotice, removeNoticeAttachment, deleteNotice };
