import mongoose from 'mongoose';

const notificationEventSchema = new mongoose.Schema({
  eventName: { type: String, required: true, trim: true },
  payload: { type: mongoose.Schema.Types.Mixed, required: true },
  dedupeKey: { type: String, required: true, unique: true, index: true },
  status: {
    type: String,
    enum: ['pending', 'processing', 'retry_scheduled', 'completed', 'failed'],
    default: 'pending',
    index: true,
  },
  attemptCount: { type: Number, default: 0, min: 0 },
  nextAttemptAt: { type: Date, default: Date.now, index: true },
  lockedAt: { type: Date, default: null },
  lockedUntil: { type: Date, default: null },
  completedAt: { type: Date, default: null },
  lastError: { type: String, default: null },
}, { timestamps: true });

notificationEventSchema.index({ status: 1, nextAttemptAt: 1, lockedUntil: 1 });
notificationEventSchema.index({ completedAt: 1 }, { expireAfterSeconds: 30 * 24 * 60 * 60 });

export default mongoose.model('NotificationEvent', notificationEventSchema);
