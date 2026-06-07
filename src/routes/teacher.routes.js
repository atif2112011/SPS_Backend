import express from 'express';
const { Router } = express;
import userController from '../controllers/user.controller.js';
import { authenticate } from '../middlewares/auth.middleware.js';
import { authorizeRole } from '../middlewares/rbac.middleware.js';
import validate from '../middlewares/validate.middleware.js';
import { updateTeacherSchema, listUsersQuerySchema } from '../validators/user.validator.js';

const router = Router();

router.use(authenticate);

// GET /teachers — admin only
router.get('/', authorizeRole('admin'), validate(listUsersQuerySchema, 'query'), userController.listTeachers);

// GET /teachers/:id — admin only
router.get('/:id', authorizeRole('admin'), userController.getUserById);

// PATCH /teachers/:id — admin only
router.patch('/:id', authorizeRole('admin'), validate(updateTeacherSchema), userController.updateTeacher);

// Block/unblock — admin only
router.post('/:id/block', authorizeRole('admin'), userController.blockUser);
router.post('/:id/unblock', authorizeRole('admin'), userController.unblockUser);

export default router;
