import dotenv from 'dotenv';
dotenv.config();

import mongoose from 'mongoose';
import User from './src/models/User.model.js';
import Class from './src/models/Class.model.js';
import ReportCard from './src/models/ReportCard.model.js';
import Result from './src/models/Result.model.js';
import { signAccessToken } from './src/utils/tokenUtils.js';
import { createReportCardSchema } from './src/validators/reportCard.validator.js';
import { createResultSchema } from './src/validators/result.validator.js';

const checks = [];
const check = (label, passed, detail = '') => checks.push({ label, passed: Boolean(passed), detail });

await mongoose.connect(process.env.MONGODB_URI);
const [{ default: app }, admin, student] = await Promise.all([
  import('./src/app.js'),
  User.findOne({ role: 'admin', status: 'active' }),
  User.findOne({ role: 'student', status: 'active' }),
]);

if (!admin || !student) throw new Error('Phase 8 validation requires one active admin and student');
await Promise.all([Class.init(), ReportCard.init(), Result.init()]);
const adminToken = signAccessToken({ userId: admin._id, role: admin.role, tokenVersion: admin.refreshTokenVersion });
const studentToken = signAccessToken({ userId: student._id, role: student.role, tokenVersion: student.refreshTokenVersion });
const server = await new Promise((resolve) => {
  const instance = app.listen(0, '127.0.0.1', () => resolve(instance));
});

async function call(path, token) {
  const response = await fetch(`http://127.0.0.1:${server.address().port}/api/v1${path}`, { headers: { Authorization: `Bearer ${token}` } });
  const payload = await response.json();
  return { response, payload };
}

try {
  const cases = [
    ['/students?page=1&limit=5&search=%5B&status=active&sortBy=name&sortOrder=asc', adminToken, 'students'],
    ['/classes?page=1&limit=5&search=%5B&sortBy=academicYear&sortOrder=desc', adminToken, 'classes'],
    ['/notices?page=1&limit=5&search=%5B&status=active&sortBy=title&sortOrder=asc', studentToken, 'notices'],
    ['/assignments?page=1&limit=5&search=%5B&filter=upcoming&sortBy=deadline&sortOrder=asc', studentToken, 'assignments'],
    ['/notifications?page=1&limit=5&search=%5B&isRead=false&sortBy=createdAt&sortOrder=desc', studentToken, 'notifications'],
    ['/admin/activity-logs?page=1&limit=5&search=%5B&actorRole=admin&sortBy=createdAt&sortOrder=desc', adminToken, 'activity logs'],
    [`/report-cards/student/${student._id}?page=1&limit=5&search=%5B&sortBy=academicYear&sortOrder=desc`, studentToken, 'report cards'],
    [`/results/student/${student._id}?page=1&limit=5&search=%5B&sortBy=examName&sortOrder=asc`, studentToken, 'results'],
  ];

  for (const [path, token, label] of cases) {
    const { response, payload } = await call(path, token);
    check(`${label} supports safe search/filter/sort/pagination`, response.ok && payload.success && payload.pagination?.page === 1 && payload.pagination?.limit === 5, payload.message);
  }

  const invalidSort = await call('/students?sortBy=passwordHash', adminToken);
  check('unsupported sort fields are rejected', invalidSort.response.status === 400 && invalidSort.payload.errorCode === 'VALIDATION_ERROR', invalidSort.payload.message);

  const invalidReport = createReportCardSchema.safeParse({ studentId: String(student._id), classId: String(new mongoose.Types.ObjectId()), term: 'Term 1', academicYear: '2026-27', marks: [{ subject: 'Math', marksObtained: 101, totalMarks: 100 }] });
  const invalidResult = createResultSchema.safeParse({ studentId: String(student._id), classId: String(new mongoose.Types.ObjectId()), examName: 'Final', academicYear: '2026-27', subjectMarks: [{ subject: 'Math', marksObtained: 1, totalMarks: 0 }] });
  check('report-card marks enforce obtained <= total', !invalidReport.success);
  check('result marks require a positive total', !invalidResult.success);

  const hasUnique = (model, fields) => model.schema.indexes().some(([keys, options]) => options.unique && fields.every((field) => keys[field] === 1));
  check('class identity has a unique active-record index', hasUnique(Class, ['className', 'section', 'academicYear']));
  check('report-card identity has a unique active-record index', hasUnique(ReportCard, ['studentId', 'classId', 'term', 'academicYear']));
  check('result identity has a unique active-record index', hasUnique(Result, ['studentId', 'classId', 'examName', 'academicYear']));
} finally {
  await new Promise((resolve) => server.close(resolve));
  await mongoose.disconnect();
}

for (const item of checks) console.log(`${item.passed ? 'PASS' : 'FAIL'} ${item.label}${item.detail ? ` — ${item.detail}` : ''}`);
const failures = checks.filter((item) => !item.passed);
console.log(`\n${checks.length - failures.length}/${checks.length} passed`);
if (failures.length) process.exit(1);
