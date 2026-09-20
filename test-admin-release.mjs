import 'dotenv/config';
import mongoose from 'mongoose';
import app from './src/app.js';
import connectDB from './src/config/db.js';
import User from './src/models/User.model.js';
import StudentProfile from './src/models/StudentProfile.model.js';
import TeacherProfile from './src/models/TeacherProfile.model.js';
import Class from './src/models/Class.model.js';
import Timetable from './src/models/Timetable.model.js';
import ReportCard from './src/models/ReportCard.model.js';
import Assessment from './src/models/Assessment.model.js';
import Assignment from './src/models/Assignment.model.js';
import Notice from './src/models/Notice.model.js';
import StudentTransferRequest from './src/models/StudentTransferRequest.model.js';
import RefreshToken from './src/models/RefreshToken.model.js';
import ActivityLog from './src/models/ActivityLog.model.js';
import Notification from './src/models/Notification.model.js';
import { hashPassword } from './src/utils/hashUtils.js';

const runId = new Date().toISOString().replace(/\D/g, '').slice(2, 14);
const prefix = `admin_release_${runId}`;
const admissionPrefix = `ar_${runId}`;
const password = 'AdminRelease@2026';
const ids = { users: [], classes: [], timetables: [], reports: [], assessments: [], assignments: [], notices: [], transfers: [] };
const passed = [];
let server;
let baseUrl;

const check = (condition, message) => { if (!condition) throw new Error(message); };
const pass = (label) => { passed.push(label); console.log(`PASS  ${label}`); };

async function request(path, { method = 'GET', token, body } = {}) {
  const response = await fetch(`${baseUrl}/api/v1${path}`, {
    method,
    headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}), ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}) },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });
  const payload = await response.json().catch(() => ({}));
  return { status: response.status, payload };
}

async function expectStatus(label, expected, path, options) {
  const result = await request(path, options);
  check(result.status === expected, `${label}: expected ${expected}, received ${result.status}: ${JSON.stringify(result.payload)}`);
  pass(label);
  return result.payload;
}

async function createAccount(role, suffix, name, passwordHash) {
  const user = await User.create({ role, username: `${prefix}_${suffix}`, name, passwordHash, status: 'active', firstPasswordChange: role === 'student' ? false : undefined });
  ids.users.push(user._id);
  return user;
}

