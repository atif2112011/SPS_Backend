import express from 'express';
const { Router } = express;
import notificationController from '../controllers/notification.controller.js';
import { authenticate } from '../middlewares/auth.middleware.js';
import { authorizeRole } from '../middlewares/rbac.middleware.js';
import validate from '../middlewares/validate.middleware.js';
import {
  registerDeviceSchema,
  unregisterDeviceSchema,
  campaignPreviewSchema,
  createCampaignSchema,
  listCampaignsQuerySchema,
  listDeliveriesQuerySchema,
  listNotificationsQuerySchema,
  notificationIdParamSchema,
} from '../validators/notification.validator.js';

const router = Router();

router.use(authenticate);

router.post('/register-device', validate(registerDeviceSchema), notificationController.registerDevice);
router.delete('/register-device', validate(unregisterDeviceSchema), notificationController.unregisterDevice);
router.post('/campaigns/preview', authorizeRole('admin'), validate(campaignPreviewSchema), notificationController.previewCampaign);
router.post('/campaigns', authorizeRole('admin'), validate(createCampaignSchema), notificationController.createCampaign);
router.get('/campaigns', authorizeRole('admin'), validate(listCampaignsQuerySchema, 'query'), notificationController.listCampaigns);
router.get('/campaigns/:id/deliveries', authorizeRole('admin'), validate(notificationIdParamSchema, 'params'), validate(listDeliveriesQuerySchema, 'query'), notificationController.listCampaignDeliveries);
router.post('/campaigns/:id/cancel', authorizeRole('admin'), validate(notificationIdParamSchema, 'params'), notificationController.cancelCampaign);
router.post('/campaigns/:id/retry-failed', authorizeRole('admin'), validate(notificationIdParamSchema, 'params'), notificationController.retryFailed);
router.get('/campaigns/:id', authorizeRole('admin'), validate(notificationIdParamSchema, 'params'), notificationController.getCampaign);
router.get('/', validate(listNotificationsQuerySchema, 'query'), notificationController.listNotifications);
router.patch('/read-all', notificationController.markAllRead);
router.patch('/:id/read', validate(notificationIdParamSchema, 'params'), notificationController.markNotificationRead);

export default router;
