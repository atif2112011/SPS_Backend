import ReportCard from '../models/ReportCard.model.js';
import TeacherProfile from '../models/TeacherProfile.model.js';
import Class from '../models/Class.model.js';
import User from '../models/User.model.js';
import { uploadFile } from '../utils/firebaseStorage.js';
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
  const existing = await ReportCard.findOne({ studentId, classId, term, academicYear, isDeleted: false });
  if (existing) throw appError('Report card already exists for this student, class, term, and academic year', 409, ERROR_CODES.DUPLICATE_ENTRY);

  const student = await User.findById(studentId);
  if (!student) throw appError('Student not found', 404, ERROR_CODES.NOT_FOUND);

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

  eventBus.emit(EVENTS.REPORT_CARD_UPLOADED, { reportCardId: reportCard._id });

  return reportCard;
};

/**
 * GET /report-cards/student/:studentId
 */
const listStudentReportCards = async (studentId, actor) => {
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

  const reportCards = await ReportCard.find({ studentId, isDeleted: false }).sort({ createdAt: -1 });
  return reportCards;
};

/**
 * PATCH /report-cards/:id
 */
const updateReportCard = async (reportCardId, data, actor, files) => {
  const reportCard = await ReportCard.findOne({ _id: reportCardId, isDeleted: false });
  if (!reportCard) throw appError('Report card not found', 404, ERROR_CODES.NOT_FOUND);

  if (actor.role !== 'admin' && reportCard.createdBy.toString() !== actor.userId) {
    throw appError('You can only edit your own report cards', 403, ERROR_CODES.SCOPE_VIOLATION);
  }

  const newAttachments = await uploadAttachments(files, 'report-cards');
  const updates = { ...data };
  if (newAttachments.length > 0) {
    updates.$push = { attachments: { $each: newAttachments } };
    delete updates.attachments;
  }

  const updated = await ReportCard.findByIdAndUpdate(reportCardId, updates, { returnDocument: 'after' });

  logActivity({
    actorId: actor.userId, actorName: actor.userId, actorRole: actor.role,
    actionType: 'UPDATE_REPORT_CARD', entityType: 'ReportCard', entityId: reportCardId,
    metadata: { fields: Object.keys(data) },
  });

  return updated;
};

/**
 * DELETE /report-cards/:id (soft delete)
 */
const deleteReportCard = async (reportCardId, actor) => {
  const reportCard = await ReportCard.findOne({ _id: reportCardId, isDeleted: false });
  if (!reportCard) throw appError('Report card not found', 404, ERROR_CODES.NOT_FOUND);

  if (actor.role !== 'admin' && reportCard.createdBy.toString() !== actor.userId) {
    throw appError('You can only delete your own report cards', 403, ERROR_CODES.SCOPE_VIOLATION);
  }

  await ReportCard.findByIdAndUpdate(reportCardId, { isDeleted: true });

  logActivity({
    actorId: actor.userId, actorName: actor.userId, actorRole: actor.role,
    actionType: 'DELETE_REPORT_CARD', entityType: 'ReportCard', entityId: reportCardId,
  });
};

export { createReportCard, listStudentReportCards, updateReportCard, deleteReportCard };
export default { createReportCard, listStudentReportCards, updateReportCard, deleteReportCard };
