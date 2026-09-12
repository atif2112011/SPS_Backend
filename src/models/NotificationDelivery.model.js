import mongoose from 'mongoose';

const notificationDeliverySchema = new mongoose.Schema({
  campaignId: { type: mongoose.Schema.Types.ObjectId, ref: 'NotificationCampaign', required: true },
  recipientUserId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  deviceTokenId: { type: mongoose.Schema.Types.ObjectId, ref: 'DeviceToken', required: true },
  token: { type: String, required: true },
  platform: { type: String, enum: ['android'], default: 'android' },
  status: {
    type: String,
    enum: ['pending', 'processing', 'retry_scheduled', 'delivered', 'failed', 'invalid_token', 'cancelled'],
    default: 'pending',
  },
  attemptCount: { type: Number, default: 0, min: 0, max: 3 },
  nextAttemptAt: { type: Date, default: Date.now },
  lockedAt: { type: Date },
  lockedUntil: { type: Date },
  providerMessageId: { type: String },
  lastErrorCode: { type: String },
  lastErrorMessage: { type: String },
  failureKind: { type: String, enum: ['transient', 'permanent', 'invalid_token'] },
  deliveredAt: { type: Date },
}, { timestamps: true });

notificationDeliverySchema.index({ campaignId: 1, deviceTokenId: 1 }, { unique: true });
notificationDeliverySchema.index({ status: 1, nextAttemptAt: 1, lockedUntil: 1 });
notificationDeliverySchema.index({ recipientUserId: 1, createdAt: -1 });

export default mongoose.model('NotificationDelivery', notificationDeliverySchema);
