const resultService = require('../services/result.service');
const { sendSuccess } = require('../utils/responseHelper');
const asyncWrapper = require('../utils/asyncWrapper');

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
  const results = await resultService.listStudentResults(req.params.studentId, req.user);
  sendSuccess(res, { message: 'Results fetched', data: results });
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

module.exports = { createResult, listStudentResults, updateResult, deleteResult };
