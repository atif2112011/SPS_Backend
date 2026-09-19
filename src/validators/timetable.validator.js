import { z } from 'zod';

const objectIdSchema = z.string().regex(/^[a-f\d]{24}$/i, 'Invalid ObjectId');

const timeRegex = /^([01]\d|2[0-3]):[0-5]\d$/;
const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const toMinutes = (value) => {
  const [hours, minutes] = value.split(':').map(Number);
  return (hours * 60) + minutes;
};

const periodSchema = z.object({
  startTime: z.string().regex(timeRegex, 'Time must be HH:MM format'),
  endTime: z.string().regex(timeRegex, 'Time must be HH:MM format'),
  subject: z.string().min(1).max(100),
  teacherName: z.string().max(100).optional(),
  room: z.string().max(50).optional(),
}).refine((period) => toMinutes(period.endTime) > toMinutes(period.startTime), {
  message: 'End time must be after start time',
  path: ['endTime'],
});

const dayScheduleSchema = z.object({
  day: z.enum(['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']),
  // Eight periods is the usual starting template, but schools can add more.
  periods: z.array(periodSchema).min(1, 'Each day must contain at least one period'),
});

const scheduleSchema = z.array(dayScheduleSchema)
  .length(6, 'Schedule must contain Monday through Saturday')
  .superRefine((schedule, ctx) => {
    const seenDays = new Set();
    schedule.forEach((day, dayIndex) => {
      if (seenDays.has(day.day)) {
        ctx.addIssue({ code: 'custom', message: `${day.day} appears more than once`, path: [dayIndex, 'day'] });
      }
      seenDays.add(day.day);

      const ordered = day.periods
        .map((period, periodIndex) => ({ period, periodIndex }))
        .sort((left, right) => toMinutes(left.period.startTime) - toMinutes(right.period.startTime));
      for (let index = 1; index < ordered.length; index += 1) {
        const previous = ordered[index - 1];
        const current = ordered[index];
        if (toMinutes(current.period.startTime) < toMinutes(previous.period.endTime)) {
          ctx.addIssue({
            code: 'custom',
            message: `Period overlaps another ${day.day} period`,
            path: [dayIndex, 'periods', current.periodIndex, 'startTime'],
          });
        }
      }
    });

    DAYS.forEach((day) => {
      if (!seenDays.has(day)) ctx.addIssue({ code: 'custom', message: `${day} is required`, path: [] });
    });
  });

const createTimetableSchema = z.object({
  classId: objectIdSchema,
  schedule: scheduleSchema,
});

const updateTimetableSchema = z.object({
  schedule: scheduleSchema,
});

export { createTimetableSchema, updateTimetableSchema };
export default { createTimetableSchema, updateTimetableSchema };
