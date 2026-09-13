import Result from '../models/Result.model.js';
import Class from '../models/Class.model.js';
import User from '../models/User.model.js';
import StudentProfile from '../models/StudentProfile.model.js';
import ERROR_CODES from '../constants/errorCodes.js';
import logActivity from '../utils/activityLogger.js';
import { publishEvent } from '../events/eventBus.js';
import EVENTS from '../constants/events.js';
import { parsePagination, buildPaginationMeta, buildSearchRegex } from '../utils/paginationHelper.js';
import { assertStudentBelongsToTeacher, getTeacherContext } from './teacherContext.service.js';

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

const duplicateRecordError = (message) => {
  const error = appError(message, 409, ERROR_CODES.DUPLICATE_ENTRY);
  error.details = [
    { field: 'examName', message: 'This student already has a result for the same class, exam, and academic year' },
    { field: 'academicYear', message: 'Choose a different exam or academic year' },
  ];
  return error;
};

const teacherCanManageRecord = async (result, teacherId) => {
  const assignedClassId = await getTeacherClassId(teacherId);
  if (String(result.classId) !== assignedClassId) {
    throw appError('Historical records can only be changed by an administrator or the teacher of the original class', 403, ERROR_CODES.SCOPE_VIOLATION);
  }
  await assertStudentBelongsToTeacher(result.studentId, teacherId);
};

const normalizeResult = async (result, actor) => {
  const value = result.toObject ? result.toObject() : result;
  const studentId = value.studentId?._id || value.studentId;
  const classId = value.classId?._id || value.classId;
  const currentProfile = await StudentProfile.findOne({ userId: studentId }).populate('classId', 'className section academicYear').lean();
  const assignedClassId = actor.role === 'teacher' ? await getTeacherClassId(actor.userId) : null;
  return {
    ...value,
    student: value.studentId?._id ? value.studentId : null,
    originalClass: value.classId?._id ? value.classId : null,
    creator: value.createdBy?._id ? value.createdBy : null,
    currentClass: currentProfile?.classId || null,
    studentId: String(studentId),
    classId: String(classId),
    createdBy: value.createdBy?._id ? String(value.createdBy._id) : String(value.createdBy || ''),
    isHistorical: Boolean(currentProfile?.classId && String(currentProfile.classId._id) !== String(classId)),
    canManage: actor.role === 'admin' || (actor.role === 'teacher' && assignedClassId === String(classId)),
  };
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

  const existing = await Result.findOne({ studentId, classId, examName, academicYear, isDeleted: false }).collation({ locale: 'en', strength: 2 });
  if (existing) throw duplicateRecordError('Result already exists for this student, class, exam, and academic year');

  const result = await Result.create({
    studentId, classId, examName, academicYear, subjectMarks, overallGrade, rank, remarks,
    createdBy: actor.userId,
  });

  logActivity({
    actorId: actor.userId, actorName: actor.userId, actorRole: actor.role,
    actionType: 'CREATE_RESULT', entityType: 'Result', entityId: result._id,
    metadata: { studentId, classId, examName, academicYear },
  });

  publishEvent(EVENTS.RESULT_CREATED, { resultId: result._id });

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

const getResult = async (resultId, actor) => {
  const result = await Result.findOne({ _id: resultId, isDeleted: false })
    .populate('studentId', 'name username status')
    .populate('classId', 'className section academicYear')
    .populate('createdBy', 'name username role');
  if (!result) throw appError('Result not found', 404, ERROR_CODES.NOT_FOUND);
  const studentId = String(result.studentId?._id || result.studentId);
  if (actor.role === 'student' && actor.userId !== studentId) {
    throw appError('Access denied', 403, ERROR_CODES.SCOPE_VIOLATION);
  }
  if (actor.role === 'teacher') await assertStudentBelongsToTeacher(studentId, actor.userId);
  return normalizeResult(result, actor);
};

/**
 * PATCH /results/:id
 */
const updateResult = async (resultId, data, actor) => {
  const result = await Result.findOne({ _id: resultId, isDeleted: false });
  if (!result) throw appError('Result not found', 404, ERROR_CODES.NOT_FOUND);

  if (actor.role === 'teacher') {
    await teacherCanManageRecord(result, actor.userId);
  }

  if (data.examName || data.academicYear) {
    const duplicate = await Result.findOne({
      _id: { $ne: resultId }, studentId: result.studentId, classId: result.classId,
      examName: data.examName || result.examName, academicYear: data.academicYear || result.academicYear, isDeleted: false,
    }).collation({ locale: 'en', strength: 2 });
    if (duplicate) throw duplicateRecordError('Another result already uses this exam and academic year');
  }

  const updated = await Result.findByIdAndUpdate(resultId, data, { returnDocument: 'after', runValidators: true });

  logActivity({
    actorId: actor.userId, actorName: actor.userId, actorRole: actor.role,
    actionType: 'UPDATE_RESULT', entityType: 'Result', entityId: resultId,
    metadata: { fields: Object.keys(data) },
  });

  publishEvent(EVENTS.RESULT_UPDATED, {
    resultId,
    eventVersion: updated.updatedAt?.getTime(),
  });

  return updated;
};

/**
 * DELETE /results/:id (soft delete)
 */
const deleteResult = async (resultId, actor) => {
  const result = await Result.findOne({ _id: resultId, isDeleted: false });
  if (!result) throw appError('Result not found', 404, ERROR_CODES.NOT_FOUND);

  if (actor.role === 'teacher') {
    await teacherCanManageRecord(result, actor.userId);
  }

  await Result.findByIdAndUpdate(resultId, { isDeleted: true });

  logActivity({
    actorId: actor.userId, actorName: actor.userId, actorRole: actor.role,
    actionType: 'DELETE_RESULT', entityType: 'Result', entityId: resultId,
  });
};

export { createResult, getResult, listStudentResults, updateResult, deleteResult };
export default { createResult, getResult, listStudentResults, updateResult, deleteResult };
