import ReportCard from '../models/ReportCard.model.js';
import Class from '../models/Class.model.js';
import User from '../models/User.model.js';
import StudentProfile from '../models/StudentProfile.model.js';
import { deleteFile, uploadFile } from '../utils/firebaseStorage.js';
import ERROR_CODES from '../constants/errorCodes.js';
import logActivity from '../utils/activityLogger.js';
import { publishEvent } from '../events/eventBus.js';
import EVENTS from '../constants/events.js';
import { parsePagination, buildPaginationMeta, buildSearchRegex } from '../utils/paginationHelper.js';
import { assertStudentBelongsToTeacher, getTeacherContext } from './teacherContext.service.js';
import { MAX_REPORT_ATTACHMENTS } from '../constants/uploads.js';

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

const duplicateRecordError = (message) => {
  const error = appError(message, 409, ERROR_CODES.DUPLICATE_ENTRY);
  error.details = [
    { field: 'term', message: 'This student already has a report card for the same class, term, and academic year' },
    { field: 'academicYear', message: 'Choose a different term or academic year' },
  ];
  return error;
};

const teacherCanManageRecord = async (reportCard, teacherId) => {
  const assignedClassId = await getTeacherClassId(teacherId);
  if (String(reportCard.classId) !== assignedClassId) {
    throw appError('Historical records can only be changed by an administrator or the teacher of the original class', 403, ERROR_CODES.SCOPE_VIOLATION);
  }
  await assertStudentBelongsToTeacher(reportCard.studentId, teacherId);
};

