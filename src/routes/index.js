import express from 'express';
const { Router } = express;
import authRoutes from './auth.routes.js';
import userRoutes from './user.routes.js';
import studentRoutes from './student.routes.js';
import teacherRoutes from './teacher.routes.js';
import classRoutes from './class.routes.js';
import noticeRoutes from './notice.routes.js';
import assignmentRoutes from './assignment.routes.js';
import timetableRoutes from './timetable.routes.js';
import reportCardRoutes from './report-card.routes.js';
import resultRoutes from './result.routes.js';
import notificationRoutes from './notification.routes.js';
import adminRoutes from './admin.routes.js';

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

export default router;
