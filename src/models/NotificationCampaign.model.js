import mongoose from 'mongoose';

const notificationCampaignSchema = new mongoose.Schema({
  title: { type: String, required: true, trim: true, maxlength: 120 },
  body: { type: String, required: true, trim: true, maxlength: 500 },
  sourceType: {
    type: String,
    enum: ['custom', 'notice', 'assignment', 'timetable', 'reportCard', 'result', 'reminder'],
    default: 'custom',
  },
  entityType: { type: String, trim: true },
  entityId: { type: mongoose.Schema.Types.ObjectId },
  audienceType: { type: String, enum: ['all_classes', 'specific_classes', 'specific_students'], required: true },
  classIds: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Class' }],
  studentIds: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  destination: { type: String, enum: ['home', 'notices', 'assignments', 'academics', 'profile'], default: 'home' },
  scheduledAt: { type: Date, default: Date.now },
  status: {
    type: String,
    enum: ['scheduled', 'queued', 'processing', 'completed', 'partially_failed', 'failed', 'cancelled'],
    default: 'queued',
  },
  recipientCount: { type: Number, default: 0, min: 0 },
  deviceCount: { type: Number, default: 0, min: 0 },
  recipientsWithoutDevices: { type: Number, default: 0, min: 0 },
  deliveredCount: { type: Number, default: 0, min: 0 },
  failedCount: { type: Number, default: 0, min: 0 },
  pendingCount: { type: Number, default: 0, min: 0 },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  idempotencyKey: { type: String, trim: true, sparse: true, unique: true },
}, { timestamps: true });

notificationCampaignSchema.index({ status: 1, scheduledAt: 1 });
notificationCampaignSchema.index({ createdBy: 1, createdAt: -1 });
notificationCampaignSchema.index({ title: 'text', body: 'text' });

export default mongoose.model('NotificationCampaign', notificationCampaignSchema);
