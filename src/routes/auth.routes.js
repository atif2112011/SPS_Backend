import express from 'express';
const { Router } = express;
import authController from '../controllers/auth.controller.js';
import { authenticate } from '../middlewares/auth.middleware.js';
import validate from '../middlewares/validate.middleware.js';
import { loginSchema, changePasswordSchema } from '../validators/auth.validator.js';

const router = Router();

router.post('/login', validate(loginSchema), authController.login);
router.post('/refresh', authController.refresh);
router.post('/logout', authController.logout);

router.get('/me', authenticate, authController.getMe);
router.patch('/change-password', authenticate, validate(changePasswordSchema), authController.changePassword);

export default router;
