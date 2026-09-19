import { z } from 'zod';

const objectIdSchema = z.string().regex(/^[a-f\d]{24}$/i, 'Invalid ObjectId');
const paginationFields = {
  page: z.string().regex(/^\d+$/).optional(),
  limit: z.string().regex(/^\d+$/).optional(),
  search: z.string().trim().max(100).optional(),
  sortOrder: z.enum(['asc', 'desc']).optional(),
};

const teacherStudentListQuerySchema = z.object({
  ...paginationFields,
  status: z.enum(['active', 'blocked']).optional(),
  gender: z.enum(['male', 'female', 'other']).optional(),
  sortBy: z.enum(['name', 'username', 'status', 'admissionNo', 'rollNo', 'createdAt']).optional(),
});

const teacherCreateStudentSchema = z.object({
  name: z.string().min(1).max(100).trim(),
  phone: z.string().max(20).optional(),
  admissionNo: z.string().min(1).max(30).trim(),
  rollNo: z.string().max(20).optional(),
  dob: z.string().date().optional(),
  guardianName: z.string().max(100).optional(),
  guardianPhone: z.string().max(20).optional(),
  address: z.string().max(300).optional(),
  gender: z.enum(['male', 'female', 'other']).optional(),
}).strict();

const teacherUpdateStudentSchema = z.object({
  name: z.string().min(1).max(100).trim().optional(),
  phone: z.string().max(20).optional(),
  rollNo: z.string().max(20).optional(),
  dob: z.union([z.string().date(), z.literal('')]).optional(),
  guardianName: z.string().max(100).optional(),
  guardianPhone: z.string().max(20).optional(),
  address: z.string().max(300).optional(),
  gender: z.enum(['male', 'female', 'other']).optional(),
}).refine((data) => Object.keys(data).length > 0, { message: 'At least one field required' });

const transferRequestSchema = z.object({
  destinationClassId: objectIdSchema,
  requestNote: z.string().trim().max(500).optional(),
});

const transferDecisionSchema = z.object({
  decisionNote: z.string().trim().max(500).optional().default(''),
});

const transferListQuerySchema = z.object({
  ...paginationFields,
  direction: z.enum(['incoming', 'sent']).optional(),
  status: z.enum(['pending', 'approved', 'rejected', 'cancelled']).optional(),
  sourceClassId: objectIdSchema.optional(),
  destinationClassId: objectIdSchema.optional(),
  dateFrom: z.string().date().optional(),
  dateTo: z.string().date().optional(),
  sortBy: z.enum(['createdAt', 'status', 'studentName', 'sourceClass', 'destinationClass']).optional(),
});

export {
  teacherCreateStudentSchema, teacherStudentListQuerySchema, teacherUpdateStudentSchema,
  transferDecisionSchema, transferListQuerySchema, transferRequestSchema,
};
