import teacherPortalService from '../services/teacherPortal.service.js';
import asyncWrapper from '../utils/asyncWrapper.js';
import logActivity from '../utils/activityLogger.js';
import { sendSuccess } from '../utils/responseHelper.js';

const activity = (req, values) => logActivity({
  actorId: req.user.userId,
  actorName: req.user.userId,
  actorRole: req.user.role,
  ipAddress: req.ip,
  userAgent: req.headers['user-agent'],
  ...values,
});

const getDashboard = asyncWrapper(async (req, res) => {
  const dashboard = await teacherPortalService.getDashboard(req.user.userId);
  sendSuccess(res, { message: 'Teacher dashboard fetched', data: dashboard });
});

const getClass = asyncWrapper(async (req, res) => {
  const { getTeacherContext } = await import('../services/teacherContext.service.js');
  const { classDoc } = await getTeacherContext(req.user.userId);
  sendSuccess(res, { message: 'Assigned class fetched', data: classDoc });
});

const listTeacherDirectory = asyncWrapper(async (_req, res) => {
  const teachers = await teacherPortalService.listTeacherDirectory();
  sendSuccess(res, { message: 'Teacher directory fetched', data: teachers });
});

const listStudents = asyncWrapper(async (req, res) => {
  const { students, pagination } = await teacherPortalService.listStudents(req.user.userId, req.query);
  sendSuccess(res, { message: 'Class students fetched', data: students, pagination });
});

const createStudent = asyncWrapper(async (req, res) => {
  const result = await teacherPortalService.createStudent(req.user.userId, req.body);
  activity(req, {
    targetId: result.user._id, targetName: result.user.name, targetRole: 'student',
    actionType: 'CREATE_STUDENT', entityType: 'User', entityId: result.user._id,
    metadata: { classId: result.profile.classId },
  });
  sendSuccess(res, { message: 'Student created in assigned class', data: result, statusCode: 201 });
});

const getStudent = asyncWrapper(async (req, res) => {
  const student = await teacherPortalService.getStudent(req.user.userId, req.params.studentId);
  sendSuccess(res, { message: 'Student fetched', data: student });
});

const updateStudent = asyncWrapper(async (req, res) => {
  const result = await teacherPortalService.updateStudent(req.user.userId, req.params.studentId, req.body);
  activity(req, {
    targetId: result.user._id, targetName: result.user.name, targetRole: 'student',
    actionType: 'UPDATE_STUDENT', entityType: 'User', entityId: result.user._id,
    metadata: { fields: Object.keys(req.body) },
  });
  sendSuccess(res, { message: 'Student updated', data: result });
});

const removeStudent = asyncWrapper(async (req, res) => {
  await teacherPortalService.removeStudent(req.user.userId, req.params.studentId);
  activity(req, {
    targetId: req.params.studentId, targetRole: 'student',
    actionType: 'REMOVE_STUDENT_FROM_CLASS', entityType: 'User', entityId: req.params.studentId,
  });
  sendSuccess(res, { message: 'Student removed from class' });
});

const blockStudent = asyncWrapper(async (req, res) => {
  const user = await teacherPortalService.setStudentBlocked(req.user.userId, req.params.studentId, true);
  activity(req, {
    targetId: user._id, targetName: user.name, targetRole: 'student',
    actionType: 'BLOCK_USER', entityType: 'User', entityId: user._id,
  });
  sendSuccess(res, { message: 'Student account blocked', data: user });
});

const unblockStudent = asyncWrapper(async (req, res) => {
  const user = await teacherPortalService.setStudentBlocked(req.user.userId, req.params.studentId, false);
  activity(req, {
    targetId: user._id, targetName: user.name, targetRole: 'student',
    actionType: 'UNBLOCK_USER', entityType: 'User', entityId: user._id,
  });
  sendSuccess(res, { message: 'Student account unblocked', data: user });
});

const getTransferDestinations = asyncWrapper(async (req, res) => {
  const destinations = await teacherPortalService.getTransferDestinations(req.user.userId);
  sendSuccess(res, { message: 'Transfer destinations fetched', data: destinations });
});

const requestTransfer = asyncWrapper(async (req, res) => {
  const request = await teacherPortalService.requestTransfer(req.user.userId, req.params.studentId, req.body);
  activity(req, {
    targetId: req.params.studentId, targetRole: 'student',
    actionType: 'REQUEST_STUDENT_TRANSFER', entityType: 'StudentTransferRequest', entityId: request._id,
    metadata: { sourceClassId: request.sourceClassId, destinationClassId: request.destinationClassId },
  });
  sendSuccess(res, { message: 'Transfer request submitted', data: request, statusCode: 201 });
});

const listTransferRequests = asyncWrapper(async (req, res) => {
  const { requests, pagination } = await teacherPortalService.listTransferRequests(req.user, req.query);
  sendSuccess(res, { message: 'Transfer requests fetched', data: requests, pagination });
});

const getTransferRequest = asyncWrapper(async (req, res) => {
  const request = await teacherPortalService.getTransferRequest(req.user, req.params.requestId);
  sendSuccess(res, { message: 'Transfer request fetched', data: request });
});

const approveTransfer = asyncWrapper(async (req, res) => {
  const request = await teacherPortalService.approveTransfer(req.user, req.params.requestId, req.body.decisionNote);
  activity(req, {
    targetId: request.studentId, targetRole: 'student',
    actionType: 'APPROVE_STUDENT_TRANSFER', entityType: 'StudentTransferRequest', entityId: request._id,
    metadata: { sourceClassId: request.sourceClassId, destinationClassId: request.destinationClassId },
  });
  sendSuccess(res, { message: 'Transfer approved', data: request });
});

const rejectTransfer = asyncWrapper(async (req, res) => {
  const request = await teacherPortalService.rejectTransfer(req.user, req.params.requestId, req.body.decisionNote);
  activity(req, {
    targetId: request.studentId, targetRole: 'student',
    actionType: 'REJECT_STUDENT_TRANSFER', entityType: 'StudentTransferRequest', entityId: request._id,
  });
  sendSuccess(res, { message: 'Transfer rejected', data: request });
});

const cancelTransfer = asyncWrapper(async (req, res) => {
  const request = await teacherPortalService.cancelTransfer(req.user.userId, req.params.requestId);
  activity(req, {
    targetId: request.studentId, targetRole: 'student',
    actionType: 'CANCEL_STUDENT_TRANSFER', entityType: 'StudentTransferRequest', entityId: request._id,
  });
  sendSuccess(res, { message: 'Transfer request cancelled', data: request });
});

export default {
  approveTransfer, blockStudent, cancelTransfer, createStudent, getClass, getDashboard, getStudent,
  getTransferDestinations, getTransferRequest, listStudents, listTeacherDirectory, listTransferRequests, rejectTransfer,
  removeStudent, requestTransfer, unblockStudent, updateStudent,
};
