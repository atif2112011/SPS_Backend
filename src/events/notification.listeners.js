import eventBus from './eventBus.js';
import notificationEventService from '../services/notificationEvent.service.js';
import logger from '../config/logger.js';

let listenersRegistered = false;

const registerNotificationListeners = () => {
  if (listenersRegistered) return;
  listenersRegistered = true;

  for (const eventName of notificationEventService.supportedEvents) {
    eventBus.on(eventName, (payload) => {
      void notificationEventService.queueForEvent(eventName, payload).catch((err) => {
        logger.error('Notification event queueing failed', {
          eventName,
          entityId: payload.noticeId || payload.assignmentId || payload.timetableId || payload.reportCardId || payload.resultId,
          error: err.message,
        });
      });
    });
  }

  eventBus.on('error', (err) => {
    logger.error('Notification event bus error', { error: err.message });
  });
};

export default registerNotificationListeners;
