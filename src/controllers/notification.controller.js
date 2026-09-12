import notificationService from '../services/notification.service.js';
import { sendSuccess } from '../utils/responseHelper.js';
import asyncWrapper from '../utils/asyncWrapper.js';
import notificationCampaignService from '../services/notificationCampaign.service.js';

const registerDevice = asyncWrapper(async (req, res) => {
  const token = await notificationService.registerDevice(req.body, req.user);
  sendSuccess(res, { message: 'Device token registered', data: token, statusCode: 201 });
});

const unregisterDevice = asyncWrapper(async (req, res) => {
  const result = await notificationService.unregisterDevice(req.body, req.user);
  sendSuccess(res, { message: 'Device unregistered', data: result });
});

const previewCampaign = asyncWrapper(async (req, res) => {
  const preview = await notificationCampaignService.previewCampaign(req.body);
  sendSuccess(res, { message: 'Audience preview ready', data: preview });
});

const createCampaign = asyncWrapper(async (req, res) => {
  const result = await notificationCampaignService.createCampaign(req.body, req.user);
  sendSuccess(res, {
    message: result.duplicate ? 'Existing campaign returned' : 'Notification campaign queued',
    data: result.campaign,
    statusCode: result.duplicate ? 200 : 201,
  });
});

const listCampaigns = asyncWrapper(async (req, res) => {
  const { campaigns, pagination } = await notificationCampaignService.listCampaigns(req.query);
  sendSuccess(res, { message: 'Notification campaigns fetched', data: campaigns, pagination });
});

const getCampaign = asyncWrapper(async (req, res) => {
  const campaign = await notificationCampaignService.getCampaign(req.params.id);
  sendSuccess(res, { message: 'Notification campaign fetched', data: campaign });
});

const listCampaignDeliveries = asyncWrapper(async (req, res) => {
  const { deliveries, pagination } = await notificationCampaignService.listDeliveries(req.params.id, req.query);
  sendSuccess(res, { message: 'Campaign deliveries fetched', data: deliveries, pagination });
});

const cancelCampaign = asyncWrapper(async (req, res) => {
  const campaign = await notificationCampaignService.cancelCampaign(req.params.id);
  sendSuccess(res, { message: 'Notification campaign cancelled', data: campaign });
});

const retryFailed = asyncWrapper(async (req, res) => {
  const result = await notificationCampaignService.retryFailed(req.params.id);
  sendSuccess(res, { message: `${result.queuedCount} deliveries queued for retry`, data: result });
});

const listNotifications = asyncWrapper(async (req, res) => {
  const { notifications, pagination } = await notificationService.listNotifications(req.query, req.user);
  sendSuccess(res, { message: 'Notifications fetched', data: notifications, pagination });
});

const markNotificationRead = asyncWrapper(async (req, res) => {
  const notification = await notificationService.markNotificationRead(req.params.id, req.user);
  sendSuccess(res, { message: 'Notification marked as read', data: notification });
});

const markAllRead = asyncWrapper(async (req, res) => {
  const result = await notificationService.markAllRead(req.user);
  sendSuccess(res, { message: 'All notifications marked as read', data: result });
});

export {
  registerDevice,
  unregisterDevice,
  previewCampaign,
  createCampaign,
  listCampaigns,
  getCampaign,
  listCampaignDeliveries,
  cancelCampaign,
  retryFailed,
  listNotifications,
  markNotificationRead,
  markAllRead,
};
export default {
  registerDevice,
  unregisterDevice,
  previewCampaign,
  createCampaign,
  listCampaigns,
  getCampaign,
  listCampaignDeliveries,
  cancelCampaign,
  retryFailed,
  listNotifications,
  markNotificationRead,
  markAllRead,
};
