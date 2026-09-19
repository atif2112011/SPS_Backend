import Assessment from '../models/Assessment.model.js';
import assessmentService from '../services/assessment.service.js';
import { sendSuccess } from '../utils/responseHelper.js';
import asyncWrapper from '../utils/asyncWrapper.js';

/**
 * POST /results
 * Body: createResultSchema
 * Access: admin, teacher (own class students)
 */
const legacyResultShape = (assessment) => ({
  _id: String(assessment.legacyResultId || assessment._id), studentId: assessment.studentId, classId: assessment.classId,
  examName: assessment.title, academicYear: assessment.academicYear, subjectMarks: assessment.subjectMarks || [],
  overallGrade: assessment.overallGrade, rank: assessment.rank, remarks: assessment.remarks, createdBy: assessment.createdBy,
  createdAt: assessment.createdAt, updatedAt: assessment.updatedAt, isDeleted: assessment.isDeleted,
});
const removed = () => Object.assign(new Error('Results are now Assessments & Achievements. Use /assessments for new or updated records.'), { statusCode: 410, errorCode: 'RESULTS_RETIRED' });
const createResult = asyncWrapper(async () => { throw removed(); });

/**
 * GET /results/student/:studentId
 * Access: admin, teacher (own class), student (own only)
 */
const listStudentResults = asyncWrapper(async (req, res) => {
  const query = { ...req.query, category: 'academic_assessment', sortBy: req.query.sortBy === 'examName' ? 'title' : req.query.sortBy };
  const { assessments, pagination } = await assessmentService.listStudentAssessments(req.params.studentId, query, req.user);
  sendSuccess(res, { message: 'Legacy results fetched from Assessments & Achievements', data: assessments.map(legacyResultShape), pagination });
});

const getResult = asyncWrapper(async (req, res) => {
  const assessment = await Assessment.findOne({ $or: [{ legacyResultId: req.params.id }, { _id: req.params.id }], category: 'academic_assessment', isDeleted: false });
  if (!assessment) { const err = new Error('Result not found'); err.statusCode = 404; throw err; }
  const result = await assessmentService.getAssessment(assessment._id, req.user);
  sendSuccess(res, { message: 'Legacy result fetched from Assessments & Achievements', data: legacyResultShape(result) });
});

/**
 * PATCH /results/:id
 * Body: updateResultSchema
 * Access: admin, teacher (own entries)
 */
const updateResult = asyncWrapper(async (req, res) => {
  throw removed();
});

/**
 * DELETE /results/:id
 * Access: admin, teacher (own entries)
 */
const deleteResult = asyncWrapper(async (req, res) => {
  throw removed();
});

export { createResult, getResult, listStudentResults, updateResult, deleteResult };
export default { createResult, getResult, listStudentResults, updateResult, deleteResult };
