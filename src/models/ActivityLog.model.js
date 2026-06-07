import mongoose from 'mongoose';

const activityLogSchema = new mongoose.Schema({
  actorId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  actorName: { type: String, required: true },
  actorRole: { type: String, required: true },
  targetId: { type: mongoose.Schema.Types.ObjectId, default: null },
  targetName: { type: String, default: null },
  targetRole: { type: String, default: null },
  actionType: { type: String, required: true },
  entityType: { type: String, required: true },
  entityId: { type: mongoose.Schema.Types.ObjectId, default: null },
  metadata: { type: mongoose.Schema.Types.Mixed, default: {} },
  ipAddress: { type: String },
  userAgent: { type: String },
}, { timestamps: true });

activityLogSchema.index({ actorId: 1 });
activityLogSchema.index({ entityType: 1 });
activityLogSchema.index({ createdAt: -1 });

export default mongoose.model('ActivityLog', activityLogSchema);