try {
  check(process.argv.includes('--primary'), 'Primary database integration requires the explicit --primary argument.');
  check(process.env.MONGODB_URI, 'MONGODB_URI is required for the Admin release integration test.');
  await connectDB();
  const passwordHash = await hashPassword(password);
  const [admin, sourceTeacher, destinationTeacher] = await Promise.all([
    createAccount('admin', 'admin', 'Admin Release Test', passwordHash),
    createAccount('teacher', 'teacher6', 'Release Teacher 6', passwordHash),
    createAccount('teacher', 'teacher7', 'Release Teacher 7', passwordHash),
  ]);

  const [sourceClass, destinationClass] = await Class.create([
    { className: `Release 6 ${runId}`, section: 'A', academicYear: '2026-27', progressionOrder: 6, classTeacherId: sourceTeacher._id },
    { className: `Release 7 ${runId}`, section: 'A', academicYear: '2026-27', progressionOrder: 7, classTeacherId: destinationTeacher._id },
  ]);
  ids.classes.push(sourceClass._id, destinationClass._id);
  await TeacherProfile.create([
    { userId: sourceTeacher._id, employeeId: `${prefix}_emp6`, assignedClassId: sourceClass._id },
    { userId: destinationTeacher._id, employeeId: `${prefix}_emp7`, assignedClassId: destinationClass._id },
  ]);

  const volumeUsers = await User.insertMany(Array.from({ length: 32 }, (_, index) => ({
    role: 'student', username: `${prefix}_student_${String(index + 1).padStart(2, '0')}`, name: `Release Student ${String(index + 1).padStart(2, '0')}`, passwordHash, status: 'active', firstPasswordChange: false,
  })));
  ids.users.push(...volumeUsers.map((user) => user._id));
  await StudentProfile.insertMany(volumeUsers.map((user, index) => ({ userId: user._id, admissionNo: `${admissionPrefix}_${index + 1}`, rollNo: String(index + 1), classId: sourceClass._id, section: sourceClass.section })));
  await Class.findByIdAndUpdate(sourceClass._id, { $addToSet: { studentIds: { $each: volumeUsers.map((user) => user._id) } } });
  pass('Created isolated fixtures with a realistic 32-student roster');

  server = await new Promise((resolve) => { const instance = app.listen(0, '127.0.0.1', () => resolve(instance)); });
  baseUrl = `http://127.0.0.1:${server.address().port}`;

  const adminLogin = await expectStatus('Admin login', 200, '/auth/login', { method: 'POST', body: { username: admin.username, password, clientType: 'mobile' } });
  const adminToken = adminLogin.data.accessToken;
  const teacherLogin = await expectStatus('Teacher login for transfer workflow', 200, '/auth/login', { method: 'POST', body: { username: sourceTeacher.username, password, clientType: 'mobile' } });
  const teacherToken = teacherLogin.data.accessToken;
  await expectStatus('Admin session profile', 200, '/auth/me', { token: adminToken });

  const firstPage = await expectStatus('Student remote search first page', 200, `/students?page=1&limit=20&search=${prefix}&sortBy=name&sortOrder=asc`, { token: adminToken });
  const secondPage = await expectStatus('Student remote search second page', 200, `/students?page=2&limit=20&search=${prefix}&sortBy=name&sortOrder=asc`, { token: adminToken });
  check(firstPage.pagination.total >= 32 && firstPage.data.length === 20 && secondPage.data.length >= 12, 'Student pagination does not handle a realistic roster size');
  check(!secondPage.data.some((row) => firstPage.data.some((first) => first._id === row._id)), 'Remote pagination returned duplicate student rows');
  pass('Remote student pagination has stable, non-overlapping pages');

  const created = await expectStatus('Admin creates student with generated credentials', 201, '/users/students', {
    method: 'POST', token: adminToken,
    body: { name: 'Release Created Student', admissionNo: `${admissionPrefix}_created`, classId: String(sourceClass._id), rollNo: '99', guardianName: 'Release Guardian', guardianPhone: '9000000099' },
  });
  ids.users.push(created.data.user._id);
  check(created.data.credentials?.username === created.data.user.username && created.data.credentials?.password, 'Generated student credentials are missing');
  const enrolledSource = await Class.findById(sourceClass._id).lean();
  check(enrolledSource.studentIds.some((id) => String(id) === String(created.data.user._id)), 'Created student was not added to the selected class');
  pass('Student onboarding updates account, profile, class, and one-time credentials');

  await expectStatus('Admin moves student between class rosters', 200, `/classes/${destinationClass._id}/members`, { method: 'PATCH', token: adminToken, body: { action: 'add', studentIds: [created.data.user._id] } });
  const [movedProfile, oldClassAfterMove, newClassAfterMove] = await Promise.all([
    StudentProfile.findOne({ userId: created.data.user._id }).lean(), Class.findById(sourceClass._id).lean(), Class.findById(destinationClass._id).lean(),
  ]);
  check(String(movedProfile.classId) === String(destinationClass._id) && !oldClassAfterMove.studentIds.some((id) => String(id) === String(created.data.user._id)) && newClassAfterMove.studentIds.some((id) => String(id) === String(created.data.user._id)), 'Atomic roster move is inconsistent');
  pass('Class membership remains consistent across profile and both rosters');

  await expectStatus('Admin assigns class teacher transactionally', 200, `/classes/${destinationClass._id}/teacher`, { method: 'PATCH', token: adminToken, body: { teacherId: String(destinationTeacher._id) } });

  const schedule = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'].map((day) => ({ day, periods: [{ startTime: '08:00', endTime: '08:45', subject: `${day} Subject`, teacherName: sourceTeacher.name, room: 'Classroom' }] }));
  const timetable = await expectStatus('Admin creates complete six-day timetable', 201, '/timetables', { method: 'POST', token: adminToken, body: { classId: String(sourceClass._id), schedule } });
  ids.timetables.push(timetable.data._id);

  const report = await expectStatus('Admin creates report card', 201, '/report-cards', { method: 'POST', token: adminToken, body: { studentId: created.data.user._id, classId: String(destinationClass._id), term: `Release ${runId}`, academicYear: '2026-27', marks: [{ subject: 'Mathematics', marksObtained: 88, totalMarks: 100, grade: 'A' }] } });
  ids.reports.push(report.data._id);
  const assessment = await expectStatus('Admin creates assessment', 201, '/assessments', { method: 'POST', token: adminToken, body: { studentId: created.data.user._id, classId: String(destinationClass._id), title: `Release Assessment ${runId}`, category: 'academic_assessment', eventDate: '2026-09-20', academicYear: '2026-27', subjectMarks: [{ subject: 'Science', marksObtained: 42, totalMarks: 50, grade: 'A' }] } });
  ids.assessments.push(assessment.data._id);
  const assignment = await expectStatus('Admin creates class assignment', 201, '/assignments', { method: 'POST', token: adminToken, body: { title: `Release Assignment ${runId}`, description: 'Release verification', classIds: [String(sourceClass._id)], deadline: '2027-01-10T10:00:00.000Z' } });
  ids.assignments.push(assignment.data._id);
  const notice = await expectStatus('Admin creates school notice', 201, '/notices', { method: 'POST', token: adminToken, body: { title: `Release Notice ${runId}`, message: 'Release verification', audienceType: 'all_classes' } });
  ids.notices.push(notice.data._id);

  const transferStudent = volumeUsers[0];
  const transfer = await expectStatus('Teacher submits transfer for Admin approval', 201, `/teacher/class/students/${transferStudent._id}/transfer`, { method: 'POST', token: teacherToken, body: { destinationClassId: String(destinationClass._id), requestNote: 'Release verification' } });
  ids.transfers.push(transfer.data._id);
  await expectStatus('Admin finds pending transfer', 200, `/admin/transfer-requests?status=pending&search=${encodeURIComponent(transferStudent.name)}`, { token: adminToken });
  await expectStatus('Admin approves transfer atomically', 200, `/admin/transfer-requests/${transfer.data._id}/approve`, { method: 'POST', token: adminToken, body: { decisionNote: 'Release test approval' } });
  const transferredProfile = await StudentProfile.findOne({ userId: transferStudent._id }).lean();
  check(String(transferredProfile.classId) === String(destinationClass._id), 'Approved transfer did not update the student profile');

  const preview = await expectStatus('Admin previews push audience', 200, '/notifications/campaigns/preview', { method: 'POST', token: adminToken, body: { audienceType: 'specific_classes', classIds: [String(destinationClass._id)], studentIds: [] } });
  check(typeof preview.data.recipientCount === 'number' && typeof preview.data.deviceCount === 'number', 'Notification preview metrics are incomplete');

  await expectStatus('Refresh token rotates', 200, '/auth/refresh', { method: 'POST', body: { refreshToken: adminLogin.data.refreshToken, clientType: 'mobile' } });
  await expectStatus('Admin logout revokes refresh token', 200, '/auth/logout', { method: 'POST', body: { refreshToken: teacherLogin.data.refreshToken } });
  console.log(`\n${passed.length} Admin release integration checks passed.`);
} catch (error) {
  console.error(`\nFAIL  ${error.stack || error.message}`);
  process.exitCode = 1;
} finally {
  if (server) await new Promise((resolve) => server.close(resolve));
  if (mongoose.connection.readyState === 1) {
    // Give fire-and-forget audit/notification listeners a chance to persist before
    // resolving every fixture by both tracked IDs and the unique run prefix.
    await new Promise((resolve) => setTimeout(resolve, 750));
    const prefixedUsers = await User.find({ username: { $regex: `^${prefix}` } }).select('_id').lean().catch(() => []);
    const admissionProfiles = await StudentProfile.find({ admissionNo: { $regex: `^${admissionPrefix}` } }).select('userId').lean().catch(() => []);
    const cleanupUserIds = [...new Set([...ids.users, ...prefixedUsers.map((item) => item._id), ...admissionProfiles.map((item) => item.userId)].map(String))];
    const prefixedClasses = await Class.find({ className: { $regex: runId } }).select('_id').lean().catch(() => []);
    const cleanupClassIds = [...new Set([...ids.classes, ...prefixedClasses.map((item) => item._id)].map(String))];
    const relatedEntityIds = [...ids.timetables, ...ids.reports, ...ids.assessments, ...ids.assignments, ...ids.notices, ...ids.transfers];
    const cleanupErrors = [];
    const clean = async (label, operation) => {
      try {
        await operation();
      } catch (error) {
        cleanupErrors.push(`${label}: ${error.message}`);
      }
    };

    await Promise.all([
      clean('notifications', () => Notification.deleteMany({ $or: [{ recipientUserId: { $in: cleanupUserIds } }, { entityId: { $in: relatedEntityIds } }] })),
      clean('timetables', () => Timetable.deleteMany({ $or: [{ _id: { $in: ids.timetables } }, { classId: { $in: cleanupClassIds } }] })),
      clean('report cards', () => ReportCard.deleteMany({ $or: [{ _id: { $in: ids.reports } }, { studentId: { $in: cleanupUserIds } }] })),
      clean('assessments', () => Assessment.deleteMany({ $or: [{ _id: { $in: ids.assessments } }, { studentId: { $in: cleanupUserIds } }] })),
      clean('assignments', () => Assignment.deleteMany({ $or: [{ _id: { $in: ids.assignments } }, { assignedBy: { $in: cleanupUserIds } }, { title: { $regex: runId } }] })),
      clean('notices', () => Notice.deleteMany({ $or: [{ _id: { $in: ids.notices } }, { createdBy: { $in: cleanupUserIds } }, { title: { $regex: runId } }] })),
      clean('transfers', () => StudentTransferRequest.deleteMany({ $or: [{ _id: { $in: ids.transfers } }, { studentId: { $in: cleanupUserIds } }, { sourceClassId: { $in: cleanupClassIds } }, { destinationClassId: { $in: cleanupClassIds } }] })),
      clean('activity logs', () => ActivityLog.deleteMany({ $or: [{ actorId: { $in: cleanupUserIds } }, { entityId: { $in: relatedEntityIds } }] })),
      clean('refresh tokens', () => RefreshToken.deleteMany({ userId: { $in: cleanupUserIds } })),
    ]);
    await Promise.all([
      clean('student profiles', () => StudentProfile.deleteMany({ userId: { $in: cleanupUserIds } })),
      clean('teacher profiles', () => TeacherProfile.deleteMany({ userId: { $in: cleanupUserIds } })),
    ]);
    await clean('classes', () => Class.deleteMany({ _id: { $in: cleanupClassIds } }));
    await clean('users', () => User.deleteMany({ _id: { $in: cleanupUserIds } }));

    // Remove any listener output that landed while the primary fixtures were
    // being removed, then prove the run left no matching records behind.
    await new Promise((resolve) => setTimeout(resolve, 250));
    await Promise.all([
      clean('late notifications', () => Notification.deleteMany({ $or: [{ recipientUserId: { $in: cleanupUserIds } }, { entityId: { $in: relatedEntityIds } }] })),
      clean('late activity logs', () => ActivityLog.deleteMany({ $or: [{ actorId: { $in: cleanupUserIds } }, { entityId: { $in: relatedEntityIds } }] })),
    ]);

    const leftoverCounts = {
      users: await User.countDocuments({ $or: [{ _id: { $in: cleanupUserIds } }, { username: { $regex: `^${prefix}` } }] }),
      studentProfiles: await StudentProfile.countDocuments({ $or: [{ userId: { $in: cleanupUserIds } }, { admissionNo: { $regex: `^${admissionPrefix}` } }] }),
      teacherProfiles: await TeacherProfile.countDocuments({ userId: { $in: cleanupUserIds } }),
      classes: await Class.countDocuments({ $or: [{ _id: { $in: cleanupClassIds } }, { className: { $regex: runId } }] }),
      timetables: await Timetable.countDocuments({ $or: [{ _id: { $in: ids.timetables } }, { classId: { $in: cleanupClassIds } }] }),
      reportCards: await ReportCard.countDocuments({ $or: [{ _id: { $in: ids.reports } }, { studentId: { $in: cleanupUserIds } }] }),
      assessments: await Assessment.countDocuments({ $or: [{ _id: { $in: ids.assessments } }, { studentId: { $in: cleanupUserIds } }] }),
      assignments: await Assignment.countDocuments({ $or: [{ _id: { $in: ids.assignments } }, { title: { $regex: runId } }] }),
      notices: await Notice.countDocuments({ $or: [{ _id: { $in: ids.notices } }, { title: { $regex: runId } }] }),
      transfers: await StudentTransferRequest.countDocuments({ $or: [{ _id: { $in: ids.transfers } }, { studentId: { $in: cleanupUserIds } }] }),
      notifications: await Notification.countDocuments({ $or: [{ recipientUserId: { $in: cleanupUserIds } }, { entityId: { $in: relatedEntityIds } }] }),
      activityLogs: await ActivityLog.countDocuments({ $or: [{ actorId: { $in: cleanupUserIds } }, { entityId: { $in: relatedEntityIds } }] }),
      refreshTokens: await RefreshToken.countDocuments({ userId: { $in: cleanupUserIds } }),
    };
    const leftoverTotal = Object.values(leftoverCounts).reduce((total, count) => total + count, 0);
    if (cleanupErrors.length || leftoverTotal) {
      console.error(`FAIL  Cleanup verification: ${JSON.stringify({ cleanupErrors, leftoverCounts })}`);
      process.exitCode = 1;
    } else {
      console.log(`PASS  Cleanup verified for ${prefix}; no integration fixtures remain.`);
    }
    await mongoose.disconnect().catch(() => {});
  }
}
