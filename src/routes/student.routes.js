import express from 'express';
const { Router } = express;
import userController from '../controllers/user.controller.js';
import { authenticate } from '../middlewares/auth.middleware.js';
import { authorizeRole, authorizeOwner } from '../middlewares/rbac.middleware.js';
import validate from '../middlewares/validate.middleware.js';
import { updateStudentSchema, listUsersQuerySchema } from '../validators/user.validator.js';
import { passwordResetRateLimit } from '../middlewares/passwordResetRateLimit.middleware.js';

const router = Router();

// All routes require authentication
router.use(authenticate);

// GET /students — admin; teachers use /teacher/class/students
router.get('/', authorizeRole('admin'), validate(listUsersQuerySchema, 'query'), userController.listStudents);

// GET /students/:id — admin or student-own; teachers use the scoped /teacher endpoint
router.get('/:id', authorizeRole('admin', 'student'), authorizeOwner('id'), userController.getUserById);

// PATCH /students/:id — admin only
router.patch('/:id', authorizeRole('admin'), validate(updateStudentSchema), userController.updateStudent);

// DELETE /students/:id — admin only
router.delete('/:id', authorizeRole('admin'), userController.deleteUser);

// Block/unblock — admin only
router.post('/:id/block', authorizeRole('admin'), userController.blockUser);
router.post('/:id/unblock', authorizeRole('admin'), userController.unblockUser);
router.post('/:id/reset-password', authorizeRole('admin'), passwordResetRateLimit, userController.resetStudentPassword);

export default router;
