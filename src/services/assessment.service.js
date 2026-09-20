import Assessment from '../models/Assessment.model.js';
import Class from '../models/Class.model.js';
import User from '../models/User.model.js';
import StudentProfile from '../models/StudentProfile.model.js';
import ERROR_CODES from '../constants/errorCodes.js';
import logActivity from '../utils/activityLogger.js';
import { publishEvent } from '../events/eventBus.js';
import EVENTS from '../constants/events.js';
import { parsePagination, buildPaginationMeta, buildSearchRegex } from '../utils/paginationHelper.js';
import { assertStudentBelongsToTeacher, getTeacherContext } from './teacherContext.service.js';
import { uploadFile, deleteFile } from '../utils/firebaseStorage.js';
import { MAX_REPORT_ATTACHMENTS } from '../constants/uploads.js';

const appError = (message, statusCode, errorCode) => Object.assign(new Error(message), { statusCode, errorCode });
const getTeacherClassId = async (userId) => String((await getTeacherContext(userId)).classId);
const uploadAttachments = async (files) => Promise.all((files || []).map((file) => uploadFile(file.buffer, file.originalname, file.mimetype, 'assessments')));
const assertCategoryRules = (data) => {
  if (data.category === 'academic_assessment' && !data.academicYear) throw appError('Academic year is required for academic assessments', 400, ERROR_CODES.VALIDATION_ERROR);
  if (data.category !== 'academic_assessment' && data.subjectMarks?.length) throw appError('Subject marks are only available for academic assessments', 400, ERROR_CODES.VALIDATION_ERROR);
  if (data.score !== undefined && data.maxScore !== undefined && data.score > data.maxScore) throw appError('Score cannot exceed maximum score', 400, ERROR_CODES.VALIDATION_ERROR);
};
const ensureScope = async (studentId, classId, actor) => {
  const [student, classDoc] = await Promise.all([User.findOne({ _id: studentId, role: 'student', status: { $ne: 'deleted' } }), Class.findOne({ _id: classId, isDeleted: false })]);
  if (!student) throw appError('Student not found', 404, ERROR_CODES.NOT_FOUND);
  if (!classDoc) throw appError('Class not found', 404, ERROR_CODES.NOT_FOUND);
  if (actor.role === 'teacher') {
    if (await getTeacherClassId(actor.userId) !== String(classId)) throw appError('Teacher can only create assessments for their assigned class', 403, ERROR_CODES.SCOPE_VIOLATION);
    if (!classDoc.studentIds.map(String).includes(String(studentId))) throw appError('Student is not in this class', 400, ERROR_CODES.SCOPE_VIOLATION);
  }
  return classDoc;
};
const canManage = async (record, actor) => {
  if (actor.role !== 'teacher') return;
  if (String(record.classId) !== await getTeacherClassId(actor.userId)) throw appError('Historical records can only be changed by an administrator or the teacher of the original class', 403, ERROR_CODES.SCOPE_VIOLATION);
  await assertStudentBelongsToTeacher(record.studentId, actor.userId);
};
const normalize = async (record, actor) => {
  const value = record.toObject ? record.toObject() : record;
  const studentId = value.studentId?._id || value.studentId; const classId = value.classId?._id || value.classId;
  const profile = await StudentProfile.findOne({ userId: studentId }).populate('classId', 'className section academicYear').lean();
  const teacherClassId = actor.role === 'teacher' ? await getTeacherClassId(actor.userId) : null;
  return { ...value, student: value.studentId?._id ? value.studentId : null, originalClass: value.classId?._id ? value.classId : null, creator: value.createdBy?._id ? value.createdBy : null, currentClass: profile?.classId || null, studentId: String(studentId), classId: String(classId), createdBy: String(value.createdBy?._id || value.createdBy || ''), isHistorical: Boolean(profile?.classId && String(profile.classId._id) !== String(classId)), canManage: actor.role === 'admin' || (actor.role === 'teacher' && teacherClassId === String(classId)) };
};
const duplicate = async (data, ignoredId) => Assessment.findOne({ _id: ignoredId ? { $ne: ignoredId } : { $exists: true }, studentId: data.studentId, classId: data.classId, category: data.category, title: data.title, eventDate: data.eventDate, isDeleted: false }).collation({ locale: 'en', strength: 2 });

