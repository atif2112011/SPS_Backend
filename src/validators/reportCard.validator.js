import { z } from 'zod';

const objectIdSchema = z.string().regex(/^[a-f\d]{24}$/i, 'Invalid ObjectId');
const parseJsonArray = (value) => {
  if (typeof value !== 'string') return value;
  try { return JSON.parse(value); } catch { return value; }
};

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
const idParamSchema = z.object({ id: objectIdSchema });
const removeAttachmentSchema = z.object({ path: z.string().trim().min(1).max(500) });

const createReportCardSchema = z.object({
  studentId: objectIdSchema,
  classId: objectIdSchema,
  term: z.string().trim().min(1).max(50),
  academicYear: z.string().trim().min(4).max(10),
  marks: z.preprocess(parseJsonArray, z.array(markSchema)).optional(),
  remarks: z.string().max(1000).optional(),
});

const updateReportCardSchema = z.object({
  term: z.string().trim().min(1).max(50).optional(),
  academicYear: z.string().trim().min(4).max(10).optional(),
  marks: z.preprocess(parseJsonArray, z.array(markSchema)).optional(),
  remarks: z.string().max(1000).optional(),
});

export { createReportCardSchema, updateReportCardSchema, listReportCardsQuerySchema, studentIdParamSchema, idParamSchema, removeAttachmentSchema };
export default { createReportCardSchema, updateReportCardSchema, listReportCardsQuerySchema, studentIdParamSchema, idParamSchema, removeAttachmentSchema };
