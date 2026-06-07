const { z } = require('zod');

const createStudentSchema = z.object({
  username: z.string().min(3).max(50).trim().toLowerCase(),
  password: z.string().min(8).max(64),
  name: z.string().min(1).max(100).trim(),
  email: z.string().email().optional().or(z.literal('')),
  phone: z.string().max(20).optional(),
  admissionNo: z.string().min(1).max(30).trim(),
  rollNo: z.string().max(20).optional(),
  section: z.string().max(10).optional(),
  dob: z.string().optional(), // ISO date string
  guardianName: z.string().max(100).optional(),
  guardianPhone: z.string().max(20).optional(),
  address: z.string().max(300).optional(),
  gender: z.enum(['male', 'female', 'other']).optional(),
});

const createTeacherSchema = z.object({
  username: z.string().min(3).max(50).trim().toLowerCase(),
  password: z.string().min(8).max(64),
  name: z.string().min(1).max(100).trim(),
  email: z.string().email().optional().or(z.literal('')),
  phone: z.string().max(20).optional(),
  employeeId: z.string().min(1).max(30).trim(),
  subjects: z.array(z.string()).optional(),
  qualification: z.string().max(200).optional(),
  joiningDate: z.string().optional(),
});

const updateStudentSchema = z.object({
  name: z.string().min(1).max(100).trim().optional(),
  email: z.string().email().optional().or(z.literal('')),
  phone: z.string().max(20).optional(),
  rollNo: z.string().max(20).optional(),
  section: z.string().max(10).optional(),
  dob: z.string().optional(),
  guardianName: z.string().max(100).optional(),
  guardianPhone: z.string().max(20).optional(),
  address: z.string().max(300).optional(),
  gender: z.enum(['male', 'female', 'other']).optional(),
  resultSummary: z.string().max(500).optional(),
}).refine(data => Object.keys(data).length > 0, { message: 'At least one field required' });

const updateTeacherSchema = z.object({
  name: z.string().min(1).max(100).trim().optional(),
  email: z.string().email().optional().or(z.literal('')),
  phone: z.string().max(20).optional(),
  subjects: z.array(z.string()).optional(),
  qualification: z.string().max(200).optional(),
  joiningDate: z.string().optional(),
}).refine(data => Object.keys(data).length > 0, { message: 'At least one field required' });

const listUsersQuerySchema = z.object({
  page: z.string().optional(),
  limit: z.string().optional(),
  search: z.string().optional(),
  status: z.enum(['active', 'blocked', 'deleted']).optional(),
  sortBy: z.string().optional(),
  sortOrder: z.enum(['asc', 'desc']).optional(),
});

module.exports = { createStudentSchema, createTeacherSchema, updateStudentSchema, updateTeacherSchema, listUsersQuerySchema };
