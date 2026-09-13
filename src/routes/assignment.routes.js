import express from 'express';
const { Router } = express;
import assignmentController from '../controllers/assignment.controller.js';
import { authenticate } from '../middlewares/auth.middleware.js';
import { authorizeRole } from '../middlewares/rbac.middleware.js';
import validate from '../middlewares/validate.middleware.js';
import { handleUpload, uploadContentAttachments } from '../middlewares/upload.middleware.js';
import { createAssignmentSchema, updateAssignmentSchema, listAssignmentsQuerySchema, assignmentIdParamSchema, removeAttachmentSchema } from '../validators/assignment.validator.js';

const router = Router();

router.use(authenticate);

// GET /assignments — all authenticated (scoped in service)
router.get('/', validate(listAssignmentsQuerySchema, 'query'), assignmentController.listAssignments);

// POST /assignments — admin, teacher
router.post('/', authorizeRole('admin', 'teacher'), handleUpload(uploadContentAttachments), validate(createAssignmentSchema), assignmentController.createAssignment);

// GET /assignments/:id — all authenticated
router.get('/:id', validate(assignmentIdParamSchema, 'params'), assignmentController.getAssignmentById);

// PATCH /assignments/:id — admin, teacher (own only)
router.patch('/:id', authorizeRole('admin', 'teacher'), validate(assignmentIdParamSchema, 'params'), handleUpload(uploadContentAttachments), validate(updateAssignmentSchema), assignmentController.updateAssignment);

router.delete('/:id/attachments', authorizeRole('admin', 'teacher'), validate(assignmentIdParamSchema, 'params'), validate(removeAttachmentSchema), assignmentController.removeAssignmentAttachment);

// DELETE /assignments/:id — admin, teacher (own only)
router.delete('/:id', authorizeRole('admin', 'teacher'), validate(assignmentIdParamSchema, 'params'), assignmentController.deleteAssignment);

export default router;
