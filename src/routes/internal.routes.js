import express from 'express';
import internalController from '../controllers/internal.controller.js';

const { Router } = express;
const router = Router();

router.get('/notification-worker', internalController.runNotificationWorker);
router.post('/notification-worker', internalController.runNotificationWorker);

export default router;
