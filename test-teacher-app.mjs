import 'dotenv/config';
import mongoose from 'mongoose';
import app from './src/app.js';
import connectDB from './src/config/db.js';
import User from './src/models/User.model.js';
import TeacherProfile from './src/models/TeacherProfile.model.js';
import StudentProfile from './src/models/StudentProfile.model.js';
import Class from './src/models/Class.model.js';
import { hashPassword } from './src/utils/hashUtils.js';

const runId = new Date().toISOString().replace(/\D/g, '').slice(2, 14);
const password = 'SpsTest@2026';
const prefix = `teacher_e2e_${runId}`;
const results = [];

const check = (condition, message) => {
  if (!condition) throw new Error(message);
};

const record = (name, detail = '') => {
  results.push({ name, detail });
  console.log(`PASS  ${name}${detail ? ` — ${detail}` : ''}`);
};

const createUser = async (role, suffix, name, status = 'active') => User.create({
  role,
  username: `${prefix}_${suffix}`,
  passwordHash: await hashPassword(password),
  status,
  name,
  phone: `9000${runId.slice(-6)}`,
});

let server;
let baseUrl;

const request = async (path, { method = 'GET', token, body } = {}) => {
  const response = await fetch(`${baseUrl}/api/v1${path}`, {
    method,
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
    },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });
  const payload = await response.json().catch(() => ({}));
  return { status: response.status, payload };
};

const expectStatus = async (name, expected, path, options) => {
  const response = await request(path, options);
  check(response.status === expected,
    `${name}: expected HTTP ${expected}, received ${response.status}: ${JSON.stringify(response.payload)}`);
  record(name);
  return response.payload;
};

const login = async (username, expected = 200, accountPassword = password) => {
  const payload = await expectStatus(
    `Login ${username}`,
    expected,
    '/auth/login',
    { method: 'POST', body: { username, password: accountPassword, clientType: 'mobile' } },
  );
  return payload.data;
};

