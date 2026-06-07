import adminService from '../services/admin.service.js';
import { sendSuccess } from '../utils/responseHelper.js';
import asyncWrapper from '../utils/asyncWrapper.js';

const getOverviewMetrics = asyncWrapper(async (req, res) => {
  const metrics = await adminService.getOverviewMetrics();
  sendSuccess(res, { message: 'Admin overview metrics fetched', data: metrics });
});

const listActivityLogs = asyncWrapper(async (req, res) => {
  const { logs, pagination } = await adminService.listActivityLogs(req.query);
  sendSuccess(res, { message: 'Activity logs fetched', data: logs, pagination });
});

export { getOverviewMetrics, listActivityLogs };
export default { getOverviewMetrics, listActivityLogs };
