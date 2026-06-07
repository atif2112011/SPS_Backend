const { Router } = require('express');
const notificationController = require('../controllers/notification.controller');
const { authenticate } = require('../middlewares/auth.middleware');
const validate = require('../middlewares/validate.middleware');
const {
  registerDeviceSchema,
  listNotificationsQuerySchema,
  notificationIdParamSchema,
} = require('../validators/notification.validator');

const router = Router();

router.use(authenticate);

router.post('/register-device', validate(registerDeviceSchema), notificationController.registerDevice);
router.get('/', validate(listNotificationsQuerySchema, 'query'), notificationController.listNotifications);
router.patch('/read-all', notificationController.markAllRead);
router.patch('/:id/read', validate(notificationIdParamSchema, 'params'), notificationController.markNotificationRead);

module.exports = router;
