import NotificationEvent from '../models/NotificationEvent.model.js';

const getEntityId = (payload) => payload.noticeId
  || payload.assignmentId
  || payload.timetableId
  || payload.reportCardId
  || payload.assessmentId
  || payload.resultId
  || 'unknown';

// Persist only the lightweight event during the API request. Recipient
// resolution and campaign creation are handled by the scheduled worker.
const publishEvent = async (eventName, payload) => {
  const entityId = String(getEntityId(payload));
  const version = payload.eventVersion || 'initial';
  const dedupeKey = `${eventName}:${entityId}:${version}`;

  try {
    return await NotificationEvent.create({ eventName, payload, dedupeKey });
  } catch (error) {
    if (error?.code === 11000) return null;
    throw error;
  }
};

export { publishEvent };
export default { publishEvent };
