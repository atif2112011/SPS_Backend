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
  const reportCards = await reportCardService.listStudentReportCards(req.params.studentId, req.user);
  sendSuccess(res, { message: 'Report cards fetched', data: reportCards });
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

/**
 * DELETE /report-cards/:id
 * Access: admin, teacher (own entries)
 */
const deleteReportCard = asyncWrapper(async (req, res) => {
  await reportCardService.deleteReportCard(req.params.id, req.user);
  sendSuccess(res, { message: 'Report card deleted successfully' });
});

export { createReportCard, listStudentReportCards, updateReportCard, deleteReportCard };
export default { createReportCard, listStudentReportCards, updateReportCard, deleteReportCard };
