import { createTimetableSchema } from './src/validators/timetable.validator.js';
import { createReportCardSchema } from './src/validators/reportCard.validator.js';

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

console.log('Release validation passed: timetable shape/time/overlap rules and multipart report marks.');
