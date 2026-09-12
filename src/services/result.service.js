import Result from '../models/Result.model.js';
import TeacherProfile from '../models/TeacherProfile.model.js';
import Class from '../models/Class.model.js';
import User from '../models/User.model.js';
import ERROR_CODES from '../constants/errorCodes.js';
import logActivity from '../utils/activityLogger.js';
import eventBus from '../events/eventBus.js';
import EVENTS from '../constants/events.js';
import { parsePagination, buildPaginationMeta, buildSearchRegex } from '../utils/paginationHelper.js';

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

/**
 * POST /results
 */
const createResult = async (data, actor) => {
  const { studentId, classId, examName, academicYear, subjectMarks = [], overallGrade, rank, remarks } = data;

  if (actor.role === 'teacher') {
    const assignedClassId = await getTeacherClassId(actor.userId);
    if (assignedClassId !== classId) {
      throw appError('Teacher can only create results for their assigned class', 403, ERROR_CODES.SCOPE_VIOLATION);
    }
    const classDoc = await Class.findById(classId);
    if (!classDoc || !classDoc.studentIds.map(String).includes(studentId)) {
      throw appError('Student is not in this class', 400, ERROR_CODES.SCOPE_VIOLATION);
    }
  }

  const [student, classDoc] = await Promise.all([
    User.findOne({ _id: studentId, role: 'student', status: { $ne: 'deleted' } }),
    Class.findOne({ _id: classId, isDeleted: false }),
  ]);
  if (!student) throw appError('Student not found', 404, ERROR_CODES.NOT_FOUND);
  if (!classDoc) throw appError('Class not found', 404, ERROR_CODES.NOT_FOUND);

  const existing = await Result.findOne({ studentId, classId, examName, academicYear, isDeleted: false });
  if (existing) throw appError('Result already exists for this student, class, exam, and academic year', 409, ERROR_CODES.DUPLICATE_ENTRY);

  const result = await Result.create({
    studentId, classId, examName, academicYear, subjectMarks, overallGrade, rank, remarks,
    createdBy: actor.userId,
  });

  logActivity({
    actorId: actor.userId, actorName: actor.userId, actorRole: actor.role,
    actionType: 'CREATE_RESULT', entityType: 'Result', entityId: result._id,
    metadata: { studentId, classId, examName, academicYear },
  });

  eventBus.emit(EVENTS.RESULT_UPDATED, { resultId: result._id });

  return result;
};

/**
 * GET /results/student/:studentId
 */
const listStudentResults = async (studentId, query, actor) => {
  if (actor.role === 'student' && actor.userId !== studentId) {
    throw appError('Access denied', 403, ERROR_CODES.SCOPE_VIOLATION);
  }

  if (actor.role === 'teacher') {
    const assignedClassId = await getTeacherClassId(actor.userId);
    const classDoc = await Class.findById(assignedClassId);
    if (!classDoc || !classDoc.studentIds.map(String).includes(studentId)) {
      throw appError('Student is not in your class', 403, ERROR_CODES.SCOPE_VIOLATION);
    }
  }

  const { page, limit, skip, sortBy, sortOrder } = parsePagination(query, ['examName', 'academicYear', 'rank', 'createdAt']);
  const filter = { studentId, isDeleted: false };
  if (query.academicYear) filter.academicYear = query.academicYear;
  if (query.examName) filter.examName = query.examName;
  if (query.search) {
    const searchRegex = buildSearchRegex(query.search);
    filter.$or = [{ examName: searchRegex }, { academicYear: searchRegex }, { remarks: searchRegex }, { overallGrade: searchRegex }, { 'subjectMarks.subject': searchRegex }];
  }

  const [results, total] = await Promise.all([
    Result.find(filter).sort({ [sortBy]: sortOrder }).skip(skip).limit(limit),
    Result.countDocuments(filter),
  ]);
  return { results, pagination: buildPaginationMeta(total, page, limit) };
};

/**
 * PATCH /results/:id
 */
const updateResult = async (resultId, data, actor) => {
  const result = await Result.findOne({ _id: resultId, isDeleted: false });
  if (!result) throw appError('Result not found', 404, ERROR_CODES.NOT_FOUND);

  if (actor.role !== 'admin' && result.createdBy.toString() !== actor.userId) {
    throw appError('You can only edit your own results', 403, ERROR_CODES.SCOPE_VIOLATION);
  }

  const updated = await Result.findByIdAndUpdate(resultId, data, { returnDocument: 'after', runValidators: true });

  logActivity({
    actorId: actor.userId, actorName: actor.userId, actorRole: actor.role,
    actionType: 'UPDATE_RESULT', entityType: 'Result', entityId: resultId,
    metadata: { fields: Object.keys(data) },
  });

  eventBus.emit(EVENTS.RESULT_UPDATED, { resultId });

  return updated;
};

/**
 * DELETE /results/:id (soft delete)
 */
const deleteResult = async (resultId, actor) => {
  const result = await Result.findOne({ _id: resultId, isDeleted: false });
  if (!result) throw appError('Result not found', 404, ERROR_CODES.NOT_FOUND);

  if (actor.role !== 'admin' && result.createdBy.toString() !== actor.userId) {
    throw appError('You can only delete your own results', 403, ERROR_CODES.SCOPE_VIOLATION);
  }

  await Result.findByIdAndUpdate(resultId, { isDeleted: true });

  logActivity({
    actorId: actor.userId, actorName: actor.userId, actorRole: actor.role,
    actionType: 'DELETE_RESULT', entityType: 'Result', entityId: resultId,
  });
};

export { createResult, listStudentResults, updateResult, deleteResult };
export default { createResult, listStudentResults, updateResult, deleteResult };
