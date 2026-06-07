const notificationService = require('../services/notification.service');
const { sendSuccess } = require('../utils/responseHelper');
const asyncWrapper = require('../utils/asyncWrapper');

const registerDevice = asyncWrapper(async (req, res) => {
  const token = await notificationService.registerDevice(req.body, req.user);
  sendSuccess(res, { message: 'Device token registered', data: token, statusCode: 201 });
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

module.exports = {
  registerDevice,
  listNotifications,
  markNotificationRead,
  markAllRead,
};
