const { z } = require('zod');

const objectIdSchema = z.string().regex(/^[a-f\d]{24}$/i, 'Invalid ObjectId');

const registerDeviceSchema = z.object({
  token: z.string().min(10).max(4096).trim(),
  platform: z.enum(['ios', 'android', 'web']),
});

const listNotificationsQuerySchema = z.object({
  page: z.string().optional(),
  limit: z.string().optional(),
  sortBy: z.string().optional(),
  sortOrder: z.enum(['asc', 'desc']).optional(),
  isRead: z.enum(['true', 'false']).optional(),
  type: z.enum(['notice', 'assignment', 'timetable', 'reportCard', 'result', 'reminder']).optional(),
});

const notificationIdParamSchema = z.object({
  id: objectIdSchema,
});

module.exports = {
  registerDeviceSchema,
  listNotificationsQuerySchema,
  notificationIdParamSchema,
};
