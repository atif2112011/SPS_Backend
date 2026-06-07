const adminService = require('../services/admin.service');
const { sendSuccess } = require('../utils/responseHelper');
const asyncWrapper = require('../utils/asyncWrapper');

const getOverviewMetrics = asyncWrapper(async (req, res) => {
  const metrics = await adminService.getOverviewMetrics();
  sendSuccess(res, { message: 'Admin overview metrics fetched', data: metrics });
});

const listActivityLogs = asyncWrapper(async (req, res) => {
  const { logs, pagination } = await adminService.listActivityLogs(req.query);
  sendSuccess(res, { message: 'Activity logs fetched', data: logs, pagination });
});

module.exports = { getOverviewMetrics, listActivityLogs };
