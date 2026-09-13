import assignmentService from '../services/assignment.service.js';
import { sendSuccess } from '../utils/responseHelper.js';
import asyncWrapper from '../utils/asyncWrapper.js';

/**
 * POST /assignments
 * Body: createAssignmentSchema | attachments: images[] (multipart field retained for compatibility)
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
 * Body: updateAssignmentSchema | attachments: images[] (multipart field retained for compatibility)
 * Access: admin, teacher (own assignments)
 */
const updateAssignment = asyncWrapper(async (req, res) => {
  const assignment = await assignmentService.updateAssignment(req.params.id, req.body, req.user, req.files || []);
  sendSuccess(res, { message: 'Assignment updated successfully', data: assignment });
});

const removeAssignmentAttachment = asyncWrapper(async (req, res) => {
  const assignment = await assignmentService.removeAssignmentAttachment(req.params.id, req.body.path, req.user);
  sendSuccess(res, { message: 'Attachment removed successfully', data: assignment });
});

/**
 * DELETE /assignments/:id
 * Access: admin, teacher (own assignments)
 */
const deleteAssignment = asyncWrapper(async (req, res) => {
  await assignmentService.deleteAssignment(req.params.id, req.user);
  sendSuccess(res, { message: 'Assignment deleted successfully' });
});

export { createAssignment, listAssignments, getAssignmentById, updateAssignment, removeAssignmentAttachment, deleteAssignment };
export default { createAssignment, listAssignments, getAssignmentById, updateAssignment, removeAssignmentAttachment, deleteAssignment };
