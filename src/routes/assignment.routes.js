import express from 'express';
const { Router } = express;
import assignmentController from '../controllers/assignment.controller.js';
import { authenticate } from '../middlewares/auth.middleware.js';
import { authorizeRole } from '../middlewares/rbac.middleware.js';
import validate from '../middlewares/validate.middleware.js';
import { handleUpload, uploadImages } from '../middlewares/upload.middleware.js';
import { createAssignmentSchema, updateAssignmentSchema, listAssignmentsQuerySchema } from '../validators/assignment.validator.js';

const router = Router();

router.use(authenticate);

// GET /assignments — all authenticated (scoped in service)
router.get('/', validate(listAssignmentsQuerySchema, 'query'), assignmentController.listAssignments);

// POST /assignments — admin, teacher
router.post('/', authorizeRole('admin', 'teacher'), handleUpload(uploadImages), validate(createAssignmentSchema), assignmentController.createAssignment);

// GET /assignments/:id — all authenticated
router.get('/:id', assignmentController.getAssignmentById);

// PATCH /assignments/:id — admin, teacher (own only)
router.patch('/:id', authorizeRole('admin', 'teacher'), handleUpload(uploadImages), validate(updateAssignmentSchema), assignmentController.updateAssignment);

// DELETE /assignments/:id — admin, teacher (own only)
router.delete('/:id', authorizeRole('admin', 'teacher'), assignmentController.deleteAssignment);

export default router;
