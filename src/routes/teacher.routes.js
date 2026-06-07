const { Router } = require('express');
const userController = require('../controllers/user.controller');
const { authenticate } = require('../middlewares/auth.middleware');
const { authorizeRole } = require('../middlewares/rbac.middleware');
const validate = require('../middlewares/validate.middleware');
const { updateTeacherSchema, listUsersQuerySchema } = require('../validators/user.validator');

const router = Router();

router.use(authenticate);

// GET /teachers — admin only
router.get('/', authorizeRole('admin'), validate(listUsersQuerySchema, 'query'), userController.listTeachers);

// GET /teachers/:id — admin only
router.get('/:id', authorizeRole('admin'), userController.getUserById);

// PATCH /teachers/:id — admin only
router.patch('/:id', authorizeRole('admin'), validate(updateTeacherSchema), userController.updateTeacher);

// Block/unblock — admin only
router.post('/:id/block', authorizeRole('admin'), userController.blockUser);
router.post('/:id/unblock', authorizeRole('admin'), userController.unblockUser);

module.exports = router;
