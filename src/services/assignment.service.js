import Assignment from '../models/Assignment.model.js';
import TeacherProfile from '../models/TeacherProfile.model.js';
import StudentProfile from '../models/StudentProfile.model.js';
import { uploadFile } from '../utils/firebaseStorage.js';
import { parsePagination, buildPaginationMeta } from '../utils/paginationHelper.js';
import ERROR_CODES from '../constants/errorCodes.js';
import logActivity from '../utils/activityLogger.js';
import eventBus from '../events/eventBus.js';
import EVENTS from '../constants/events.js';

const appError = (message, statusCode, errorCode) => {
  const err = new Error(message);
  err.statusCode = statusCode;
  err.errorCode = errorCode;
  return err;
};

const getTeacherClassId = async (userId) => {
  const profile = await TeacherProfile.findOne({ userId });
  if (!profile || !profile.assignedClassId) {
    throw appError('Teacher has no assigned class', 400, ERROR_CODES.SCOPE_VIOLATION);
  }
  return profile.assignedClassId.toString();
};

const uploadAttachments = async (files, folder) => {
  if (!files || files.length === 0) return [];
  return Promise.all(files.map((f) => uploadFile(f.buffer, f.originalname, f.mimetype, folder)));
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

  eventBus.emit(EVENTS.ASSIGNMENT_CREATED, { assignmentId: assignment._id });

  return assignment;
};

/**
 * GET /assignments
 * Query: filter=upcoming|past, classId, search
 */
const listAssignments = async (query, actor) => {
  const { page, limit, skip, sortBy, sortOrder } = parsePagination(query);
  const { search, classId, filter, status } = query;

  const dbFilter = { isDeleted: false };
  if (status) dbFilter.status = status;
  if (search) dbFilter.title = { $regex: search, $options: 'i' };
  if (classId) dbFilter.classIds = classId;

  if (filter === 'upcoming') dbFilter.deadline = { $gte: new Date() };
  if (filter === 'past') dbFilter.deadline = { $lt: new Date() };

  if (actor.role === 'teacher') {
    const assignedClassId = await getTeacherClassId(actor.userId);
    dbFilter.$or = [{ classIds: assignedClassId }, { assignedBy: actor.userId }];
  } else if (actor.role === 'student') {
    const profile = await StudentProfile.findOne({ userId: actor.userId });
    if (profile && profile.classId) {
      dbFilter.$or = [{ classIds: profile.classId }, { studentIds: actor.userId }];
    } else {
      dbFilter.studentIds = actor.userId;
    }
  }

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
  const assignment = await Assignment.findOne({ _id: assignmentId, isDeleted: false });
  if (!assignment) throw appError('Assignment not found', 404, ERROR_CODES.NOT_FOUND);

  if (actor.role === 'teacher') {
    const assignedClassId = await getTeacherClassId(actor.userId);
    const accessible = assignment.classIds.map(String).includes(assignedClassId)
      || assignment.assignedBy.toString() === actor.userId;
    if (!accessible) throw appError('Access denied', 403, ERROR_CODES.SCOPE_VIOLATION);
  }

  return assignment;
};

/**
 * PATCH /assignments/:id
 */
const updateAssignment = async (assignmentId, data, actor, files) => {
  const assignment = await Assignment.findOne({ _id: assignmentId, isDeleted: false });
  if (!assignment) throw appError('Assignment not found', 404, ERROR_CODES.NOT_FOUND);

  if (actor.role !== 'admin' && assignment.assignedBy.toString() !== actor.userId) {
    throw appError('You can only edit your own assignments', 403, ERROR_CODES.SCOPE_VIOLATION);
  }

  const newAttachments = await uploadAttachments(files, 'assignments');
  const updates = { ...data };
  if (data.deadline) updates.deadline = new Date(data.deadline);
  if (newAttachments.length > 0) {
    updates.$push = { attachments: { $each: newAttachments } };
    delete updates.attachments;
  }

  const updated = await Assignment.findByIdAndUpdate(assignmentId, updates, { returnDocument: 'after' });

  logActivity({
    actorId: actor.userId, actorName: actor.userId, actorRole: actor.role,
    actionType: 'UPDATE_ASSIGNMENT', entityType: 'Assignment', entityId: assignmentId,
    metadata: { fields: Object.keys(data) },
  });

  return updated;
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

export { createAssignment, listAssignments, getAssignmentById, updateAssignment, deleteAssignment };
export default { createAssignment, listAssignments, getAssignmentById, updateAssignment, deleteAssignment };
