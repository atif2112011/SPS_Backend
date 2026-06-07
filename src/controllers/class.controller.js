import classService from '../services/class.service.js';
import logActivity from '../utils/activityLogger.js';
import { sendSuccess } from '../utils/responseHelper.js';
import asyncWrapper from '../utils/asyncWrapper.js';

/**
 * POST /classes
 * Body: createClassSchema
 * Access: admin
 */
const createClass = asyncWrapper(async (req, res) => {
  const classDoc = await classService.createClass(req.body);
  await logActivity({
    actorId: req.user.userId, actorName: req.user.name || req.user.userId, actorRole: req.user.role,
    actionType: 'CREATE_CLASS', entityType: 'Class', entityId: classDoc._id,
    metadata: { className: classDoc.className, section: classDoc.section },
    ipAddress: req.ip, userAgent: req.headers['user-agent'],
  });
  sendSuccess(res, { message: 'Class created successfully', data: classDoc, statusCode: 201 });
});

/**
 * GET /classes
 * Query: page, limit, search, academicYear
 * Access: admin, teacher
 */
const listClasses = asyncWrapper(async (req, res) => {
  const { classes, pagination } = await classService.listClasses(req.query);
  sendSuccess(res, { message: 'Classes fetched', data: classes, pagination });
});

/**
 * GET /classes/:id
 */
const getClassById = asyncWrapper(async (req, res) => {
  const classDoc = await classService.getClassById(req.params.id);
  sendSuccess(res, { message: 'Class fetched', data: classDoc });
});

/**
 * PATCH /classes/:id
 * Body: updateClassSchema
 * Access: admin
 */
const updateClass = asyncWrapper(async (req, res) => {
  const classDoc = await classService.updateClass(req.params.id, req.body);
  await logActivity({
    actorId: req.user.userId, actorName: req.user.name || req.user.userId, actorRole: req.user.role,
    actionType: 'UPDATE_CLASS', entityType: 'Class', entityId: classDoc._id,
    metadata: { fields: Object.keys(req.body) },
    ipAddress: req.ip, userAgent: req.headers['user-agent'],
  });
  sendSuccess(res, { message: 'Class updated successfully', data: classDoc });
});

/**
 * DELETE /classes/:id  (soft delete)
 * Access: admin
 */
const deleteClass = asyncWrapper(async (req, res) => {
  await classService.deleteClass(req.params.id);
  await logActivity({
    actorId: req.user.userId, actorName: req.user.name || req.user.userId, actorRole: req.user.role,
    actionType: 'DELETE_CLASS', entityType: 'Class', entityId: req.params.id,
    ipAddress: req.ip, userAgent: req.headers['user-agent'],
  });
  sendSuccess(res, { message: 'Class deleted successfully' });
});

/**
 * PATCH /classes/:id/members
 * Body: { action: 'add'|'remove', studentIds: [...] }
 * Access: admin, teacher (own class only)
 */
const manageMembers = asyncWrapper(async (req, res) => {
  const { action, studentIds } = req.body;
  const classDoc = await classService.manageMembers(req.params.id, action, studentIds);
  await logActivity({
    actorId: req.user.userId, actorName: req.user.name || req.user.userId, actorRole: req.user.role,
    actionType: action === 'add' ? 'ADD_STUDENTS_TO_CLASS' : 'REMOVE_STUDENTS_FROM_CLASS',
    entityType: 'Class', entityId: classDoc._id,
    metadata: { studentIds, count: studentIds.length },
    ipAddress: req.ip, userAgent: req.headers['user-agent'],
  });
  sendSuccess(res, { message: `Students ${action === 'add' ? 'added to' : 'removed from'} class`, data: classDoc });
});

/**
 * PATCH /classes/:id/teacher
 * Body: { teacherId }
 * Access: admin
 */
const assignTeacher = asyncWrapper(async (req, res) => {
  const classDoc = await classService.assignTeacher(req.params.id, req.body.teacherId);
  await logActivity({
    actorId: req.user.userId, actorName: req.user.name || req.user.userId, actorRole: req.user.role,
    actionType: 'ASSIGN_TEACHER', entityType: 'Class', entityId: classDoc._id,
    metadata: { teacherId: req.body.teacherId },
    ipAddress: req.ip, userAgent: req.headers['user-agent'],
  });
  sendSuccess(res, { message: 'Teacher assigned to class', data: classDoc });
});

/**
 * GET /classes/:id/students
 * Access: admin, teacher (own class)
 */
const getClassStudents = asyncWrapper(async (req, res) => {
  const students = await classService.getClassStudents(req.params.id);
  sendSuccess(res, { message: 'Class students fetched', data: students });
});

export { createClass, listClasses, getClassById, updateClass, deleteClass, manageMembers, assignTeacher, getClassStudents };
export default { createClass, listClasses, getClassById, updateClass, deleteClass, manageMembers, assignTeacher, getClassStudents };