try {
  check(process.env.MONGODB_URI, 'MONGODB_URI is required');
  await connectDB();

  const [admin, sourceTeacher, destinationTeacher, otherTeacher] = await Promise.all([
    createUser('admin', 'admin', 'Teacher E2E Admin'),
    createUser('teacher', 'teacher6', 'Teacher E2E Class 6'),
    createUser('teacher', 'teacher7', 'Teacher E2E Class 7'),
    createUser('teacher', 'teacher8', 'Teacher E2E Class 8'),
  ]);

  const [sourceClass, destinationClass, otherClass] = await Class.create([
    { className: `E2E 6 ${runId}`, section: 'A', progressionOrder: 6, classTeacherId: sourceTeacher._id, academicYear: '2026-27' },
    { className: `E2E 7 ${runId}`, section: 'B', progressionOrder: 7, classTeacherId: destinationTeacher._id, academicYear: '2026-27' },
    { className: `E2E 8 ${runId}`, section: 'C', progressionOrder: 8, classTeacherId: otherTeacher._id, academicYear: '2026-27' },
  ]);

  await TeacherProfile.create([
    { userId: sourceTeacher._id, employeeId: `${prefix}_emp6`, assignedClassId: sourceClass._id, subjects: ['Mathematics'] },
    { userId: destinationTeacher._id, employeeId: `${prefix}_emp7`, assignedClassId: destinationClass._id, subjects: ['Science'] },
    { userId: otherTeacher._id, employeeId: `${prefix}_emp8`, assignedClassId: otherClass._id, subjects: ['English'] },
  ]);

  const [studentA, studentB, outsideStudent] = await Promise.all([
    createUser('student', 'student_a', 'Teacher Test Student A'),
    createUser('student', 'student_b', 'Teacher Test Student B'),
    createUser('student', 'student_outside', 'Teacher Test Outside Student'),
  ]);
  await StudentProfile.create([
    { userId: studentA._id, admissionNo: `${prefix}_adm_a`, rollNo: '601', classId: sourceClass._id, section: 'A', guardianName: 'Test Parent A', guardianPhone: '9000000001', gender: 'female' },
    { userId: studentB._id, admissionNo: `${prefix}_adm_b`, rollNo: '602', classId: sourceClass._id, section: 'A', guardianName: 'Test Parent B', guardianPhone: '9000000002', gender: 'male' },
    { userId: outsideStudent._id, admissionNo: `${prefix}_adm_o`, rollNo: '701', classId: destinationClass._id, section: 'B', guardianName: 'Test Parent C', guardianPhone: '9000000003', gender: 'other' },
  ]);
  await Promise.all([
    Class.findByIdAndUpdate(sourceClass._id, { $addToSet: { studentIds: { $each: [studentA._id, studentB._id] } } }),
    Class.findByIdAndUpdate(destinationClass._id, { $addToSet: { studentIds: outsideStudent._id } }),
  ]);
  record('Created isolated teacher, class, and student fixtures');

  server = await new Promise((resolve) => {
    const instance = app.listen(0, '127.0.0.1', () => resolve(instance));
  });
  baseUrl = `http://127.0.0.1:${server.address().port}`;

  const sourceAuth = await login(sourceTeacher.username);
  const destinationAuth = await login(destinationTeacher.username);
  const adminAuth = await login(admin.username);
  check(sourceAuth.user.role === 'teacher' && sourceAuth.accessToken && sourceAuth.refreshToken,
    'Teacher mobile login response is incomplete');

  const studentLoginPayload = await expectStatus('Shared API authenticates student for role-based clients', 200, '/auth/login', {
    method: 'POST', body: { username: studentA.username, password, clientType: 'mobile' },
  });
  check(studentLoginPayload.data.user.role === 'student', 'Student login returned an incorrect role');

  const me = await expectStatus('Teacher session profile', 200, '/auth/me', { token: sourceAuth.accessToken });
  check(me.data.username === sourceTeacher.username, 'Session returned the wrong teacher');
  const refreshed = await expectStatus('Mobile refresh-token rotation', 200, '/auth/refresh', {
    method: 'POST', body: { refreshToken: sourceAuth.refreshToken, clientType: 'mobile' },
  });
  check(refreshed.data.accessToken && refreshed.data.refreshToken, 'Refresh did not return both mobile tokens');
  const sourceToken = refreshed.data.accessToken;

  const dashboard = await expectStatus('Teacher dashboard', 200, '/teacher/dashboard', { token: sourceToken });
  check(dashboard.data.assignedClass && dashboard.data.metrics, 'Dashboard lacks assigned class or metrics');
  const assignedClass = await expectStatus('Assigned class', 200, '/teacher/class', { token: sourceToken });
  check(assignedClass.data._id === String(sourceClass._id), 'Wrong assigned class returned');

  const roster = await expectStatus('Roster pagination/search/filter/sort', 200,
    '/teacher/class/students?page=1&limit=1&search=Student&status=active&sortBy=rollNo&sortOrder=asc',
    { token: sourceToken });
  check(roster.data.length === 1 && roster.pagination.total >= 2, 'Roster pagination metadata is incorrect');
  const initialStudentDetail = await expectStatus('Student detail in assigned class', 200,
    `/teacher/class/students/${studentA._id}`, { token: sourceToken });
  check(initialStudentDetail.data.summary &&
    ['reportCards', 'results', 'targetedAssignments', 'targetedNotices']
      .every((key) => typeof initialStudentDetail.data.summary[key] === 'number'),
  'Student detail lacks numeric academic/content summary fields');
  check(initialStudentDetail.data.pendingTransfer === null,
    'Student detail should not report a pending transfer before one is created');
  await expectStatus('Deny cross-class student access', 403, `/teacher/class/students/${outsideStudent._id}`, { token: sourceToken });

  const updated = await expectStatus('Edit permitted student details', 200, `/teacher/class/students/${studentA._id}`, {
    method: 'PATCH', token: sourceToken,
    body: { name: 'Teacher Test Student A Updated', dob: '2014-04-10', address: 'Test Address', rollNo: '606', gender: 'female' },
  });
  check(updated.data.user.name.endsWith('Updated') && updated.data.profile.rollNo === '606', 'Student edit was not persisted');
  await expectStatus('Reject immutable class/section edit', 400, `/teacher/class/students/${studentA._id}`, {
    method: 'PATCH', token: sourceToken, body: { section: 'Z' },
  });

  await expectStatus('Block student', 200, `/teacher/class/students/${studentA._id}/block`, { method: 'POST', token: sourceToken });
  await login(studentA.username, 403);
  await expectStatus('Unblock student', 200, `/teacher/class/students/${studentA._id}/unblock`, { method: 'POST', token: sourceToken });
  await login(studentA.username);

  const onboarded = await expectStatus('Onboard student into assigned class', 201, '/teacher/class/students', {
    method: 'POST', token: sourceToken,
    body: {
      name: 'Teacher Test Onboarded Student', admissionNo: `E2ENEW${runId}`,
      rollNo: '603', dob: '2014-07-20', guardianName: 'Onboard Parent', guardianPhone: '9000000004',
      phone: '9000000005', address: 'Onboard Test Address', gender: 'male',
    },
  });
  const onboardedId = onboarded.data.user._id;
  const onboardCredentials = onboarded.data.credentials;
  check(onboardCredentials?.username === onboarded.data.user.username && /^\d{5}$/.test(onboardCredentials.password.slice(-5)),
    'Student creation did not return generated credentials');
  await login(onboardCredentials.username, 200, onboardCredentials.password);

  const removable = await expectStatus('Create removable test student', 201, '/teacher/class/students', {
    method: 'POST', token: sourceToken,
    body: { name: 'Teacher Test Removed Student', admissionNo: `E2ERM${runId}`, rollNo: '604' },
  });
  await expectStatus('Soft-remove student from class', 200, `/teacher/class/students/${removable.data.user._id}`, {
    method: 'DELETE', token: sourceToken,
  });
  const removedUser = await User.findById(removable.data.user._id).lean();
  const removedProfile = await StudentProfile.findOne({ userId: removable.data.user._id }).lean();
  check(removedUser?.status === 'active' && removedProfile?.classId === null,
    'Removal should keep the account active and clear only its class');
  record('Soft removal preserves student account');

  const assignment = await expectStatus('Create class assignment', 201, '/assignments', {
    method: 'POST', token: sourceToken,
    body: { title: `E2E Maths ${runId}`, description: 'Complete exercises 1-5', classIds: [String(sourceClass._id)], deadline: '2027-01-15T10:00:00.000Z' },
  });
  const assignmentId = assignment.data._id;
  const assignmentDetail = await expectStatus('Read normalized assignment recipient metadata', 200, `/assignments/${assignmentId}`, { token: sourceToken });
  check(assignmentDetail.data.creator?._id === String(sourceTeacher._id) && assignmentDetail.data.recipient?.type === 'specific_classes' &&
    assignmentDetail.data.recipient?.classes?.[0]?._id === String(sourceClass._id) && assignmentDetail.data.canManage === true,
  'Assignment detail lacks stable creator, recipient, class, or permission metadata');
  await expectStatus('Reject removal of attachment outside assignment', 404, `/assignments/${assignmentId}/attachments`, {
    method: 'DELETE', token: sourceToken, body: { path: 'assignments/not-attached.pdf' },
  });
  await expectStatus('Create specific-student assignment', 201, '/assignments', {
    method: 'POST', token: sourceToken,
    body: { title: `E2E Focus ${runId}`, description: 'Specific revision task', studentIds: [onboardedId], deadline: '2027-01-16T10:00:00.000Z' },
  });
  await expectStatus('Deny assignment to outside student', 403, '/assignments', {
    method: 'POST', token: sourceToken,
    body: { title: 'Forbidden Assignment', description: 'Must be rejected', studentIds: [String(outsideStudent._id)], deadline: '2027-01-17T10:00:00.000Z' },
  });
  const assignments = await expectStatus('Assignment search/filter/sort/pagination', 200,
    `/assignments?page=1&limit=1&search=E2E&classId=${sourceClass._id}&status=active&sortBy=deadline&sortOrder=asc`,
    { token: sourceToken });
  check(assignments.pagination.total >= 1, 'Assignment filtering returned no rows');
  const assignmentDateFrom = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  const assignmentAudience = await expectStatus('Assignment audience/date/deadline filters', 200,
    `/assignments?page=1&limit=10&audience=class&filter=upcoming&dateFrom=${assignmentDateFrom}&sortBy=title&sortOrder=desc`,
    { token: sourceToken });
  check(assignmentAudience.data.some((item) => item._id === assignmentId), 'Assignment audience or date filtering omitted the class assignment');
  await expectStatus('Update assignment', 200, `/assignments/${assignmentId}`, {
    method: 'PATCH', token: sourceToken, body: { title: `E2E Maths Updated ${runId}` },
  });
  await expectStatus('Delete assignment', 200, `/assignments/${assignmentId}`, { method: 'DELETE', token: sourceToken });

  const notice = await expectStatus('Create class notice', 201, '/notices', {
    method: 'POST', token: sourceToken,
    body: { title: `E2E Notice ${runId}`, message: 'Class notice body', audienceType: 'specific_classes', classIds: [String(sourceClass._id)] },
  });
  const noticeId = notice.data._id;
  const noticeDetail = await expectStatus('Read normalized notice recipient metadata', 200, `/notices/${noticeId}`, { token: sourceToken });
  check(noticeDetail.data.creator?._id === String(sourceTeacher._id) && noticeDetail.data.recipient?.type === 'specific_classes' &&
    noticeDetail.data.recipient?.classes?.[0]?._id === String(sourceClass._id) && noticeDetail.data.canManage === true,
  'Notice detail lacks stable creator, recipient, class, or permission metadata');
  await expectStatus('Student reads populated class-notice detail', 200, `/notices/${noticeId}`, { token: studentLoginPayload.data.accessToken });
  await expectStatus('Reject removal of attachment outside notice', 404, `/notices/${noticeId}/attachments`, {
    method: 'DELETE', token: sourceToken, body: { path: 'notices/not-attached.pdf' },
  });
  await expectStatus('Create specific-student notice', 201, '/notices', {
    method: 'POST', token: sourceToken,
    body: { title: `E2E Personal ${runId}`, message: 'Student-specific notice', audienceType: 'specific_students', studentIds: [onboardedId] },
  });
  await expectStatus('Deny teacher all-classes notice', 403, '/notices', {
    method: 'POST', token: sourceToken,
    body: { title: 'Forbidden Broadcast', message: 'Must be rejected', audienceType: 'all_classes' },
  });
  const notices = await expectStatus('Notice search/filter/sort/pagination', 200,
    `/notices?page=1&limit=1&search=E2E&audienceType=specific_classes&classId=${sourceClass._id}&status=active&sortBy=createdAt&sortOrder=desc`,
    { token: sourceToken });
  check(notices.pagination.total >= 1, 'Notice filtering returned no rows');
  const noticeDateFrom = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  const datedNotices = await expectStatus('Notice published-date filter', 200,
    `/notices?page=1&limit=10&dateFrom=${noticeDateFrom}&audienceType=specific_classes&sortBy=publishedAt&sortOrder=asc`,
    { token: sourceToken });
  check(datedNotices.data.some((item) => item._id === noticeId), 'Notice published-date filtering omitted the class notice');
  await expectStatus('Update notice', 200, `/notices/${noticeId}`, {
    method: 'PATCH', token: sourceToken, body: { title: `E2E Notice Updated ${runId}` },
  });
  await expectStatus('Delete notice', 200, `/notices/${noticeId}`, { method: 'DELETE', token: sourceToken });

  const schedule = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'].map((day) => ({
    day,
    periods: Array.from({ length: 8 }, (_, index) => ({
      startTime: `${String(8 + index).padStart(2, '0')}:00`,
      endTime: `${String(8 + index).padStart(2, '0')}:45`,
      subject: `Subject ${index + 1}`,
      teacherName: sourceTeacher.name,
      room: `R${index + 1}`,
    })),
  }));
  const timetable = await expectStatus('Create timetable with eight periods per day', 201, '/timetables', {
    method: 'POST', token: sourceToken, body: { classId: String(sourceClass._id), schedule },
  });
  const timetableId = timetable.data._id;
  check(timetable.data.schedule.every((day) => day.periods.length === 8), 'Timetable does not contain eight periods per day');
  await expectStatus('Read assigned-class timetable', 200, `/timetables/class/${sourceClass._id}`, { token: sourceToken });
  await expectStatus('Update assigned-class timetable', 200, `/timetables/${timetableId}`, {
    method: 'PATCH', token: sourceToken, body: { schedule: schedule.map((day) => ({ ...day, periods: day.periods.map((period, i) => i === 0 ? { ...period, room: 'Updated Room' } : period) })) },
  });
  await expectStatus('Deny other-class timetable access', 403, `/timetables/class/${destinationClass._id}`, { token: sourceToken });

  const reportCard = await expectStatus('Create student report card', 201, '/report-cards', {
    method: 'POST', token: sourceToken,
    body: { studentId: String(studentA._id), classId: String(sourceClass._id), term: 'Term 1', academicYear: '2026-27', marks: [{ subject: 'Maths', marksObtained: 88, totalMarks: 100, grade: 'A' }], remarks: 'Good work' },
  });
  const reportId = reportCard.data._id;
  const reportDetail = await expectStatus('Read populated report-card detail', 200, `/report-cards/${reportId}`, { token: sourceToken });
  check(reportDetail.data.student?._id === String(studentA._id) && reportDetail.data.originalClass?._id === String(sourceClass._id) &&
    reportDetail.data.canManage === true && reportDetail.data.isHistorical === false,
  'Report-card detail lacks student, original class, or permission metadata');
  const duplicateReport = await expectStatus('Reject case/whitespace report-card duplicate', 409, '/report-cards', {
    method: 'POST', token: sourceToken,
    body: { studentId: String(studentA._id), classId: String(sourceClass._id), term: ' term 1 ', academicYear: '2026-27', marks: [{ subject: 'Maths', marksObtained: 80, totalMarks: 100 }] },
  });
  check(Array.isArray(duplicateReport.details) && duplicateReport.details.some((item) => item.field === 'term'),
    'Duplicate report-card response lacks structured field details');
  await expectStatus('Reject removal of attachment outside report card', 404, `/report-cards/${reportId}/attachments`, {
    method: 'DELETE', token: sourceToken, body: { path: 'report-cards/not-attached.pdf' },
  });
  await expectStatus('Report-card search/filter/sort/pagination', 200,
    `/report-cards/student/${studentA._id}?page=1&limit=1&search=Term&term=Term%201&academicYear=2026-27&sortBy=createdAt&sortOrder=desc`,
    { token: sourceToken });
  await expectStatus('Update report card', 200, `/report-cards/${reportId}`, {
    method: 'PATCH', token: sourceToken, body: { remarks: 'Excellent progress' },
  });
  await expectStatus('Deny outside-student report card', 403, '/report-cards', {
    method: 'POST', token: sourceToken,
    body: { studentId: String(outsideStudent._id), classId: String(destinationClass._id), term: 'Term 1', academicYear: '2026-27' },
  });
  await expectStatus('Delete report card', 200, `/report-cards/${reportId}`, { method: 'DELETE', token: sourceToken });

  const result = await expectStatus('Create student result', 201, '/results', {
    method: 'POST', token: sourceToken,
    body: { studentId: String(studentA._id), classId: String(sourceClass._id), examName: 'Unit Test', academicYear: '2026-27', subjectMarks: [{ subject: 'Science', marksObtained: 42, totalMarks: 50, grade: 'A' }], overallGrade: 'A', rank: 2, remarks: 'Strong result' },
  });
  const resultId = result.data._id;
  const resultDetail = await expectStatus('Read populated result detail', 200, `/results/${resultId}`, { token: sourceToken });
  check(resultDetail.data.student?._id === String(studentA._id) && resultDetail.data.originalClass?._id === String(sourceClass._id) &&
    resultDetail.data.canManage === true && resultDetail.data.isHistorical === false,
  'Result detail lacks student, original class, or permission metadata');
  const duplicateResult = await expectStatus('Reject case/whitespace result duplicate', 409, '/results', {
    method: 'POST', token: sourceToken,
    body: { studentId: String(studentA._id), classId: String(sourceClass._id), examName: ' unit test ', academicYear: '2026-27', subjectMarks: [{ subject: 'Science', marksObtained: 40, totalMarks: 50 }] },
  });
  check(Array.isArray(duplicateResult.details) && duplicateResult.details.some((item) => item.field === 'examName'),
    'Duplicate result response lacks structured field details');
  await expectStatus('Result search/filter/sort/pagination', 200,
    `/results/student/${studentA._id}?page=1&limit=1&search=Unit&examName=Unit%20Test&academicYear=2026-27&sortBy=rank&sortOrder=asc`,
    { token: sourceToken });
  await expectStatus('Update result', 200, `/results/${resultId}`, {
    method: 'PATCH', token: sourceToken, body: { rank: 1, remarks: 'Updated result' },
  });
  await expectStatus('Deny outside-student result', 403, '/results', {
    method: 'POST', token: sourceToken,
    body: { studentId: String(outsideStudent._id), classId: String(destinationClass._id), examName: 'Forbidden', academicYear: '2026-27' },
  });
  await expectStatus('Delete result', 200, `/results/${resultId}`, { method: 'DELETE', token: sourceToken });

  const historicalReport = await expectStatus('Create report card retained through transfer', 201, '/report-cards', {
    method: 'POST', token: sourceToken,
    body: { studentId: String(studentA._id), classId: String(sourceClass._id), term: 'Term 2', academicYear: '2026-27', marks: [{ subject: 'Maths', marksObtained: 91, totalMarks: 100, grade: 'A+' }], remarks: 'Historical source-class report' },
  });
  const historicalResult = await expectStatus('Create result retained through transfer', 201, '/results', {
    method: 'POST', token: sourceToken,
    body: { studentId: String(studentA._id), classId: String(sourceClass._id), examName: 'Annual Examination', academicYear: '2026-27', subjectMarks: [{ subject: 'Science', marksObtained: 46, totalMarks: 50, grade: 'A+' }], overallGrade: 'A+', rank: 1, remarks: 'Historical source-class result' },
  });

  const destinations = await expectStatus('List higher-class transfer destinations', 200,
    '/teacher/class/transfer-destinations', { token: sourceToken });
  check(destinations.data.some((item) => item._id === String(destinationClass._id)) &&
    destinations.data.every((item) => item.progressionOrder > sourceClass.progressionOrder),
  'Transfer destinations must include only higher classes');

  await expectStatus('Block student before transfer', 200, `/teacher/class/students/${studentA._id}/block`, { method: 'POST', token: sourceToken });
  const transfer = await expectStatus('Submit destination-teacher transfer', 201,
    `/teacher/class/students/${studentA._id}/transfer`, {
      method: 'POST', token: sourceToken,
      body: { destinationClassId: String(destinationClass._id), requestNote: 'Ready for promotion' },
    });
  const transferId = transfer.data._id;
  const sent = await expectStatus('Sent transfer table pagination/filter/sort', 200,
    '/teacher/transfer-requests?direction=sent&status=pending&page=1&limit=1&search=Updated&sortBy=createdAt&sortOrder=desc',
    { token: sourceToken });
  check(sent.pagination.total >= 1, 'Sent transfer request was not listed');
  const incoming = await expectStatus('Incoming transfer table for destination teacher', 200,
    '/teacher/transfer-requests?direction=incoming&status=pending&page=1&limit=10',
    { token: destinationAuth.accessToken });
  check(incoming.data.some((item) => item._id === transferId), 'Destination teacher cannot see incoming transfer');
  const pendingTransferDetail = await expectStatus('Read normalized pending transfer detail', 200,
    `/teacher/transfer-requests/${transferId}`, { token: destinationAuth.accessToken });
  check(pendingTransferDetail.data.student?._id === String(studentA._id) &&
    pendingTransferDetail.data.sourceClass?._id === String(sourceClass._id) &&
    pendingTransferDetail.data.destinationClass?._id === String(destinationClass._id) &&
    pendingTransferDetail.data.sourceClass?.teacher?.name === sourceTeacher.name &&
    pendingTransferDetail.data.destinationClass?.teacher?.name === destinationTeacher.name &&
    pendingTransferDetail.data.requester?.name === sourceTeacher.name,
  'Transfer detail lacks normalized student, class, teacher, or requester data');
  check(pendingTransferDetail.data.studentId?._id === String(studentA._id) &&
    pendingTransferDetail.data.sourceClassId?._id === String(sourceClass._id),
  'Transfer detail removed legacy Admin-compatible fields');
  await expectStatus('Deny source teacher self-approval', 403, `/teacher/transfer-requests/${transferId}/approve`, {
    method: 'POST', token: sourceToken, body: { decisionNote: 'Must not approve' },
  });
  await expectStatus('Destination teacher approves transfer', 200, `/teacher/transfer-requests/${transferId}/approve`, {
    method: 'POST', token: destinationAuth.accessToken, body: { decisionNote: 'Approved by destination teacher' },
  });
  const approvedTransferDetail = await expectStatus('Read normalized approved transfer decision', 200,
    `/teacher/transfer-requests/${transferId}`, { token: destinationAuth.accessToken });
  check(approvedTransferDetail.data.status === 'approved' && approvedTransferDetail.data.decidedBy?._id &&
    approvedTransferDetail.data.decidedAt && approvedTransferDetail.data.decisionNote === 'Approved by destination teacher',
  'Approved transfer detail lacks its decision audit fields');
  const transferredProfile = await StudentProfile.findOne({ userId: studentA._id }).lean();
  const transferredUser = await User.findById(studentA._id).lean();
  check(String(transferredProfile.classId) === String(destinationClass._id) && transferredProfile.section === destinationClass.section,
    'Approved transfer did not update class and section');
  check(transferredUser.status === 'blocked', 'Transfer must preserve blocked account status');
  record('Transfer preserves blocked status and historical records');
  await expectStatus('Transferred student leaves source-teacher scope', 403,
    `/teacher/class/students/${studentA._id}`, { token: sourceToken });
  await expectStatus('Transferred student enters destination-teacher scope', 200,
    `/teacher/class/students/${studentA._id}`, { token: destinationAuth.accessToken });
  const historicalReportDetail = await expectStatus('Destination teacher reads historical report card', 200,
    `/report-cards/${historicalReport.data._id}`, { token: destinationAuth.accessToken });
  check(historicalReportDetail.data.isHistorical === true && historicalReportDetail.data.canManage === false &&
    historicalReportDetail.data.originalClass?._id === String(sourceClass._id) && historicalReportDetail.data.currentClass?._id === String(destinationClass._id),
  'Historical report-card context or permission is incorrect after transfer');
  await expectStatus('Destination teacher cannot edit historical report card', 403,
    `/report-cards/${historicalReport.data._id}`, { method: 'PATCH', token: destinationAuth.accessToken, body: { remarks: 'Forbidden edit' } });
  const historicalResultDetail = await expectStatus('Destination teacher reads historical result', 200,
    `/results/${historicalResult.data._id}`, { token: destinationAuth.accessToken });
  check(historicalResultDetail.data.isHistorical === true && historicalResultDetail.data.canManage === false &&
    historicalResultDetail.data.originalClass?._id === String(sourceClass._id) && historicalResultDetail.data.currentClass?._id === String(destinationClass._id),
  'Historical result context or permission is incorrect after transfer');
  await expectStatus('Destination teacher cannot delete historical result', 403,
    `/results/${historicalResult.data._id}`, { method: 'DELETE', token: destinationAuth.accessToken });

  const adminTransfer = await expectStatus('Submit transfer for Admin approval', 201,
    `/teacher/class/students/${studentB._id}/transfer`, {
      method: 'POST', token: sourceToken,
      body: { destinationClassId: String(otherClass._id), requestNote: 'Admin approval path' },
    });
  const adminTransferList = await expectStatus('Admin transfer table pagination/filter/sort', 200,
    `/admin/transfer-requests?status=pending&page=1&limit=1&search=${encodeURIComponent(studentB.name)}&sortBy=studentName&sortOrder=asc`,
    { token: adminAuth.accessToken });
  check(adminTransferList.pagination.total >= 1, 'Admin cannot find pending transfer');
  await expectStatus('Admin approves transfer', 200,
    `/admin/transfer-requests/${adminTransfer.data._id}/approve`, {
      method: 'POST', token: adminAuth.accessToken, body: { decisionNote: 'Approved by Admin' },
    });
  const adminTransferredProfile = await StudentProfile.findOne({ userId: studentB._id }).lean();
  check(String(adminTransferredProfile.classId) === String(otherClass._id), 'Admin approval did not transfer student');

  const finalDashboard = await expectStatus('Dashboard reflects live class totals', 200, '/teacher/dashboard', { token: sourceToken });
  check(typeof finalDashboard.data.metrics.activeStudents === 'number' &&
    typeof finalDashboard.data.metrics.blockedStudents === 'number', 'Dashboard student totals are missing');

  console.log('\nTEACHER_TEST_ACCOUNTS');
  console.log(JSON.stringify({
    password,
    sourceTeacher: { username: sourceTeacher.username, class: sourceClass.className },
    destinationTeacher: { username: destinationTeacher.username, class: destinationClass.className },
    students: [
      { username: studentA.username, name: 'Teacher Test Student A Updated', class: destinationClass.className, status: 'blocked' },
      { username: studentB.username, name: studentB.name, class: otherClass.className, status: 'active' },
      { username: onboarded.data.user.username, name: 'Teacher Test Onboarded Student', class: sourceClass.className, status: 'active' },
      { username: removable.data.user.username, name: 'Teacher Test Removed Student', class: null, status: 'active' },
      { username: outsideStudent.username, name: outsideStudent.name, class: destinationClass.className, status: 'active' },
    ],
    passed: results.length,
  }, null, 2));
} catch (error) {
  console.error(`\nFAIL  ${error.stack || error.message}`);
  process.exitCode = 1;
} finally {
  if (server) await new Promise((resolve) => server.close(resolve));
  await mongoose.disconnect().catch(() => {});
}
