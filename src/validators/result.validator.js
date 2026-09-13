import { z } from 'zod';

const objectIdSchema = z.string().regex(/^[a-f\d]{24}$/i, 'Invalid ObjectId');

const subjectMarkSchema = z.object({
  subject: z.string().min(1).max(100),
  marksObtained: z.number().min(0),
  totalMarks: z.number().positive(),
  grade: z.string().max(5).optional(),
}).refine((mark) => mark.marksObtained <= mark.totalMarks, {
  message: 'Marks obtained cannot exceed total marks',
  path: ['marksObtained'],
});

const listResultsQuerySchema = z.object({
  page: z.string().regex(/^\d+$/).optional(),
  limit: z.string().regex(/^\d+$/).optional(),
  search: z.string().trim().max(100).optional(),
  academicYear: z.string().trim().max(10).optional(),
  examName: z.string().trim().max(200).optional(),
  sortBy: z.enum(['examName', 'academicYear', 'rank', 'createdAt']).optional(),
  sortOrder: z.enum(['asc', 'desc']).optional(),
});

const studentIdParamSchema = z.object({ studentId: objectIdSchema });
const idParamSchema = z.object({ id: objectIdSchema });

const createResultSchema = z.object({
  studentId: objectIdSchema,
  classId: objectIdSchema,
  examName: z.string().trim().min(1).max(200),
  academicYear: z.string().trim().min(4).max(10),
  subjectMarks: z.array(subjectMarkSchema).optional(),
  overallGrade: z.string().max(5).optional(),
  rank: z.number().int().min(1).optional(),
  remarks: z.string().max(1000).optional(),
});

const updateResultSchema = z.object({
  examName: z.string().trim().min(1).max(200).optional(),
  academicYear: z.string().trim().min(4).max(10).optional(),
  subjectMarks: z.array(subjectMarkSchema).optional(),
  overallGrade: z.string().max(5).optional(),
  rank: z.number().int().min(1).optional(),
  remarks: z.string().max(1000).optional(),
});

export { createResultSchema, updateResultSchema, listResultsQuerySchema, studentIdParamSchema, idParamSchema };
export default { createResultSchema, updateResultSchema, listResultsQuerySchema, studentIdParamSchema, idParamSchema };
