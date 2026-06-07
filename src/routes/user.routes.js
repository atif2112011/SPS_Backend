const { Router } = require('express');
const userController = require('../controllers/user.controller');
const { authenticate } = require('../middlewares/auth.middleware');
const { authorizeRole } = require('../middlewares/rbac.middleware');
const validate = require('../middlewares/validate.middleware');
const { createStudentSchema, createTeacherSchema } = require('../validators/user.validator');

const router = Router();

router.use(authenticate);
router.use(authorizeRole('admin'));

// POST /users/students
router.post('/students', validate(createStudentSchema), userController.createStudent);

// POST /users/teachers
router.post('/teachers', validate(createTeacherSchema), userController.createTeacher);

module.exports = router;
