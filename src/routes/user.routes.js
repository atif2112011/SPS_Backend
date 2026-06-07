import express from 'express';
const { Router } = express;
import userController from '../controllers/user.controller.js';
import { authenticate } from '../middlewares/auth.middleware.js';
import { authorizeRole } from '../middlewares/rbac.middleware.js';
import validate from '../middlewares/validate.middleware.js';
import { createStudentSchema, createTeacherSchema } from '../validators/user.validator.js';

const router = Router();

router.use(authenticate);
router.use(authorizeRole('admin'));

// POST /users/students
router.post('/students', validate(createStudentSchema), userController.createStudent);

// POST /users/teachers
router.post('/teachers', validate(createTeacherSchema), userController.createTeacher);

export default router;
