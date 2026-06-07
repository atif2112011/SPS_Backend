import assignmentService from '../services/assignment.service.js';
import { sendSuccess } from '../utils/responseHelper.js';
import asyncWrapper from '../utils/asyncWrapper.js';

/**
 * POST /assignments
 * Body: createAssignmentSchema | files: images[]
 * Access: admin, teacher
 */
const createAssignment = asyncWrapper(async (req, res) => {
  const assignment = await assignmentService.createAssignment(req.body, req.user, req.files || []);
  sendSuccess(res, { message: 'Assignment created successfully', data: assignment, statusCode: 201 });
});

/**
 * GET /assignments
 * Query: page, limit, search, classId, filter (upcoming|past)
 * Access: all authenticated
 */
const listAssignments = asyncWrapper(async (req, res) => {
  const { assignments, pagination } = await assignmentService.listAssignments(req.query, req.user);
  sendSuccess(res, { message: 'Assignments fetched', data: assignments, pagination });
});

/**
 * GET /assignments/:id
 * Access: all authenticated
 */
const getAssignmentById = asyncWrapper(async (req, res) => {
  const assignment = await assignmentService.getAssignmentById(req.params.id, req.user);
  sendSuccess(res, { message: 'Assignment fetched', data: assignment });
});

/**
 * PATCH /assignments/:id
 * Body: updateAssignmentSchema | files: images[]
 * Access: admin, teacher (own assignments)
 */
const updateAssignment = asyncWrapper(async (req, res) => {
  const assignment = await assignmentService.updateAssignment(req.params.id, req.body, req.user, req.files || []);
  sendSuccess(res, { message: 'Assignment updated successfully', data: assignment });
});

/**
 * DELETE /assignments/:id
 * Access: admin, teacher (own assignments)
 */
const deleteAssignment = asyncWrapper(async (req, res) => {
  await assignmentService.deleteAssignment(req.params.id, req.user);
  sendSuccess(res, { message: 'Assignment deleted successfully' });
});

export { createAssignment, listAssignments, getAssignmentById, updateAssignment, deleteAssignment };
export default { createAssignment, listAssignments, getAssignmentById, updateAssignment, deleteAssignment };
