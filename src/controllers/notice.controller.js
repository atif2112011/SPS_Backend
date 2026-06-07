const noticeService = require('../services/notice.service');
const { sendSuccess } = require('../utils/responseHelper');
const asyncWrapper = require('../utils/asyncWrapper');

/**
 * POST /notices
 * Body: createNoticeSchema | files: images[]
 * Access: admin, teacher
 */
const createNotice = asyncWrapper(async (req, res) => {
  const notice = await noticeService.createNotice(req.body, req.user, req.files || []);
  sendSuccess(res, { message: 'Notice created successfully', data: notice, statusCode: 201 });
});

/**
 * GET /notices
 * Query: page, limit, search, audienceType, classId, status
 * Access: all authenticated
 */
const listNotices = asyncWrapper(async (req, res) => {
  const { notices, pagination } = await noticeService.listNotices(req.query, req.user);
  sendSuccess(res, { message: 'Notices fetched', data: notices, pagination });
});

/**
 * GET /notices/:id
 * Access: all authenticated
 */
const getNoticeById = asyncWrapper(async (req, res) => {
  const notice = await noticeService.getNoticeById(req.params.id, req.user);
  sendSuccess(res, { message: 'Notice fetched', data: notice });
});

/**
 * PATCH /notices/:id
 * Body: updateNoticeSchema | files: images[]
 * Access: admin, teacher (own notices)
 */
const updateNotice = asyncWrapper(async (req, res) => {
  const notice = await noticeService.updateNotice(req.params.id, req.body, req.user, req.files || []);
  sendSuccess(res, { message: 'Notice updated successfully', data: notice });
});

/**
 * DELETE /notices/:id
 * Access: admin, teacher (own notices)
 */
const deleteNotice = asyncWrapper(async (req, res) => {
  await noticeService.deleteNotice(req.params.id, req.user);
  sendSuccess(res, { message: 'Notice deleted successfully' });
});

module.exports = { createNotice, listNotices, getNoticeById, updateNotice, deleteNotice };
