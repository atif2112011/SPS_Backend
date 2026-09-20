import { createTimetableSchema } from './src/validators/timetable.validator.js';
import { createReportCardSchema } from './src/validators/reportCard.validator.js';
import { teacherCreateStudentSchema } from './src/validators/teacherPortal.validator.js';
import { createStudentSchema } from './src/validators/user.validator.js';
import { buildStudentCredentials, buildStudentPassword } from './src/utils/studentCredentials.js';
import { changePasswordSchema } from './src/validators/auth.validator.js';
import { listNoticesQuerySchema } from './src/validators/notice.validator.js';
import { parsePagination } from './src/utils/paginationHelper.js';

const objectId = '507f1f77bcf86cd799439011';
const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const validSchedule = days.map((day) => ({
  day,
  periods: Array.from({ length: 8 }, (_, index) => ({
    startTime: `${String(8 + index).padStart(2, '0')}:00`,
    endTime: `${String(8 + index).padStart(2, '0')}:45`,
    subject: `Subject ${index + 1}`,
  })),
}));

const expectValid = (value, label) => { if (!value.success) throw new Error(`${label} should be valid: ${JSON.stringify(value.error.issues)}`); };
const expectInvalid = (value, label) => { if (value.success) throw new Error(`${label} should be rejected`); };

expectValid(createTimetableSchema.safeParse({ classId: objectId, schedule: validSchedule }), 'Complete timetable');
expectInvalid(createTimetableSchema.safeParse({ classId: objectId, schedule: validSchedule.slice(0, 5) }), 'Missing day');

const ninePeriods = structuredClone(validSchedule);
ninePeriods[0].periods.push({ startTime: '16:00', endTime: '16:45', subject: 'Subject 9' });
expectValid(createTimetableSchema.safeParse({ classId: objectId, schedule: ninePeriods }), 'Nine-period day');

const noPeriods = structuredClone(validSchedule);
noPeriods[0].periods = [];
expectInvalid(createTimetableSchema.safeParse({ classId: objectId, schedule: noPeriods }), 'Empty weekday');

const backwards = structuredClone(validSchedule);
backwards[0].periods[0].endTime = '07:45';
expectInvalid(createTimetableSchema.safeParse({ classId: objectId, schedule: backwards }), 'Backwards period');

const overlap = structuredClone(validSchedule);
overlap[0].periods[1].startTime = '08:30';
expectInvalid(createTimetableSchema.safeParse({ classId: objectId, schedule: overlap }), 'Overlapping periods');

const duplicateDay = structuredClone(validSchedule);
duplicateDay[1].day = 'Monday';
expectInvalid(createTimetableSchema.safeParse({ classId: objectId, schedule: duplicateDay }), 'Duplicate day');

expectValid(createReportCardSchema.safeParse({
  studentId: objectId,
  classId: objectId,
  term: 'Term 1',
  academicYear: '2026-27',
  marks: JSON.stringify([{ subject: 'Science', marksObtained: 80, totalMarks: 100 }]),
}), 'Multipart report-card marks');

expectValid(teacherCreateStudentSchema.safeParse({
  name: 'Aarav Sharma',
  admissionNo: 'SPS-1001',
}), 'Teacher student creation without client credentials');
expectInvalid(teacherCreateStudentSchema.safeParse({
  name: 'Aarav Sharma',
  admissionNo: 'SPS-1001',
  username: 'client.supplied',
  password: 'ClientPassword123',
}), 'Client-supplied student credentials');

expectValid(createStudentSchema.safeParse({
  name: 'Aarav Sharma',
  admissionNo: 'SPS-1001',
  classId: objectId,
}), 'Admin student creation with selected class');
expectInvalid(createStudentSchema.safeParse({
  name: 'Aarav Sharma',
  admissionNo: 'SPS-1001',
}), 'Admin student creation without class');
expectInvalid(createStudentSchema.safeParse({
  name: 'Aarav Sharma',
  admissionNo: 'SPS-1001',
  classId: objectId,
  username: 'client.supplied',
  password: 'ClientPassword123',
}), 'Admin client-supplied student credentials');

const generatedCredentials = buildStudentCredentials('Aarav Sharma', '48291', '73014');
if (generatedCredentials.username !== 'aarav.sharma.48291' || generatedCredentials.password !== 'AaravSharma73014') {
  throw new Error(`Generated student credentials have an unexpected shape: ${JSON.stringify(generatedCredentials)}`);
}
if (buildStudentPassword('Aarav Sharma', '84103') !== 'AaravSharma84103') {
  throw new Error('Reset password generation must preserve the existing name-plus-five-digits policy');
}

expectValid(changePasswordSchema.safeParse({ currentPassword: 'Initial123', newPassword: 'New51' }), 'Valid password change');
expectInvalid(changePasswordSchema.safeParse({ currentPassword: 'Initial123', newPassword: 'newpw' }), 'Password without a number');
expectInvalid(changePasswordSchema.safeParse({ currentPassword: 'Initial123', newPassword: 'N1a' }), 'Password shorter than five characters');
expectInvalid(changePasswordSchema.safeParse({ currentPassword: 'Initial123', newPassword: 'Initial123' }), 'Password matching the current password');

const noticeDeadlineSort = listNoticesQuerySchema.safeParse({ sortBy: 'deadline', sortOrder: 'asc' });
expectValid(noticeDeadlineSort, 'Notice list compatibility with assignment deadline sort');
const normalizedNoticePagination = parsePagination(
  noticeDeadlineSort.data,
  ['title', 'audienceType', 'status', 'publishedAt', 'createdAt'],
);
if (normalizedNoticePagination.sortBy !== 'createdAt') {
  throw new Error(`Notice deadline sort should fall back to createdAt, received ${normalizedNoticePagination.sortBy}`);
}

console.log('Release validation passed: timetable, student onboarding, multipart report marks, generated/reset credentials, password-change rules, and notice sort compatibility.');
