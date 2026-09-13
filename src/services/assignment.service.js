import Assignment from '../models/Assignment.model.js';
import StudentProfile from '../models/StudentProfile.model.js';
import { deleteFile, uploadFile } from '../utils/firebaseStorage.js';
import { parsePagination, buildPaginationMeta, buildSearchRegex } from '../utils/paginationHelper.js';
import ERROR_CODES from '../constants/errorCodes.js';
import logActivity from '../utils/activityLogger.js';
import { publishEvent } from '../events/eventBus.js';
import EVENTS from '../constants/events.js';
import { assertStudentsBelongToTeacher, getTeacherContext } from './teacherContext.service.js';
import { MAX_CONTENT_ATTACHMENTS } from '../constants/uploads.js';

const appError = (message, statusCode, errorCode) => {
  const err = new Error(message);
  err.statusCode = statusCode;
  err.errorCode = errorCode;
  return err;
};

const getTeacherClassId = async (userId) => {
  const { classId } = await getTeacherContext(userId);
  return classId.toString();
};

const uploadAttachments = async (files, folder) => {
  if (!files || files.length === 0) return [];
  return Promise.all(files.map((f) => uploadFile(f.buffer, f.originalname, f.mimetype, folder)));
};

const assertCanManage = (assignment, actor) => {
  if (actor.role !== 'admin' && assignment.assignedBy.toString() !== actor.userId) {
    throw appError('You can only change your own assignments', 403, ERROR_CODES.SCOPE_VIOLATION);
  }
  if (assignment.status === 'archived') {
    throw appError('Archived assignments are read only', 409, ERROR_CODES.CONFLICT || ERROR_CODES.VALIDATION_ERROR);
  }
};

const normalizeAssignment = (assignment, actor) => {
  const value = assignment.toObject ? assignment.toObject() : assignment;
  const creator = value.assignedBy?._id ? value.assignedBy : null;
  const classes = (value.classIds || []).filter((item) => item?._id);
  const students = (value.studentIds || []).filter((item) => item?._id);
  const ownerId = String(creator?._id || value.assignedBy || '');
  return {
    ...value,
    creator,
    recipient: {
      type: students.length ? 'specific_students' : 'specific_classes',
      count: students.length || classes.length,
      classes,
      students,
    },
    assignedBy: ownerId,
    classIds: (value.classIds || []).map((item) => String(item?._id || item)),
    studentIds: (value.studentIds || []).map((item) => String(item?._id || item)),
    canManage: value.status !== 'archived' && (actor.role === 'admin' || ownerId === actor.userId),
  };
};

/**
 * POST /assignments
 * Required body: createAssignmentSchema
 */
const createAssignment = async (data, actor, files) => {
  const { title, description, classIds = [], studentIds = [], deadline } = data;

  if (actor.role === 'teacher') {
    const assignedClassId = await getTeacherClassId(actor.userId);
    if (classIds.length > 0 && !classIds.every((id) => id === assignedClassId)) {
      throw appError('Teacher can only create assignments for their assigned class', 403, ERROR_CODES.SCOPE_VIOLATION);
    }
    if (studentIds.length > 0) await assertStudentsBelongToTeacher(studentIds, actor.userId);
  }

  const attachments = await uploadAttachments(files, 'assignments');

  const assignment = await Assignment.create({
    title, description, attachments,
    classIds, studentIds,
    deadline: new Date(deadline),
    assignedBy: actor.userId,
    assignedByRole: actor.role,
  });

  logActivity({
    actorId: actor.userId, actorName: actor.userId, actorRole: actor.role,
    actionType: 'CREATE_ASSIGNMENT', entityType: 'Assignment', entityId: assignment._id,
    metadata: { title, deadline },
  });

  publishEvent(EVENTS.ASSIGNMENT_CREATED, { assignmentId: assignment._id });

  return assignment;
};

/**
 * GET /assignments
 * Query: filter=upcoming|past, classId, search
 */
const listAssignments = async (query, actor) => {
  const { page, limit, skip, sortBy, sortOrder } = parsePagination(query, ['title', 'deadline', 'status', 'createdAt'], 'deadline');
  const { search, classId, filter, status, audience, dateFrom, dateTo } = query;

  const dbFilter = { isDeleted: false };
  if (status) dbFilter.status = status;
  const constraints = [];
  if (search) {
    const searchRegex = buildSearchRegex(search);
    constraints.push({ $or: [{ title: searchRegex }, { description: searchRegex }] });
  }
  if (classId) dbFilter.classIds = classId;

  const now = new Date();
  const dueSoon = new Date(now.getTime() + 24 * 60 * 60 * 1000);
  if (filter === 'upcoming') dbFilter.deadline = { $gte: now };
  if (filter === 'due_soon') dbFilter.deadline = { $gte: now, $lte: dueSoon };
  if (filter === 'past') dbFilter.deadline = { $lt: now };
  if (dateFrom || dateTo) {
    dbFilter.createdAt = {};
    if (dateFrom) dbFilter.createdAt.$gte = new Date(dateFrom);
    if (dateTo) { const end = new Date(dateTo); end.setHours(23, 59, 59, 999); dbFilter.createdAt.$lte = end; }
  }
  if (audience === 'class') dbFilter.classIds = { $exists: true, $ne: [] };
  if (audience === 'students') dbFilter.studentIds = { $exists: true, $ne: [] };

  if (actor.role === 'teacher') {
    const assignedClassId = await getTeacherClassId(actor.userId);
    constraints.push({ $or: [{ classIds: assignedClassId }, { assignedBy: actor.userId }] });
  } else if (actor.role === 'student') {
    const profile = await StudentProfile.findOne({ userId: actor.userId });
    if (profile && profile.classId) {
      constraints.push({ $or: [{ classIds: profile.classId }, { studentIds: actor.userId }] });
    } else {
      dbFilter.studentIds = actor.userId;
    }
  }

  if (constraints.length) dbFilter.$and = constraints;

  const [assignments, total] = await Promise.all([
    Assignment.find(dbFilter).sort({ [sortBy]: sortOrder }).skip(skip).limit(limit),
    Assignment.countDocuments(dbFilter),
  ]);

  return { assignments, pagination: buildPaginationMeta(total, page, limit) };
};

