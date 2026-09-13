import express from 'express';
const { Router } = express;
import adminController from '../controllers/admin.controller.js';
import { authenticate } from '../middlewares/auth.middleware.js';
import { authorizeRole } from '../middlewares/rbac.middleware.js';
import validate from '../middlewares/validate.middleware.js';
import { activityLogsQuerySchema } from '../validators/admin.validator.js';
import { transferDecisionSchema, transferListQuerySchema } from '../validators/teacherPortal.validator.js';

const router = Router();

router.use(authenticate);
router.use(authorizeRole('admin'));

router.get('/metrics/overview', adminController.getOverviewMetrics);
router.get('/activity-logs', validate(activityLogsQuerySchema, 'query'), adminController.listActivityLogs);
router.get('/transfer-requests', validate(transferListQuerySchema, 'query'), adminController.listTransferRequests);
router.get('/transfer-requests/:requestId', adminController.getTransferRequest);
router.post('/transfer-requests/:requestId/approve', validate(transferDecisionSchema), adminController.approveTransfer);
router.post('/transfer-requests/:requestId/reject', validate(transferDecisionSchema), adminController.rejectTransfer);

export default router;
