const { Router } = require('express');
const timetableController = require('../controllers/timetable.controller');
const { authenticate } = require('../middlewares/auth.middleware');
const { authorizeRole } = require('../middlewares/rbac.middleware');
const validate = require('../middlewares/validate.middleware');
const { createTimetableSchema, updateTimetableSchema } = require('../validators/timetable.validator');

const router = Router();

router.use(authenticate);

// GET /timetables/class/:classId — all authenticated (scoped)
// NOTE: must be defined BEFORE /:id to avoid route conflict
router.get('/class/:classId', timetableController.getClassTimetable);

// POST /timetables — admin, teacher (own class)
router.post('/', authorizeRole('admin', 'teacher'), validate(createTimetableSchema), timetableController.createTimetable);

// PATCH /timetables/:id — admin, teacher (own class)
router.patch('/:id', authorizeRole('admin', 'teacher'), validate(updateTimetableSchema), timetableController.updateTimetable);

// DELETE /timetables/:id — admin only
router.delete('/:id', authorizeRole('admin'), timetableController.deleteTimetable);

module.exports = router;
