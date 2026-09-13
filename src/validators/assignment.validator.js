import { z } from 'zod';

const objectIdSchema = z.string().regex(/^[a-f\d]{24}$/i, 'Invalid ObjectId');
const objectIdArraySchema = z.preprocess((value) => {
  if (typeof value !== 'string') return value;
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : [value];
  } catch {
    return [value];
  }
}, z.array(objectIdSchema));

const isoDateFuture = z.string()
  .refine((v) => !isNaN(Date.parse(v)), { message: 'Invalid date format' })
  .refine((v) => new Date(v) > new Date(), { message: 'Deadline must be in the future' });

const isoDateAny = z.string()
  .refine((v) => !isNaN(Date.parse(v)), { message: 'Invalid date format' });

const createAssignmentSchema = z.object({
  title: z.string().min(1).max(200).trim(),
  description: z.string().min(1).max(2000),
  classIds: objectIdArraySchema.optional(),
  studentIds: objectIdArraySchema.optional(),
  deadline: isoDateFuture,
});

const updateAssignmentSchema = z.object({
  title: z.string().min(1).max(200).trim().optional(),
  description: z.string().min(1).max(2000).optional(),
  classIds: objectIdArraySchema.optional(),
  studentIds: objectIdArraySchema.optional(),
  deadline: isoDateAny.optional(),
  status: z.enum(['active', 'archived']).optional(),
});

const listAssignmentsQuerySchema = z.object({
  page: z.string().regex(/^\d+$/).optional(),
  limit: z.string().regex(/^\d+$/).optional(),
  sortBy: z.enum(['title', 'deadline', 'status', 'createdAt']).optional(),
  sortOrder: z.enum(['asc', 'desc']).optional(),
  search: z.string().trim().max(100).optional(),
  classId: objectIdSchema.optional(),
  filter: z.enum(['upcoming', 'due_soon', 'past']).optional(),
  audience: z.enum(['class', 'students']).optional(),
  dateFrom: z.string().refine((value) => !Number.isNaN(Date.parse(value)), 'Invalid start date').optional(),
  dateTo: z.string().refine((value) => !Number.isNaN(Date.parse(value)), 'Invalid end date').optional(),
  status: z.enum(['active', 'archived']).optional(),
});

const assignmentIdParamSchema = z.object({ id: objectIdSchema });
const removeAttachmentSchema = z.object({ path: z.string().trim().min(1).max(500) });

export { createAssignmentSchema, updateAssignmentSchema, listAssignmentsQuerySchema, assignmentIdParamSchema, removeAttachmentSchema };
export default { createAssignmentSchema, updateAssignmentSchema, listAssignmentsQuerySchema, assignmentIdParamSchema, removeAttachmentSchema };
