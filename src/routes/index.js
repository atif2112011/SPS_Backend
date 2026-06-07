const { Router } = require('express');
const authRoutes = require('./auth.routes');
const userRoutes = require('./user.routes');
const studentRoutes = require('./student.routes');
const teacherRoutes = require('./teacher.routes');
const classRoutes = require('./class.routes');
const noticeRoutes = require('./notice.routes');
const assignmentRoutes = require('./assignment.routes');
const timetableRoutes = require('./timetable.routes');
const reportCardRoutes = require('./report-card.routes');
const resultRoutes = require('./result.routes');
const notificationRoutes = require('./notification.routes');
const adminRoutes = require('./admin.routes');

const router = Router();

router.use('/auth', authRoutes);
router.use('/users', userRoutes);
router.use('/students', studentRoutes);
router.use('/teachers', teacherRoutes);
router.use('/classes', classRoutes);
router.use('/notices', noticeRoutes);
router.use('/assignments', assignmentRoutes);
router.use('/timetables', timetableRoutes);
router.use('/report-cards', reportCardRoutes);
router.use('/results', resultRoutes);
router.use('/notifications', notificationRoutes);
router.use('/admin', adminRoutes);

// Future modules:

module.exports = router;
