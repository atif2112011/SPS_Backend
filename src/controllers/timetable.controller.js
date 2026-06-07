const timetableService = require('../services/timetable.service');
const { sendSuccess } = require('../utils/responseHelper');
const asyncWrapper = require('../utils/asyncWrapper');

/**
 * POST /timetables
 * Body: createTimetableSchema
 * Access: admin, teacher (own class)
 */
const createTimetable = asyncWrapper(async (req, res) => {
  const timetable = await timetableService.createTimetable(req.body, req.user);
  sendSuccess(res, { message: 'Timetable created successfully', data: timetable, statusCode: 201 });
});

/**
 * GET /timetables/class/:classId
 * Access: all authenticated (scoped)
 */
const getClassTimetable = asyncWrapper(async (req, res) => {
  const timetable = await timetableService.getClassTimetable(req.params.classId, req.user);
  sendSuccess(res, { message: 'Timetable fetched', data: timetable });
});

/**
 * PATCH /timetables/:id
 * Body: updateTimetableSchema (replaces full schedule)
 * Access: admin, teacher (own class)
 */
const updateTimetable = asyncWrapper(async (req, res) => {
  const timetable = await timetableService.updateTimetable(req.params.id, req.body, req.user);
  sendSuccess(res, { message: 'Timetable updated successfully', data: timetable });
});

/**
 * DELETE /timetables/:id
 * Access: admin only
 */
const deleteTimetable = asyncWrapper(async (req, res) => {
  await timetableService.deleteTimetable(req.params.id, req.user);
  sendSuccess(res, { message: 'Timetable deleted successfully' });
});

module.exports = { createTimetable, getClassTimetable, updateTimetable, deleteTimetable };
