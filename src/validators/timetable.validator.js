import { z } from 'zod';

const objectIdSchema = z.string().regex(/^[a-f\d]{24}$/i, 'Invalid ObjectId');

const timeRegex = /^([01]\d|2[0-3]):[0-5]\d$/;

const periodSchema = z.object({
  startTime: z.string().regex(timeRegex, 'Time must be HH:MM format'),
  endTime: z.string().regex(timeRegex, 'Time must be HH:MM format'),
  subject: z.string().min(1).max(100),
  teacherName: z.string().max(100).optional(),
  room: z.string().max(50).optional(),
});

const dayScheduleSchema = z.object({
  day: z.enum(['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']),
  periods: z.array(periodSchema).min(1),
});

const createTimetableSchema = z.object({
  classId: objectIdSchema,
  schedule: z.array(dayScheduleSchema).min(1),
});

const updateTimetableSchema = z.object({
  schedule: z.array(dayScheduleSchema).min(1),
});

export { createTimetableSchema, updateTimetableSchema };
export default { createTimetableSchema, updateTimetableSchema };
