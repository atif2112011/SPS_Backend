import adminService from '../services/admin.service.js';
import { sendSuccess } from '../utils/responseHelper.js';
import asyncWrapper from '../utils/asyncWrapper.js';
import teacherPortalService from '../services/teacherPortal.service.js';
import logActivity from '../utils/activityLogger.js';

const getOverviewMetrics = asyncWrapper(async (req, res) => {
  const metrics = await adminService.getOverviewMetrics();
  sendSuccess(res, { message: 'Admin overview metrics fetched', data: metrics });
});

const listActivityLogs = asyncWrapper(async (req, res) => {
  const { logs, pagination } = await adminService.listActivityLogs(req.query);
  sendSuccess(res, { message: 'Activity logs fetched', data: logs, pagination });
});

const listTransferRequests = asyncWrapper(async (req, res) => {
  const { requests, pagination } = await teacherPortalService.listTransferRequests(req.user, req.query, { admin: true });
  sendSuccess(res, { message: 'Transfer requests fetched', data: requests, pagination });
});

const getTransferRequest = asyncWrapper(async (req, res) => {
  const request = await teacherPortalService.getTransferRequest(req.user, req.params.requestId, { admin: true });
  sendSuccess(res, { message: 'Transfer request fetched', data: request });
});

const approveTransfer = asyncWrapper(async (req, res) => {
  const request = await teacherPortalService.approveTransfer(
    req.user,
    req.params.requestId,
    req.body.decisionNote,
    { admin: true }
  );
  logActivity({
    actorId: req.user.userId, actorName: req.user.userId, actorRole: req.user.role,
    targetId: request.studentId, targetRole: 'student',
    actionType: 'APPROVE_STUDENT_TRANSFER', entityType: 'StudentTransferRequest', entityId: request._id,
    metadata: { sourceClassId: request.sourceClassId, destinationClassId: request.destinationClassId },
    ipAddress: req.ip, userAgent: req.headers['user-agent'],
  });
  sendSuccess(res, { message: 'Transfer approved', data: request });
});

const rejectTransfer = asyncWrapper(async (req, res) => {
  const request = await teacherPortalService.rejectTransfer(
    req.user,
    req.params.requestId,
    req.body.decisionNote,
    { admin: true }
  );
  logActivity({
    actorId: req.user.userId, actorName: req.user.userId, actorRole: req.user.role,
    targetId: request.studentId, targetRole: 'student',
    actionType: 'REJECT_STUDENT_TRANSFER', entityType: 'StudentTransferRequest', entityId: request._id,
    ipAddress: req.ip, userAgent: req.headers['user-agent'],
  });
  sendSuccess(res, { message: 'Transfer rejected', data: request });
});

export { approveTransfer, getOverviewMetrics, getTransferRequest, listActivityLogs, listTransferRequests, rejectTransfer };
export default { approveTransfer, getOverviewMetrics, getTransferRequest, listActivityLogs, listTransferRequests, rejectTransfer };
