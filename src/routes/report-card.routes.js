import express from 'express';
const { Router } = express;
import reportCardController from '../controllers/reportCard.controller.js';
import { authenticate } from '../middlewares/auth.middleware.js';
import { authorizeRole } from '../middlewares/rbac.middleware.js';
import validate from '../middlewares/validate.middleware.js';
import { handleUpload, uploadFiles } from '../middlewares/upload.middleware.js';
import { createReportCardSchema, updateReportCardSchema } from '../validators/reportCard.validator.js';

const router = Router();

router.use(authenticate);

// GET /report-cards/student/:studentId — admin, teacher, student (own)
router.get('/student/:studentId', reportCardController.listStudentReportCards);

// POST /report-cards — admin, teacher
router.post('/', authorizeRole('admin', 'teacher'), handleUpload(uploadFiles), validate(createReportCardSchema), reportCardController.createReportCard);

// PATCH /report-cards/:id — admin, teacher (own)
router.patch('/:id', authorizeRole('admin', 'teacher'), handleUpload(uploadFiles), validate(updateReportCardSchema), reportCardController.updateReportCard);

// DELETE /report-cards/:id — admin, teacher (own)
router.delete('/:id', authorizeRole('admin', 'teacher'), reportCardController.deleteReportCard);

export default router;
