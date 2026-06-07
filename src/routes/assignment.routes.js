const { Router } = require('express');
const assignmentController = require('../controllers/assignment.controller');
const { authenticate } = require('../middlewares/auth.middleware');
const { authorizeRole } = require('../middlewares/rbac.middleware');
const validate = require('../middlewares/validate.middleware');
const { handleUpload, uploadImages } = require('../middlewares/upload.middleware');
const { createAssignmentSchema, updateAssignmentSchema, listAssignmentsQuerySchema } = require('../validators/assignment.validator');

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

module.exports = router;
