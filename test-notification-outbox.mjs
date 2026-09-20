import 'dotenv/config';
import assert from 'node:assert/strict';
import mongoose from 'mongoose';
import NotificationEvent from './src/models/NotificationEvent.model.js';
import EVENTS from './src/constants/events.js';
import { publishEvent } from './src/events/eventBus.js';
import { processNotificationEvents } from './src/services/notificationWorker.service.js';

await mongoose.connect(process.env.MONGODB_URI);

const noticeId = new mongoose.Types.ObjectId();
const eventVersion = `outbox-test-${Date.now()}`;
const payload = { noticeId, eventVersion };
let event;

try {
  event = await publishEvent(EVENTS.NOTICE_UPDATED, payload);
  await publishEvent(EVENTS.NOTICE_UPDATED, payload);

  assert.ok(event?._id, 'The event was not persisted');
  assert.equal(
    await NotificationEvent.countDocuments({ dedupeKey: event.dedupeKey }),
    1,
    'Duplicate event was persisted',
  );

  const result = await processNotificationEvents(1, { eventIds: [event._id] });
  const completed = await NotificationEvent.findById(event._id).lean();
  assert.deepEqual(result, { claimed: 1, completed: 1, failed: 0 });
  assert.equal(completed.status, 'completed');
  assert.equal(completed.attemptCount, 1);

  console.log('PASS durable notification outbox persists, deduplicates, and processes events');
} finally {
  if (event?._id) await NotificationEvent.deleteOne({ _id: event._id });
  await mongoose.disconnect();
}
