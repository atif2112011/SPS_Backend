import express from 'express';
import dashboardController from '../controllers/dashboard.controller.js';
import { authenticate } from '../middlewares/auth.middleware.js';
import { authorizeRole } from '../middlewares/rbac.middleware.js';

const { Router } = express;
const router = Router();

router.get('/', authenticate, authorizeRole('student'), dashboardController.getDashboard);

export default router;
