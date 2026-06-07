const { Router } = require('express');
const reportCardController = require('../controllers/reportCard.controller');
const { authenticate } = require('../middlewares/auth.middleware');
const { authorizeRole } = require('../middlewares/rbac.middleware');
const validate = require('../middlewares/validate.middleware');
const { handleUpload, uploadFiles } = require('../middlewares/upload.middleware');
const { createReportCardSchema, updateReportCardSchema } = require('../validators/reportCard.validator');

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

module.exports = router;