/**
 * GET /assignments/:id
 */
const getAssignmentById = async (assignmentId, actor) => {
  const assignment = await Assignment.findOne({ _id: assignmentId, isDeleted: false })
    .populate('assignedBy', 'name username role')
    .populate('classIds', 'className section academicYear')
    .populate('studentIds', 'name username status');
  if (!assignment) throw appError('Assignment not found', 404, ERROR_CODES.NOT_FOUND);

  if (actor.role === 'teacher') {
    const assignedClassId = await getTeacherClassId(actor.userId);
    const accessible = assignment.classIds.some((item) => String(item?._id || item) === assignedClassId)
      || String(assignment.assignedBy?._id || assignment.assignedBy) === actor.userId;
    if (!accessible) throw appError('Access denied', 403, ERROR_CODES.SCOPE_VIOLATION);
  }

  return normalizeAssignment(assignment, actor);
};

/**
 * PATCH /assignments/:id
 */
const updateAssignment = async (assignmentId, data, actor, files) => {
  const assignment = await Assignment.findOne({ _id: assignmentId, isDeleted: false });
  if (!assignment) throw appError('Assignment not found', 404, ERROR_CODES.NOT_FOUND);

  assertCanManage(assignment, actor);
  if (actor.role === 'teacher') {
    const assignedClassId = await getTeacherClassId(actor.userId);
    if (data.classIds?.some((id) => id !== assignedClassId)) {
      throw appError('Teacher can only target their assigned class', 403, ERROR_CODES.SCOPE_VIOLATION);
    }
    if (data.studentIds?.length) await assertStudentsBelongToTeacher(data.studentIds, actor.userId);
  }

  if ((assignment.attachments?.length || 0) + (files?.length || 0) > MAX_CONTENT_ATTACHMENTS) {
    throw appError(`An assignment can have a maximum of ${MAX_CONTENT_ATTACHMENTS} attachments`, 400, ERROR_CODES.VALIDATION_ERROR);
  }

  const newAttachments = await uploadAttachments(files, 'assignments');
  const updates = { ...data };
  if (data.deadline) updates.deadline = new Date(data.deadline);
  if (newAttachments.length > 0) {
    updates.$push = { attachments: { $each: newAttachments } };
    delete updates.attachments;
  }

  const updated = await Assignment.findByIdAndUpdate(assignmentId, updates, { returnDocument: 'after', runValidators: true });

  logActivity({
    actorId: actor.userId, actorName: actor.userId, actorRole: actor.role,
    actionType: 'UPDATE_ASSIGNMENT', entityType: 'Assignment', entityId: assignmentId,
    metadata: { fields: Object.keys(data) },
  });

  publishEvent(EVENTS.ASSIGNMENT_UPDATED, {
    assignmentId: updated._id,
    eventVersion: updated.updatedAt?.getTime(),
  });

  return updated;
};

const removeAssignmentAttachment = async (assignmentId, path, actor) => {
  const assignment = await Assignment.findOne({ _id: assignmentId, isDeleted: false });
  if (!assignment) throw appError('Assignment not found', 404, ERROR_CODES.NOT_FOUND);
  assertCanManage(assignment, actor);
  const attachment = assignment.attachments.find((item) => item.path === path);
  if (!attachment) throw appError('Attachment not found on this assignment', 404, ERROR_CODES.NOT_FOUND);
  await deleteFile(path);
  assignment.attachments = assignment.attachments.filter((item) => item.path !== path);
  await assignment.save();
  logActivity({ actorId: actor.userId, actorName: actor.userId, actorRole: actor.role,
    actionType: 'REMOVE_ASSIGNMENT_ATTACHMENT', entityType: 'Assignment', entityId: assignmentId, metadata: { path } });
  return assignment;
};

/**
 * DELETE /assignments/:id (soft delete)
 */
const deleteAssignment = async (assignmentId, actor) => {
  const assignment = await Assignment.findOne({ _id: assignmentId, isDeleted: false });
  if (!assignment) throw appError('Assignment not found', 404, ERROR_CODES.NOT_FOUND);

  if (actor.role !== 'admin' && assignment.assignedBy.toString() !== actor.userId) {
    throw appError('You can only delete your own assignments', 403, ERROR_CODES.SCOPE_VIOLATION);
  }

  await Assignment.findByIdAndUpdate(assignmentId, { isDeleted: true });

  logActivity({
    actorId: actor.userId, actorName: actor.userId, actorRole: actor.role,
    actionType: 'DELETE_ASSIGNMENT', entityType: 'Assignment', entityId: assignmentId,
  });
};

export { createAssignment, listAssignments, getAssignmentById, updateAssignment, removeAssignmentAttachment, deleteAssignment };
export default { createAssignment, listAssignments, getAssignmentById, updateAssignment, removeAssignmentAttachment, deleteAssignment };
