import { z } from 'zod';

const activityLogsQuerySchema = z.object({
  page: z.string().regex(/^\d+$/).optional(),
  limit: z.string().regex(/^\d+$/).optional(),
  sortBy: z.enum(['actorName', 'actorRole', 'actionType', 'entityType', 'createdAt']).optional(),
  sortOrder: z.enum(['asc', 'desc']).optional(),
  search: z.string().trim().max(100).optional(),
  actorRole: z.enum(['admin', 'teacher', 'student']).optional(),
  actionType: z.string().optional(),
  entityType: z.string().optional(),
});

export { activityLogsQuerySchema };
export default { activityLogsQuerySchema };
