import { z } from 'zod';

const objectIdSchema = z.string().regex(/^[a-f\d]{24}$/i, 'Invalid ObjectId');
const categories = ['academic_assessment', 'achievement', 'other'];
const parseJsonArray = (value) => { if (typeof value !== 'string') return value; try { return JSON.parse(value); } catch { return value; } };
const markSchema = z.object({ subject: z.string().trim().min(1).max(100), marksObtained: z.number().min(0), totalMarks: z.number().positive(), grade: z.string().trim().max(20).optional() }).refine((mark) => mark.marksObtained <= mark.totalMarks, { message: 'Marks obtained cannot exceed total marks', path: ['marksObtained'] });
const optionalString = (max) => z.string().trim().max(max).optional();
const common = {
  title: z.string().trim().min(1).max(200), category: z.enum(categories), eventDate: z.coerce.date(), academicYear: optionalString(10),
  subjectMarks: z.preprocess(parseJsonArray, z.array(markSchema).optional()), overallGrade: optionalString(20), outcome: optionalString(200),
  score: z.coerce.number().min(0).optional(), maxScore: z.coerce.number().positive().optional(), grade: optionalString(20),
  rank: z.coerce.number().int().min(1).optional(), remarks: optionalString(1000),
};
const categoryRules = (value, ctx) => {
  if (value.category === 'academic_assessment' && !value.academicYear) ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['academicYear'], message: 'Academic year is required for academic assessments' });
  if (value.category !== 'academic_assessment' && value.subjectMarks?.length) ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['subjectMarks'], message: 'Subject marks are only available for academic assessments' });
  if (value.score !== undefined && value.maxScore !== undefined && value.score > value.maxScore) ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['score'], message: 'Score cannot exceed maximum score' });
};
const createAssessmentSchema = z.object({ studentId: objectIdSchema, classId: objectIdSchema, ...common }).superRefine(categoryRules);
const updateAssessmentSchema = z.object({ ...Object.fromEntries(Object.entries(common).map(([key, schema]) => [key, schema.optional()])), }).superRefine((value, ctx) => { if (value.category) categoryRules(value, ctx); if (value.score !== undefined && value.maxScore !== undefined && value.score > value.maxScore) ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['score'], message: 'Score cannot exceed maximum score' }); });
const listAssessmentsQuerySchema = z.object({ page: z.string().regex(/^\d+$/).optional(), limit: z.string().regex(/^\d+$/).optional(), search: z.string().trim().max(100).optional(), category: z.enum(categories).optional(), academicYear: z.string().trim().max(10).optional(), sortBy: z.enum(['title', 'category', 'eventDate', 'academicYear', 'rank', 'createdAt']).optional(), sortOrder: z.enum(['asc', 'desc']).optional() });
const studentIdParamSchema = z.object({ studentId: objectIdSchema });
const idParamSchema = z.object({ id: objectIdSchema });
const removeAttachmentSchema = z.object({ path: z.string().trim().min(1).max(500) });
export { createAssessmentSchema, updateAssessmentSchema, listAssessmentsQuerySchema, studentIdParamSchema, idParamSchema, removeAttachmentSchema };
