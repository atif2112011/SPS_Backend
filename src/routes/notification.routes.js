import express from 'express';
const { Router } = express;
import notificationController from '../controllers/notification.controller.js';
import { authenticate } from '../middlewares/auth.middleware.js';
import validate from '../middlewares/validate.middleware.js';
import {
  registerDeviceSchema,
  listNotificationsQuerySchema,
  notificationIdParamSchema,
} from '../validators/notification.validator.js';

const router = Router();

router.use(authenticate);

router.post('/register-device', validate(registerDeviceSchema), notificationController.registerDevice);
router.get('/', validate(listNotificationsQuerySchema, 'query'), notificationController.listNotifications);
router.patch('/read-all', notificationController.markAllRead);
router.patch('/:id/read', validate(notificationIdParamSchema, 'params'), notificationController.markNotificationRead);

export default router;
