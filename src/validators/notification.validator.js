import { z } from 'zod';

const objectIdSchema = z.string().regex(/^[a-f\d]{24}$/i, 'Invalid ObjectId');

const registerDeviceSchema = z.object({
  token: z.string().min(10).max(4096).trim(),
  platform: z.literal('android'),
  deviceId: z.string().min(8).max(200).trim().optional(),
  appVersion: z.string().max(50).trim().optional(),
});

const unregisterDeviceSchema = z.object({
  token: z.string().min(10).max(4096).trim().optional(),
  deviceId: z.string().min(8).max(200).trim().optional(),
}).refine((data) => data.token || data.deviceId, { message: 'token or deviceId is required' });

const audienceSchema = z.object({
  audienceType: z.enum(['all_classes', 'specific_classes', 'specific_students']),
  classIds: z.array(objectIdSchema).max(100).optional().default([]),
  studentIds: z.array(objectIdSchema).max(1000).optional().default([]),
}).superRefine((data, ctx) => {
  if (data.audienceType === 'specific_classes' && data.classIds.length === 0) {
    ctx.addIssue({ code: 'custom', path: ['classIds'], message: 'At least one class is required' });
  }
  if (data.audienceType === 'specific_students' && data.studentIds.length === 0) {
    ctx.addIssue({ code: 'custom', path: ['studentIds'], message: 'At least one student is required' });
  }
});

const campaignPreviewSchema = audienceSchema;

const createCampaignSchema = audienceSchema.and(z.object({
  title: z.string().min(1).max(120).trim(),
  body: z.string().min(1).max(500).trim(),
  destination: z.enum(['home', 'notices', 'assignments', 'academics', 'profile']).optional(),
  scheduledAt: z.iso.datetime().optional(),
  idempotencyKey: z.string().min(8).max(200).trim().optional(),
}));

const listCampaignsQuerySchema = z.object({
  page: z.string().regex(/^\d+$/).optional(),
  limit: z.string().regex(/^\d+$/).optional(),
  search: z.string().trim().max(100).optional(),
  status: z.enum(['scheduled', 'queued', 'processing', 'completed', 'partially_failed', 'failed', 'cancelled']).optional(),
  audienceType: z.enum(['all_classes', 'specific_classes', 'specific_students']).optional(),
  sortBy: z.enum(['title', 'status', 'audienceType', 'scheduledAt', 'createdAt']).optional(),
  sortOrder: z.enum(['asc', 'desc']).optional(),
});

const listDeliveriesQuerySchema = z.object({
  page: z.string().regex(/^\d+$/).optional(),
  limit: z.string().regex(/^\d+$/).optional(),
  search: z.string().trim().max(100).optional(),
  status: z.enum(['pending', 'processing', 'retry_scheduled', 'delivered', 'failed', 'invalid_token', 'cancelled']).optional(),
  sortBy: z.enum(['status', 'attemptCount', 'nextAttemptAt', 'createdAt', 'updatedAt']).optional(),
  sortOrder: z.enum(['asc', 'desc']).optional(),
});

const listNotificationsQuerySchema = z.object({
  page: z.string().regex(/^\d+$/).optional(),
  limit: z.string().regex(/^\d+$/).optional(),
  sortBy: z.enum(['title', 'type', 'isRead', 'sentAt', 'createdAt']).optional(),
  sortOrder: z.enum(['asc', 'desc']).optional(),
  search: z.string().trim().max(100).optional(),
  isRead: z.enum(['true', 'false']).optional(),
  type: z.enum(['notice', 'assignment', 'timetable', 'reportCard', 'result', 'reminder']).optional(),
});

const notificationIdParamSchema = z.object({
  id: objectIdSchema,
});

export {
  registerDeviceSchema,
  unregisterDeviceSchema,
  campaignPreviewSchema,
  createCampaignSchema,
  listCampaignsQuerySchema,
  listDeliveriesQuerySchema,
  listNotificationsQuerySchema,
  notificationIdParamSchema,
};
export default {
  registerDeviceSchema,
  unregisterDeviceSchema,
  campaignPreviewSchema,
  createCampaignSchema,
  listCampaignsQuerySchema,
  listDeliveriesQuerySchema,
  listNotificationsQuerySchema,
  notificationIdParamSchema,
};
