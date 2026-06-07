const { Router } = require('express');
const adminController = require('../controllers/admin.controller');
const { authenticate } = require('../middlewares/auth.middleware');
const { authorizeRole } = require('../middlewares/rbac.middleware');
const validate = require('../middlewares/validate.middleware');
const { activityLogsQuerySchema } = require('../validators/admin.validator');

const router = Router();

router.use(authenticate);
router.use(authorizeRole('admin'));

router.get('/metrics/overview', adminController.getOverviewMetrics);
router.get('/activity-logs', validate(activityLogsQuerySchema, 'query'), adminController.listActivityLogs);

module.exports = router;
