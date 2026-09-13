import express from 'express';
import teacherPortalController from '../controllers/teacherPortal.controller.js';
import { authenticate } from '../middlewares/auth.middleware.js';
import { authorizeRole } from '../middlewares/rbac.middleware.js';
import validate from '../middlewares/validate.middleware.js';
import {
  teacherCreateStudentSchema, teacherStudentListQuerySchema, teacherUpdateStudentSchema,
  transferDecisionSchema, transferListQuerySchema, transferRequestSchema,
} from '../validators/teacherPortal.validator.js';

const { Router } = express;
const router = Router();

router.use(authenticate, authorizeRole('teacher'));

router.get('/dashboard', teacherPortalController.getDashboard);
router.get('/class', teacherPortalController.getClass);
router.get('/class/students', validate(teacherStudentListQuerySchema, 'query'), teacherPortalController.listStudents);
router.post('/class/students', validate(teacherCreateStudentSchema), teacherPortalController.createStudent);
router.get('/class/transfer-destinations', teacherPortalController.getTransferDestinations);
router.get('/class/students/:studentId', teacherPortalController.getStudent);
router.patch('/class/students/:studentId', validate(teacherUpdateStudentSchema), teacherPortalController.updateStudent);
router.delete('/class/students/:studentId', teacherPortalController.removeStudent);
router.post('/class/students/:studentId/block', teacherPortalController.blockStudent);
router.post('/class/students/:studentId/unblock', teacherPortalController.unblockStudent);
router.post('/class/students/:studentId/transfer', validate(transferRequestSchema), teacherPortalController.requestTransfer);

router.get('/transfer-requests', validate(transferListQuerySchema, 'query'), teacherPortalController.listTransferRequests);
router.get('/transfer-requests/:requestId', teacherPortalController.getTransferRequest);
router.post('/transfer-requests/:requestId/approve', validate(transferDecisionSchema), teacherPortalController.approveTransfer);
router.post('/transfer-requests/:requestId/reject', validate(transferDecisionSchema), teacherPortalController.rejectTransfer);
router.post('/transfer-requests/:requestId/cancel', teacherPortalController.cancelTransfer);

export default router;
