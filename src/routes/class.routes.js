import express from 'express';
const { Router } = express;
import classController from '../controllers/class.controller.js';
import { authenticate } from '../middlewares/auth.middleware.js';
import { authorizeRole } from '../middlewares/rbac.middleware.js';
import validate from '../middlewares/validate.middleware.js';
import { createClassSchema, updateClassSchema, assignTeacherSchema, manageMembersSchema, listClassQuerySchema } from '../validators/class.validator.js';

const router = Router();

router.use(authenticate);

// GET /classes — admin + teacher
router.get('/', authorizeRole('admin', 'teacher'), validate(listClassQuerySchema, 'query'), classController.listClasses);

// POST /classes — admin
router.post('/', authorizeRole('admin'), validate(createClassSchema), classController.createClass);

// GET /classes/:id — admin + teacher
router.get('/:id', authorizeRole('admin', 'teacher'), classController.getClassById);

// PATCH /classes/:id — admin
router.patch('/:id', authorizeRole('admin'), validate(updateClassSchema), classController.updateClass);

// DELETE /classes/:id — admin
router.delete('/:id', authorizeRole('admin'), classController.deleteClass);

// PATCH /classes/:id/members — admin + teacher
router.patch('/:id/members', authorizeRole('admin', 'teacher'), validate(manageMembersSchema), classController.manageMembers);

// PATCH /classes/:id/teacher — admin
router.patch('/:id/teacher', authorizeRole('admin'), validate(assignTeacherSchema), classController.assignTeacher);

// GET /classes/:id/students — admin + teacher
router.get('/:id/students', authorizeRole('admin', 'teacher'), classController.getClassStudents);

export default router;
