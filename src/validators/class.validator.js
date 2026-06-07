import { z } from 'zod';

const objectIdSchema = z.string().regex(/^[a-f\d]{24}$/i, 'Invalid ObjectId');

const createClassSchema = z.object({
  className: z.string().min(1).max(50).trim(),
  section: z.string().min(1).max(10).trim(),
  academicYear: z.string().min(4).max(10).trim(),
  classTeacherId: objectIdSchema.optional(),
});

const updateClassSchema = z.object({
  className: z.string().min(1).max(50).trim().optional(),
  section: z.string().min(1).max(10).trim().optional(),
  academicYear: z.string().min(4).max(10).trim().optional(),
}).refine(data => Object.keys(data).length > 0, { message: 'At least one field required' });

const assignTeacherSchema = z.object({
  teacherId: objectIdSchema,
});

const manageMembersSchema = z.object({
  action: z.enum(['add', 'remove']),
  studentIds: z.array(objectIdSchema).min(1),
});

const listClassQuerySchema = z.object({
  page: z.string().optional(),
  limit: z.string().optional(),
  search: z.string().optional(),
  academicYear: z.string().optional(),
  sortBy: z.string().optional(),
  sortOrder: z.enum(['asc', 'desc']).optional(),
});

export { createClassSchema, updateClassSchema, assignTeacherSchema, manageMembersSchema, listClassQuerySchema };
export default { createClassSchema, updateClassSchema, assignTeacherSchema, manageMembersSchema, listClassQuerySchema };
