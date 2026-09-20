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

const createNoticeSchema = z.object({
  title: z.string().min(1).max(200).trim(),
  message: z.string().min(1).max(2000),
  audienceType: z.enum(['all_classes', 'specific_classes', 'specific_students']),
  classIds: objectIdArraySchema.optional(),
  studentIds: objectIdArraySchema.optional(),
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
  classIds: objectIdArraySchema.optional(),
  studentIds: objectIdArraySchema.optional(),
  status: z.enum(['active', 'archived']).optional(),
});

const listNoticesQuerySchema = z.object({
  page: z.string().regex(/^\d+$/).optional(),
  limit: z.string().regex(/^\d+$/).optional(),
  // Accept the assignment screen's transient sort value for compatibility.
  // The notice service does not include `deadline` in its allowed sort fields,
  // so pagination falls back to the default `createdAt` ordering.
  sortBy: z.enum(['title', 'audienceType', 'status', 'publishedAt', 'createdAt', 'deadline']).optional(),
  sortOrder: z.enum(['asc', 'desc']).optional(),
  search: z.string().trim().max(100).optional(),
  audienceType: z.enum(['all_classes', 'specific_classes', 'specific_students']).optional(),
  classId: objectIdSchema.optional(),
  status: z.enum(['active', 'archived']).optional(),
  dateFrom: z.string().refine((value) => !Number.isNaN(Date.parse(value)), 'Invalid start date').optional(),
  dateTo: z.string().refine((value) => !Number.isNaN(Date.parse(value)), 'Invalid end date').optional(),
});

const noticeIdParamSchema = z.object({
  id: objectIdSchema,
});
const removeAttachmentSchema = z.object({ path: z.string().trim().min(1).max(500) });

export { createNoticeSchema, updateNoticeSchema, listNoticesQuerySchema, noticeIdParamSchema, removeAttachmentSchema };
export default { createNoticeSchema, updateNoticeSchema, listNoticesQuerySchema, noticeIdParamSchema, removeAttachmentSchema };
