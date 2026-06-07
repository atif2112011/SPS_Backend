const userService = require('../services/user.service');
const logActivity = require('../utils/activityLogger');
const { sendSuccess } = require('../utils/responseHelper');
const asyncWrapper = require('../utils/asyncWrapper');

/**
 * POST /users/students
 * Body: createStudentSchema
 * Access: admin only
 */
const createStudent = asyncWrapper(async (req, res) => {
  const { user, profile } = await userService.createStudent(req.body);
  await logActivity({
    actorId: req.user.userId, actorName: req.user.name || 'Admin', actorRole: req.user.role,
    targetId: user._id, targetName: user.name, targetRole: 'student',
    actionType: 'CREATE_STUDENT', entityType: 'User', entityId: user._id,
    ipAddress: req.ip, userAgent: req.headers['user-agent'],
  });
  sendSuccess(res, { message: 'Student created successfully', data: { user, profile }, statusCode: 201 });
});

/**
 * POST /users/teachers
 * Body: createTeacherSchema
 * Access: admin only
 */
const createTeacher = asyncWrapper(async (req, res) => {
  const { user, profile } = await userService.createTeacher(req.body);
  await logActivity({
    actorId: req.user.userId, actorName: req.user.name || 'Admin', actorRole: req.user.role,
    targetId: user._id, targetName: user.name, targetRole: 'teacher',
    actionType: 'CREATE_TEACHER', entityType: 'User', entityId: user._id,
    ipAddress: req.ip, userAgent: req.headers['user-agent'],
  });
  sendSuccess(res, { message: 'Teacher created successfully', data: { user, profile }, statusCode: 201 });
});

/**
 * GET /students  or  GET /teachers
 * Query: page, limit, search, status
 * Access: admin (all); teacher (students in own class only — handled via scope in route)
 */
const listStudents = asyncWrapper(async (req, res) => {
  const { users, pagination } = await userService.listUsers(req.query, 'student');
  sendSuccess(res, { message: 'Students fetched', data: users, pagination });
});

const listTeachers = asyncWrapper(async (req, res) => {
  const { users, pagination } = await userService.listUsers(req.query, 'teacher');
  sendSuccess(res, { message: 'Teachers fetched', data: users, pagination });
});

/**
 * GET /students/:id  or  GET /teachers/:id
 */
const getUserById = asyncWrapper(async (req, res) => {
  const { user, profile } = await userService.getUserById(req.params.id);
  sendSuccess(res, { message: 'User fetched', data: { user, profile } });
});

/**
 * PATCH /students/:id
 * Body: updateStudentSchema
 */
const updateStudent = asyncWrapper(async (req, res) => {
  const { user, profile } = await userService.updateStudent(req.params.id, req.body);
  await logActivity({
    actorId: req.user.userId, actorName: req.user.name || req.user.userId, actorRole: req.user.role,
    targetId: user._id, targetName: user.name, targetRole: 'student',
    actionType: 'UPDATE_STUDENT', entityType: 'User', entityId: user._id,
    metadata: { fields: Object.keys(req.body) },
    ipAddress: req.ip, userAgent: req.headers['user-agent'],
  });
  sendSuccess(res, { message: 'Student updated successfully', data: { user, profile } });
});

/**
 * PATCH /teachers/:id
 * Body: updateTeacherSchema
 */
const updateTeacher = asyncWrapper(async (req, res) => {
  const { user, profile } = await userService.updateTeacher(req.params.id, req.body);
  await logActivity({
    actorId: req.user.userId, actorName: req.user.name || req.user.userId, actorRole: req.user.role,
    targetId: user._id, targetName: user.name, targetRole: 'teacher',
    actionType: 'UPDATE_TEACHER', entityType: 'User', entityId: user._id,
    metadata: { fields: Object.keys(req.body) },
    ipAddress: req.ip, userAgent: req.headers['user-agent'],
  });
  sendSuccess(res, { message: 'Teacher updated successfully', data: { user, profile } });
});

/**
 * DELETE /students/:id  (soft delete)
 */
const deleteUser = asyncWrapper(async (req, res) => {
  await userService.deleteUser(req.params.id);
  await logActivity({
    actorId: req.user.userId, actorName: req.user.name || req.user.userId, actorRole: req.user.role,
    targetId: req.params.id, actionType: 'DELETE_USER', entityType: 'User', entityId: req.params.id,
    ipAddress: req.ip, userAgent: req.headers['user-agent'],
  });
  sendSuccess(res, { message: 'User deleted successfully' });
});

/**
 * POST /students/:id/block
 */
const blockUser = asyncWrapper(async (req, res) => {
  await userService.blockUser(req.params.id);
  await logActivity({
    actorId: req.user.userId, actorName: req.user.name || req.user.userId, actorRole: req.user.role,
    targetId: req.params.id, actionType: 'BLOCK_USER', entityType: 'User', entityId: req.params.id,
    ipAddress: req.ip, userAgent: req.headers['user-agent'],
  });
  sendSuccess(res, { message: 'User blocked successfully' });
});

/**
 * POST /students/:id/unblock
 */
const unblockUser = asyncWrapper(async (req, res) => {
  await userService.unblockUser(req.params.id);
  await logActivity({
    actorId: req.user.userId, actorName: req.user.name || req.user.userId, actorRole: req.user.role,
    targetId: req.params.id, actionType: 'UNBLOCK_USER', entityType: 'User', entityId: req.params.id,
    ipAddress: req.ip, userAgent: req.headers['user-agent'],
  });
  sendSuccess(res, { message: 'User unblocked successfully' });
});

module.exports = { createStudent, createTeacher, listStudents, listTeachers, getUserById, updateStudent, updateTeacher, deleteUser, blockUser, unblockUser };
