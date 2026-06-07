const { Router } = require('express');
const userController = require('../controllers/user.controller');
const { authenticate } = require('../middlewares/auth.middleware');
const { authorizeRole, authorizeOwner } = require('../middlewares/rbac.middleware');
const validate = require('../middlewares/validate.middleware');
const { updateStudentSchema, listUsersQuerySchema } = require('../validators/user.validator');

const router = Router();

// All routes require authentication
router.use(authenticate);

// GET /students — admin + teacher
router.get('/', authorizeRole('admin', 'teacher'), validate(listUsersQuerySchema, 'query'), userController.listStudents);

// GET /students/:id — admin, teacher, student-own
router.get('/:id', authorizeRole('admin', 'teacher', 'student'), authorizeOwner('id'), userController.getUserById);

// PATCH /students/:id — admin only
router.patch('/:id', authorizeRole('admin'), validate(updateStudentSchema), userController.updateStudent);

// DELETE /students/:id — admin only
router.delete('/:id', authorizeRole('admin'), userController.deleteUser);

// Block/unblock — admin only
router.post('/:id/block', authorizeRole('admin'), userController.blockUser);
router.post('/:id/unblock', authorizeRole('admin'), userController.unblockUser);

module.exports = router;
