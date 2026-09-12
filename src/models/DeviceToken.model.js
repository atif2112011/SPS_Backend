import mongoose from 'mongoose';

const deviceTokenSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  token: { type: String, required: true, trim: true },
  platform: { type: String, enum: ['ios', 'android', 'web'], required: true },
  deviceId: { type: String, trim: true },
  appVersion: { type: String, trim: true },
  enabled: { type: Boolean, default: true },
  lastSuccessfulDeliveryAt: { type: Date },
  consecutiveFailureCount: { type: Number, default: 0, min: 0 },
  disabledAt: { type: Date },
  disabledReason: { type: String },
  tokenRefreshedAt: { type: Date, default: Date.now },
  lastSeenAt: { type: Date, default: Date.now },
}, { timestamps: true });

deviceTokenSchema.index({ userId: 1, token: 1 }, { unique: true });
deviceTokenSchema.index({ token: 1 });
deviceTokenSchema.index({ userId: 1, enabled: 1 });

export default mongoose.model('DeviceToken', deviceTokenSchema);
