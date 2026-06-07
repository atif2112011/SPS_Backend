const { z } = require('zod');

const activityLogsQuerySchema = z.object({
  page: z.string().optional(),
  limit: z.string().optional(),
  sortBy: z.string().optional(),
  sortOrder: z.enum(['asc', 'desc']).optional(),
  actorRole: z.enum(['admin', 'teacher', 'student']).optional(),
  actionType: z.string().optional(),
  entityType: z.string().optional(),
});

module.exports = { activityLogsQuerySchema };
