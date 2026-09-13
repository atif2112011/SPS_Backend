import express from 'express';
const { Router } = express;
import reportCardController from '../controllers/reportCard.controller.js';
import { authenticate } from '../middlewares/auth.middleware.js';
import { authorizeRole } from '../middlewares/rbac.middleware.js';
import validate from '../middlewares/validate.middleware.js';
import { handleUpload, uploadFiles } from '../middlewares/upload.middleware.js';
import { MAX_REPORT_ATTACHMENTS } from '../constants/uploads.js';
import { createReportCardSchema, updateReportCardSchema, listReportCardsQuerySchema, studentIdParamSchema, idParamSchema, removeAttachmentSchema } from '../validators/reportCard.validator.js';

const router = Router();

router.use(authenticate);

// GET /report-cards/student/:studentId — admin, teacher, student (own)
router.get('/student/:studentId', validate(studentIdParamSchema, 'params'), validate(listReportCardsQuerySchema, 'query'), reportCardController.listStudentReportCards);

router.get('/:id', validate(idParamSchema, 'params'), reportCardController.getReportCard);

// POST /report-cards — admin, teacher
router.post('/', authorizeRole('admin', 'teacher'), handleUpload(uploadFiles, MAX_REPORT_ATTACHMENTS), validate(createReportCardSchema), reportCardController.createReportCard);

// PATCH /report-cards/:id — admin, teacher (own)
router.patch('/:id', authorizeRole('admin', 'teacher'), validate(idParamSchema, 'params'), handleUpload(uploadFiles, MAX_REPORT_ATTACHMENTS), validate(updateReportCardSchema), reportCardController.updateReportCard);

router.delete('/:id/attachments', authorizeRole('admin', 'teacher'), validate(idParamSchema, 'params'), validate(removeAttachmentSchema), reportCardController.removeReportCardAttachment);

// DELETE /report-cards/:id — admin, teacher (own)
router.delete('/:id', authorizeRole('admin', 'teacher'), validate(idParamSchema, 'params'), reportCardController.deleteReportCard);

export default router;
