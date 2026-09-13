import express from 'express';
const { Router } = express;
import resultController from '../controllers/result.controller.js';
import { authenticate } from '../middlewares/auth.middleware.js';
import { authorizeRole } from '../middlewares/rbac.middleware.js';
import validate from '../middlewares/validate.middleware.js';
import { createResultSchema, updateResultSchema, listResultsQuerySchema, studentIdParamSchema, idParamSchema } from '../validators/result.validator.js';

const router = Router();

router.use(authenticate);

// GET /results/student/:studentId — admin, teacher, student (own)
router.get('/student/:studentId', validate(studentIdParamSchema, 'params'), validate(listResultsQuerySchema, 'query'), resultController.listStudentResults);

router.get('/:id', validate(idParamSchema, 'params'), resultController.getResult);

// POST /results — admin, teacher
router.post('/', authorizeRole('admin', 'teacher'), validate(createResultSchema), resultController.createResult);

// PATCH /results/:id — admin, teacher (own)
router.patch('/:id', authorizeRole('admin', 'teacher'), validate(idParamSchema, 'params'), validate(updateResultSchema), resultController.updateResult);

// DELETE /results/:id — admin, teacher (own)
router.delete('/:id', authorizeRole('admin', 'teacher'), validate(idParamSchema, 'params'), resultController.deleteResult);

export default router;
