import dashboardService from '../services/dashboard.service.js';
import { sendSuccess } from '../utils/responseHelper.js';
import asyncWrapper from '../utils/asyncWrapper.js';

const getDashboard = asyncWrapper(async (req, res) => {
  const dashboard = await dashboardService.getDashboard(req.user);
  sendSuccess(res, { message: 'Dashboard metrics fetched', data: dashboard });
});

export { getDashboard };
export default { getDashboard };
