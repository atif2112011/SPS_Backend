const { Router } = require('express');
const resultController = require('../controllers/result.controller');
const { authenticate } = require('../middlewares/auth.middleware');
const { authorizeRole } = require('../middlewares/rbac.middleware');
const validate = require('../middlewares/validate.middleware');
const { createResultSchema, updateResultSchema } = require('../validators/result.validator');

const router = Router();

router.use(authenticate);

// GET /results/student/:studentId — admin, teacher, student (own)
router.get('/student/:studentId', resultController.listStudentResults);

// POST /results — admin, teacher
router.post('/', authorizeRole('admin', 'teacher'), validate(createResultSchema), resultController.createResult);

// PATCH /results/:id — admin, teacher (own)
router.patch('/:id', authorizeRole('admin', 'teacher'), validate(updateResultSchema), resultController.updateResult);

// DELETE /results/:id — admin, teacher (own)
router.delete('/:id', authorizeRole('admin', 'teacher'), resultController.deleteResult);

module.exports = router;