const normalizeReportCard = async (reportCard, actor) => {
  const value = reportCard.toObject ? reportCard.toObject() : reportCard;
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
 * POST /report-cards
 * Teacher can only upload for students in their class.
 */
const createReportCard = async (data, actor, files) => {
  const { studentId, classId, term, academicYear, marks = [], remarks } = data;

  if (actor.role === 'teacher') {
    const assignedClassId = await getTeacherClassId(actor.userId);
    if (assignedClassId !== classId) {
      throw appError('Teacher can only upload report cards for their assigned class', 403, ERROR_CODES.SCOPE_VIOLATION);
    }
    // Verify student belongs to the class
    const classDoc = await Class.findById(classId);
    if (!classDoc || !classDoc.studentIds.map(String).includes(studentId)) {
      throw appError('Student is not in this class', 400, ERROR_CODES.SCOPE_VIOLATION);
    }
  }

  // Duplicate check
  const existing = await ReportCard.findOne({ studentId, classId, term, academicYear, isDeleted: false }).collation({ locale: 'en', strength: 2 });
  if (existing) throw duplicateRecordError('Report card already exists for this student, class, term, and academic year');

  const [student, classDoc] = await Promise.all([
    User.findOne({ _id: studentId, role: 'student', status: { $ne: 'deleted' } }),
    Class.findOne({ _id: classId, isDeleted: false }),
  ]);
  if (!student) throw appError('Student not found', 404, ERROR_CODES.NOT_FOUND);
  if (!classDoc) throw appError('Class not found', 404, ERROR_CODES.NOT_FOUND);

  const attachments = await uploadAttachments(files, 'report-cards');

  const reportCard = await ReportCard.create({
    studentId, classId, term, academicYear, marks, remarks, attachments,
    createdBy: actor.userId,
  });

  logActivity({
    actorId: actor.userId, actorName: actor.userId, actorRole: actor.role,
    actionType: 'UPLOAD_REPORT_CARD', entityType: 'ReportCard', entityId: reportCard._id,
    metadata: { studentId, classId, term, academicYear },
  });

  await publishEvent(EVENTS.REPORT_CARD_UPLOADED, { reportCardId: reportCard._id });

  return reportCard;
};

/**
 * GET /report-cards/student/:studentId
 */
const listStudentReportCards = async (studentId, query, actor) => {
  // Student can only see own report cards
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

  const { page, limit, skip, sortBy, sortOrder } = parsePagination(query, ['term', 'academicYear', 'createdAt']);
  const filter = { studentId, isDeleted: false };
  if (query.academicYear) filter.academicYear = query.academicYear;
  if (query.term) filter.term = query.term;
  if (query.search) {
    const searchRegex = buildSearchRegex(query.search);
    filter.$or = [{ term: searchRegex }, { academicYear: searchRegex }, { remarks: searchRegex }, { 'marks.subject': searchRegex }];
  }

  const [reportCards, total] = await Promise.all([
    ReportCard.find(filter).sort({ [sortBy]: sortOrder }).skip(skip).limit(limit),
    ReportCard.countDocuments(filter),
  ]);
  return { reportCards, pagination: buildPaginationMeta(total, page, limit) };
};

const getReportCard = async (reportCardId, actor) => {
  const reportCard = await ReportCard.findOne({ _id: reportCardId, isDeleted: false })
    .populate('studentId', 'name username status')
    .populate('classId', 'className section academicYear')
    .populate('createdBy', 'name username role');
  if (!reportCard) throw appError('Report card not found', 404, ERROR_CODES.NOT_FOUND);
  const studentId = String(reportCard.studentId?._id || reportCard.studentId);
  if (actor.role === 'student' && actor.userId !== studentId) {
    throw appError('Access denied', 403, ERROR_CODES.SCOPE_VIOLATION);
  }
  if (actor.role === 'teacher') await assertStudentBelongsToTeacher(studentId, actor.userId);
  return normalizeReportCard(reportCard, actor);
};

/**
 * PATCH /report-cards/:id
 */
const updateReportCard = async (reportCardId, data, actor, files) => {
  const reportCard = await ReportCard.findOne({ _id: reportCardId, isDeleted: false });
  if (!reportCard) throw appError('Report card not found', 404, ERROR_CODES.NOT_FOUND);

  if (actor.role === 'teacher') {
    await teacherCanManageRecord(reportCard, actor.userId);
  }

  if (data.term || data.academicYear) {
    const duplicate = await ReportCard.findOne({
      _id: { $ne: reportCardId }, studentId: reportCard.studentId, classId: reportCard.classId,
      term: data.term || reportCard.term, academicYear: data.academicYear || reportCard.academicYear, isDeleted: false,
    }).collation({ locale: 'en', strength: 2 });
    if (duplicate) throw duplicateRecordError('Another report card already uses this term and academic year');
  }

  if ((reportCard.attachments?.length || 0) + (files?.length || 0) > MAX_REPORT_ATTACHMENTS) {
    throw appError(`A report card can have a maximum of ${MAX_REPORT_ATTACHMENTS} attachments`, 400, ERROR_CODES.VALIDATION_ERROR);
  }

  const newAttachments = await uploadAttachments(files, 'report-cards');
  const updates = { ...data };
  if (newAttachments.length > 0) {
    updates.$push = { attachments: { $each: newAttachments } };
    delete updates.attachments;
  }

  const updated = await ReportCard.findByIdAndUpdate(reportCardId, updates, { returnDocument: 'after', runValidators: true });

  logActivity({
    actorId: actor.userId, actorName: actor.userId, actorRole: actor.role,
    actionType: 'UPDATE_REPORT_CARD', entityType: 'ReportCard', entityId: reportCardId,
    metadata: { fields: Object.keys(data) },
  });

  await publishEvent(EVENTS.REPORT_CARD_UPDATED, {
    reportCardId: updated._id,
    eventVersion: updated.updatedAt?.getTime(),
  });

  return updated;
};

const removeReportCardAttachment = async (reportCardId, path, actor) => {
  const reportCard = await ReportCard.findOne({ _id: reportCardId, isDeleted: false });
  if (!reportCard) throw appError('Report card not found', 404, ERROR_CODES.NOT_FOUND);
  if (actor.role === 'teacher') await teacherCanManageRecord(reportCard, actor.userId);
  const attachment = reportCard.attachments.find((item) => item.path === path);
  if (!attachment) throw appError('Attachment not found on this report card', 404, ERROR_CODES.NOT_FOUND);
  await deleteFile(path);
  reportCard.attachments = reportCard.attachments.filter((item) => item.path !== path);
  await reportCard.save();
  logActivity({
    actorId: actor.userId, actorName: actor.userId, actorRole: actor.role,
    actionType: 'REMOVE_REPORT_CARD_ATTACHMENT', entityType: 'ReportCard', entityId: reportCardId,
    metadata: { path },
  });
  return reportCard;
};

/**
 * DELETE /report-cards/:id (soft delete)
 */
const deleteReportCard = async (reportCardId, actor) => {
  const reportCard = await ReportCard.findOne({ _id: reportCardId, isDeleted: false });
  if (!reportCard) throw appError('Report card not found', 404, ERROR_CODES.NOT_FOUND);

  if (actor.role === 'teacher') {
    await teacherCanManageRecord(reportCard, actor.userId);
  }

  await ReportCard.findByIdAndUpdate(reportCardId, { isDeleted: true });

  logActivity({
    actorId: actor.userId, actorName: actor.userId, actorRole: actor.role,
    actionType: 'DELETE_REPORT_CARD', entityType: 'ReportCard', entityId: reportCardId,
  });
};

export { createReportCard, getReportCard, listStudentReportCards, updateReportCard, removeReportCardAttachment, deleteReportCard };
export default { createReportCard, getReportCard, listStudentReportCards, updateReportCard, removeReportCardAttachment, deleteReportCard };
