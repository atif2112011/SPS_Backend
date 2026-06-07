import express from 'express';
const { Router } = express;
import adminController from '../controllers/admin.controller.js';
import { authenticate } from '../middlewares/auth.middleware.js';
import { authorizeRole } from '../middlewares/rbac.middleware.js';
import validate from '../middlewares/validate.middleware.js';
import { activityLogsQuerySchema } from '../validators/admin.validator.js';

const router = Router();

router.use(authenticate);
router.use(authorizeRole('admin'));

router.get('/metrics/overview', adminController.getOverviewMetrics);
router.get('/activity-logs', validate(activityLogsQuerySchema, 'query'), adminController.listActivityLogs);

export default router;
