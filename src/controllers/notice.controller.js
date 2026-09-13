import noticeService from '../services/notice.service.js';
import { sendSuccess } from '../utils/responseHelper.js';
import asyncWrapper from '../utils/asyncWrapper.js';

/**
 * POST /notices
 * Body: createNoticeSchema | attachments: images[] (multipart field retained for compatibility)
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

const markNoticeRead = asyncWrapper(async (req, res) => {
  const result = await noticeService.markNoticeRead(req.params.id, req.user);
  sendSuccess(res, { message: 'Notice marked as read', data: result });
});

/**
 * PATCH /notices/:id
 * Body: updateNoticeSchema | attachments: images[] (multipart field retained for compatibility)
 * Access: admin, teacher (own notices)
 */
const updateNotice = asyncWrapper(async (req, res) => {
  const notice = await noticeService.updateNotice(req.params.id, req.body, req.user, req.files || []);
  sendSuccess(res, { message: 'Notice updated successfully', data: notice });
});

const removeNoticeAttachment = asyncWrapper(async (req, res) => {
  const notice = await noticeService.removeNoticeAttachment(req.params.id, req.body.path, req.user);
  sendSuccess(res, { message: 'Attachment removed successfully', data: notice });
});

/**
 * DELETE /notices/:id
 * Access: admin, teacher (own notices)
 */
const deleteNotice = asyncWrapper(async (req, res) => {
  await noticeService.deleteNotice(req.params.id, req.user);
  sendSuccess(res, { message: 'Notice deleted successfully' });
});

export { createNotice, listNotices, getNoticeById, markNoticeRead, updateNotice, removeNoticeAttachment, deleteNotice };
export default { createNotice, listNotices, getNoticeById, markNoticeRead, updateNotice, removeNoticeAttachment, deleteNotice };
