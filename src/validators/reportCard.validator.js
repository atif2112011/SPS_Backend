import { z } from 'zod';

const objectIdSchema = z.string().regex(/^[a-f\d]{24}$/i, 'Invalid ObjectId');

const markSchema = z.object({
  subject: z.string().min(1).max(100),
  marksObtained: z.number().min(0),
  totalMarks: z.number().positive(),
  grade: z.string().max(5).optional(),
}).refine((mark) => mark.marksObtained <= mark.totalMarks, {
  message: 'Marks obtained cannot exceed total marks',
  path: ['marksObtained'],
});

const listReportCardsQuerySchema = z.object({
  page: z.string().regex(/^\d+$/).optional(),
  limit: z.string().regex(/^\d+$/).optional(),
  search: z.string().trim().max(100).optional(),
  academicYear: z.string().trim().max(10).optional(),
  term: z.string().trim().max(50).optional(),
  sortBy: z.enum(['term', 'academicYear', 'createdAt']).optional(),
  sortOrder: z.enum(['asc', 'desc']).optional(),
});

const studentIdParamSchema = z.object({ studentId: objectIdSchema });

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

export { createReportCardSchema, updateReportCardSchema, listReportCardsQuerySchema, studentIdParamSchema };
export default { createReportCardSchema, updateReportCardSchema, listReportCardsQuerySchema, studentIdParamSchema };
