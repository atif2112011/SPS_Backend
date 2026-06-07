import { z } from 'zod';

const objectIdSchema = z.string().regex(/^[a-f\d]{24}$/i, 'Invalid ObjectId');

const createNoticeSchema = z.object({
  title: z.string().min(1).max(200).trim(),
  message: z.string().min(1).max(2000),
  audienceType: z.enum(['all_classes', 'specific_classes', 'specific_students']),
  classIds: z.array(objectIdSchema).optional(),
  studentIds: z.array(objectIdSchema).optional(),
  status: z.enum(['active', 'archived']).optional(),
}).refine((data) => {
  if (data.audienceType === 'specific_classes') return data.classIds && data.classIds.length > 0;
  return true;
}, { message: 'classIds required for specific_classes audience', path: ['classIds'] })
  .refine((data) => {
    if (data.audienceType === 'specific_students') return data.studentIds && data.studentIds.length > 0;
    return true;
  }, { message: 'studentIds required for specific_students audience', path: ['studentIds'] });

const updateNoticeSchema = z.object({
  title: z.string().min(1).max(200).trim().optional(),
  message: z.string().min(1).max(2000).optional(),
  audienceType: z.enum(['all_classes', 'specific_classes', 'specific_students']).optional(),
  classIds: z.array(objectIdSchema).optional(),
  studentIds: z.array(objectIdSchema).optional(),
  status: z.enum(['active', 'archived']).optional(),
});

const listNoticesQuerySchema = z.object({
  page: z.string().optional(),
  limit: z.string().optional(),
  sortBy: z.string().optional(),
  sortOrder: z.enum(['asc', 'desc']).optional(),
  search: z.string().optional(),
  audienceType: z.enum(['all_classes', 'specific_classes', 'specific_students']).optional(),
  classId: objectIdSchema.optional(),
  status: z.enum(['active', 'archived']).optional(),
});

export { createNoticeSchema, updateNoticeSchema, listNoticesQuerySchema };
export default { createNoticeSchema, updateNoticeSchema, listNoticesQuerySchema };
