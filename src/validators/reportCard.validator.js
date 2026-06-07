import { z } from 'zod';

const objectIdSchema = z.string().regex(/^[a-f\d]{24}$/i, 'Invalid ObjectId');

const markSchema = z.object({
  subject: z.string().min(1).max(100),
  marksObtained: z.number().min(0),
  totalMarks: z.number().min(0),
  grade: z.string().max(5).optional(),
});

const createReportCardSchema = z.object({
  studentId: objectIdSchema,
  classId: objectIdSchema,
  term: z.string().min(1).max(50),
  academicYear: z.string().min(4).max(10),
  marks: z.array(markSchema).optional(),
  remarks: z.string().max(1000).optional(),
});

const updateReportCardSchema = z.object({
  term: z.string().min(1).max(50).optional(),
  academicYear: z.string().min(4).max(10).optional(),
  marks: z.array(markSchema).optional(),
  remarks: z.string().max(1000).optional(),
});

export { createReportCardSchema, updateReportCardSchema };
export default { createReportCardSchema, updateReportCardSchema };
