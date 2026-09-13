import express from 'express';
const { Router } = express;
import noticeController from '../controllers/notice.controller.js';
import { authenticate } from '../middlewares/auth.middleware.js';
import { authorizeRole } from '../middlewares/rbac.middleware.js';
import validate from '../middlewares/validate.middleware.js';
import { handleUpload, uploadContentAttachments } from '../middlewares/upload.middleware.js';
import { createNoticeSchema, updateNoticeSchema, listNoticesQuerySchema, noticeIdParamSchema, removeAttachmentSchema } from '../validators/notice.validator.js';

const router = Router();

router.use(authenticate);

// GET /notices — all authenticated (scoped in service)
router.get('/', validate(listNoticesQuerySchema, 'query'), noticeController.listNotices);

// POST /notices — admin, teacher
router.post('/', authorizeRole('admin', 'teacher'), handleUpload(uploadContentAttachments), validate(createNoticeSchema), noticeController.createNotice);

// POST /notices/:id/read — student opens a notice
router.post('/:id/read', authorizeRole('student'), validate(noticeIdParamSchema, 'params'), noticeController.markNoticeRead);

// GET /notices/:id — all authenticated
router.get('/:id', validate(noticeIdParamSchema, 'params'), noticeController.getNoticeById);

// PATCH /notices/:id — admin, teacher (own only)
router.patch('/:id', authorizeRole('admin', 'teacher'), validate(noticeIdParamSchema, 'params'), handleUpload(uploadContentAttachments), validate(updateNoticeSchema), noticeController.updateNotice);

router.delete('/:id/attachments', authorizeRole('admin', 'teacher'), validate(noticeIdParamSchema, 'params'), validate(removeAttachmentSchema), noticeController.removeNoticeAttachment);

// DELETE /notices/:id — admin, teacher (own only)
router.delete('/:id', authorizeRole('admin', 'teacher'), validate(noticeIdParamSchema, 'params'), noticeController.deleteNotice);

export default router;
