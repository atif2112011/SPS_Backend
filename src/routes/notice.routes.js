import express from 'express';
const { Router } = express;
import noticeController from '../controllers/notice.controller.js';
import { authenticate } from '../middlewares/auth.middleware.js';
import { authorizeRole } from '../middlewares/rbac.middleware.js';
import validate from '../middlewares/validate.middleware.js';
import { handleUpload, uploadImages } from '../middlewares/upload.middleware.js';
import { createNoticeSchema, updateNoticeSchema, listNoticesQuerySchema } from '../validators/notice.validator.js';

const router = Router();

router.use(authenticate);

// GET /notices — all authenticated (scoped in service)
router.get('/', validate(listNoticesQuerySchema, 'query'), noticeController.listNotices);

// POST /notices — admin, teacher
router.post('/', authorizeRole('admin', 'teacher'), handleUpload(uploadImages), validate(createNoticeSchema), noticeController.createNotice);

// GET /notices/:id — all authenticated
router.get('/:id', noticeController.getNoticeById);

// PATCH /notices/:id — admin, teacher (own only)
router.patch('/:id', authorizeRole('admin', 'teacher'), handleUpload(uploadImages), validate(updateNoticeSchema), noticeController.updateNotice);

// DELETE /notices/:id — admin, teacher (own only)
router.delete('/:id', authorizeRole('admin', 'teacher'), noticeController.deleteNotice);

export default router;
