import reportCardService from '../services/reportCard.service.js';
import { sendSuccess } from '../utils/responseHelper.js';
import asyncWrapper from '../utils/asyncWrapper.js';

/**
 * POST /report-cards
 * Body: createReportCardSchema | files: files[]
 * Access: admin, teacher (own class students)
 */
const createReportCard = asyncWrapper(async (req, res) => {
  const reportCard = await reportCardService.createReportCard(req.body, req.user, req.files || []);
  sendSuccess(res, { message: 'Report card created successfully', data: reportCard, statusCode: 201 });
});

/**
 * GET /report-cards/student/:studentId
 * Access: admin, teacher (own class), student (own only)
 */
const listStudentReportCards = asyncWrapper(async (req, res) => {
  const { reportCards, pagination } = await reportCardService.listStudentReportCards(req.params.studentId, req.query, req.user);
  sendSuccess(res, { message: 'Report cards fetched', data: reportCards, pagination });
});

const getReportCard = asyncWrapper(async (req, res) => {
  const reportCard = await reportCardService.getReportCard(req.params.id, req.user);
  sendSuccess(res, { message: 'Report card fetched', data: reportCard });
});

/**
 * PATCH /report-cards/:id
 * Body: updateReportCardSchema | files: files[]
 * Access: admin, teacher (own entries)
 */
const updateReportCard = asyncWrapper(async (req, res) => {
  const reportCard = await reportCardService.updateReportCard(req.params.id, req.body, req.user, req.files || []);
  sendSuccess(res, { message: 'Report card updated successfully', data: reportCard });
});

const removeReportCardAttachment = asyncWrapper(async (req, res) => {
  const reportCard = await reportCardService.removeReportCardAttachment(req.params.id, req.body.path, req.user);
  sendSuccess(res, { message: 'Attachment removed successfully', data: reportCard });
});

/**
 * DELETE /report-cards/:id
 * Access: admin, teacher (own entries)
 */
const deleteReportCard = asyncWrapper(async (req, res) => {
  await reportCardService.deleteReportCard(req.params.id, req.user);
  sendSuccess(res, { message: 'Report card deleted successfully' });
});

export { createReportCard, getReportCard, listStudentReportCards, updateReportCard, removeReportCardAttachment, deleteReportCard };
export default { createReportCard, getReportCard, listStudentReportCards, updateReportCard, removeReportCardAttachment, deleteReportCard };
