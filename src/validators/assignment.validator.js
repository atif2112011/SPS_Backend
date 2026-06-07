import { z } from 'zod';

const objectIdSchema = z.string().regex(/^[a-f\d]{24}$/i, 'Invalid ObjectId');

const isoDateFuture = z.string()
  .refine((v) => !isNaN(Date.parse(v)), { message: 'Invalid date format' })
  .refine((v) => new Date(v) > new Date(), { message: 'Deadline must be in the future' });

const isoDateAny = z.string()
  .refine((v) => !isNaN(Date.parse(v)), { message: 'Invalid date format' });

const createAssignmentSchema = z.object({
  title: z.string().min(1).max(200).trim(),
  description: z.string().min(1).max(2000),
  classIds: z.array(objectIdSchema).optional(),
  studentIds: z.array(objectIdSchema).optional(),
  deadline: isoDateFuture,
});

const updateAssignmentSchema = z.object({
  title: z.string().min(1).max(200).trim().optional(),
  description: z.string().min(1).max(2000).optional(),
  classIds: z.array(objectIdSchema).optional(),
  studentIds: z.array(objectIdSchema).optional(),
  deadline: isoDateAny.optional(),
  status: z.enum(['active', 'archived']).optional(),
});

const listAssignmentsQuerySchema = z.object({
  page: z.string().optional(),
  limit: z.string().optional(),
  sortBy: z.string().optional(),
  sortOrder: z.enum(['asc', 'desc']).optional(),
  search: z.string().optional(),
  classId: objectIdSchema.optional(),
  filter: z.enum(['upcoming', 'past']).optional(),
  status: z.enum(['active', 'archived']).optional(),
});

export { createAssignmentSchema, updateAssignmentSchema, listAssignmentsQuerySchema };
export default { createAssignmentSchema, updateAssignmentSchema, listAssignmentsQuerySchema };
