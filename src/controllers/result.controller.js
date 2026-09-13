import resultService from '../services/result.service.js';
import { sendSuccess } from '../utils/responseHelper.js';
import asyncWrapper from '../utils/asyncWrapper.js';

/**
 * POST /results
 * Body: createResultSchema
 * Access: admin, teacher (own class students)
 */
const createResult = asyncWrapper(async (req, res) => {
  const result = await resultService.createResult(req.body, req.user);
  sendSuccess(res, { message: 'Result created successfully', data: result, statusCode: 201 });
});

/**
 * GET /results/student/:studentId
 * Access: admin, teacher (own class), student (own only)
 */
const listStudentResults = asyncWrapper(async (req, res) => {
  const { results, pagination } = await resultService.listStudentResults(req.params.studentId, req.query, req.user);
  sendSuccess(res, { message: 'Results fetched', data: results, pagination });
});

const getResult = asyncWrapper(async (req, res) => {
  const result = await resultService.getResult(req.params.id, req.user);
  sendSuccess(res, { message: 'Result fetched', data: result });
});

/**
 * PATCH /results/:id
 * Body: updateResultSchema
 * Access: admin, teacher (own entries)
 */
const updateResult = asyncWrapper(async (req, res) => {
  const result = await resultService.updateResult(req.params.id, req.body, req.user);
  sendSuccess(res, { message: 'Result updated successfully', data: result });
});

/**
 * DELETE /results/:id
 * Access: admin, teacher (own entries)
 */
const deleteResult = asyncWrapper(async (req, res) => {
  await resultService.deleteResult(req.params.id, req.user);
  sendSuccess(res, { message: 'Result deleted successfully' });
});

export { createResult, getResult, listStudentResults, updateResult, deleteResult };
export default { createResult, getResult, listStudentResults, updateResult, deleteResult };