const createAssessment = async (data, actor, files = []) => {
  assertCategoryRules(data); await ensureScope(data.studentId, data.classId, actor);
  if (await duplicate(data)) throw appError('An active assessment already exists with the same title, category, and date for this student', 409, ERROR_CODES.DUPLICATE_ENTRY);
  const attachments = await uploadAttachments(files);
  const record = await Assessment.create({ ...data, attachments, createdBy: actor.userId });
  logActivity({ actorId: actor.userId, actorName: actor.userId, actorRole: actor.role, actionType: 'CREATE_ASSESSMENT', entityType: 'Assessment', entityId: record._id, metadata: { studentId: data.studentId, classId: data.classId, category: data.category, title: data.title } });
  await publishEvent(EVENTS.ASSESSMENT_CREATED, { assessmentId: record._id }); return record;
};
const listStudentAssessments = async (studentId, query, actor) => {
  if (actor.role === 'student' && actor.userId !== studentId) throw appError('Access denied', 403, ERROR_CODES.SCOPE_VIOLATION);
  if (actor.role === 'teacher') await assertStudentBelongsToTeacher(studentId, actor.userId);
  const { page, limit, skip, sortBy, sortOrder } = parsePagination(query, ['title', 'category', 'eventDate', 'academicYear', 'rank', 'createdAt']);
  const filter = { studentId, isDeleted: false }; if (query.category) filter.category = query.category; if (query.academicYear) filter.academicYear = query.academicYear;
  if (query.search) { const rx = buildSearchRegex(query.search); filter.$or = [{ title: rx }, { category: rx }, { academicYear: rx }, { outcome: rx }, { grade: rx }, { overallGrade: rx }, { remarks: rx }, { 'subjectMarks.subject': rx }]; }
  const [assessments, total] = await Promise.all([Assessment.find(filter).sort({ [sortBy]: sortOrder }).skip(skip).limit(limit), Assessment.countDocuments(filter)]);
  return { assessments, pagination: buildPaginationMeta(total, page, limit) };
};
const getAssessment = async (id, actor) => {
  const record = await Assessment.findOne({ _id: id, isDeleted: false }).populate('studentId', 'name username status').populate('classId', 'className section academicYear').populate('createdBy', 'name username role');
  if (!record) throw appError('Assessment not found', 404, ERROR_CODES.NOT_FOUND); const studentId = String(record.studentId?._id || record.studentId);
  if (actor.role === 'student' && actor.userId !== studentId) throw appError('Access denied', 403, ERROR_CODES.SCOPE_VIOLATION); if (actor.role === 'teacher') await assertStudentBelongsToTeacher(studentId, actor.userId); return normalize(record, actor);
};
const updateAssessment = async (id, data, actor, files = []) => {
  const record = await Assessment.findOne({ _id: id, isDeleted: false }); if (!record) throw appError('Assessment not found', 404, ERROR_CODES.NOT_FOUND); await canManage(record, actor);
  const merged = { ...record.toObject(), ...data }; assertCategoryRules(merged); if (await duplicate(merged, id)) throw appError('Another active assessment already uses this title, category, and date for this student', 409, ERROR_CODES.DUPLICATE_ENTRY);
  if ((record.attachments?.length || 0) + files.length > MAX_REPORT_ATTACHMENTS) throw appError(`An assessment can have a maximum of ${MAX_REPORT_ATTACHMENTS} attachments`, 400, ERROR_CODES.VALIDATION_ERROR);
  const attachments = await uploadAttachments(files); const updates = { ...data }; if (attachments.length) updates.$push = { attachments: { $each: attachments } };
  const updated = await Assessment.findByIdAndUpdate(id, updates, { returnDocument: 'after', runValidators: true });
  logActivity({ actorId: actor.userId, actorName: actor.userId, actorRole: actor.role, actionType: 'UPDATE_ASSESSMENT', entityType: 'Assessment', entityId: id, metadata: { fields: Object.keys(data) } }); await publishEvent(EVENTS.ASSESSMENT_UPDATED, { assessmentId: id, eventVersion: updated.updatedAt?.getTime() }); return updated;
};
const removeAssessmentAttachment = async (id, path, actor) => { const record = await Assessment.findOne({ _id: id, isDeleted: false }); if (!record) throw appError('Assessment not found', 404, ERROR_CODES.NOT_FOUND); await canManage(record, actor); const attachment = record.attachments?.find((item) => item.path === path); if (!attachment) throw appError('Attachment not found', 404, ERROR_CODES.NOT_FOUND); await deleteFile(path); return Assessment.findByIdAndUpdate(id, { $pull: { attachments: { path } } }, { returnDocument: 'after' }); };
const deleteAssessment = async (id, actor) => { const record = await Assessment.findOne({ _id: id, isDeleted: false }); if (!record) throw appError('Assessment not found', 404, ERROR_CODES.NOT_FOUND); await canManage(record, actor); await Assessment.findByIdAndUpdate(id, { isDeleted: true }); logActivity({ actorId: actor.userId, actorName: actor.userId, actorRole: actor.role, actionType: 'DELETE_ASSESSMENT', entityType: 'Assessment', entityId: id }); };
export { createAssessment, listStudentAssessments, getAssessment, updateAssessment, removeAssessmentAttachment, deleteAssessment };
export default { createAssessment, listStudentAssessments, getAssessment, updateAssessment, removeAssessmentAttachment, deleteAssessment };
