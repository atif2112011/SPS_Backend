const { Router } = require('express');
const noticeController = require('../controllers/notice.controller');
const { authenticate } = require('../middlewares/auth.middleware');
const { authorizeRole } = require('../middlewares/rbac.middleware');
const validate = require('../middlewares/validate.middleware');
const { handleUpload, uploadImages } = require('../middlewares/upload.middleware');
const { createNoticeSchema, updateNoticeSchema, listNoticesQuerySchema } = require('../validators/notice.validator');

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

module.exports = router;
