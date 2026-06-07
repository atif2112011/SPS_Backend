const { z } = require('zod');

const objectIdSchema = z.string().regex(/^[a-f\d]{24}$/i, 'Invalid ObjectId');

const subjectMarkSchema = z.object({
  subject: z.string().min(1).max(100),
  marksObtained: z.number().min(0),
  totalMarks: z.number().min(0),
  grade: z.string().max(5).optional(),
});

const createResultSchema = z.object({
  studentId: objectIdSchema,
  classId: objectIdSchema,
  examName: z.string().min(1).max(200),
  academicYear: z.string().min(4).max(10),
  subjectMarks: z.array(subjectMarkSchema).optional(),
  overallGrade: z.string().max(5).optional(),
  rank: z.number().int().min(1).optional(),
  remarks: z.string().max(1000).optional(),
});

const updateResultSchema = z.object({
  examName: z.string().min(1).max(200).optional(),
  academicYear: z.string().min(4).max(10).optional(),
  subjectMarks: z.array(subjectMarkSchema).optional(),
  overallGrade: z.string().max(5).optional(),
  rank: z.number().int().min(1).optional(),
  remarks: z.string().max(1000).optional(),
});

module.exports = { createResultSchema, updateResultSchema };
