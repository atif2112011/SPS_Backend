const mongoose = require('mongoose');

const notificationSchema = new mongoose.Schema({
  recipientUserId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  recipientRole: { type: String, enum: ['admin', 'teacher', 'student'], required: true },
  title: { type: String, required: true, trim: true },
  body: { type: String, required: true, trim: true },
  type: {
    type: String,
    enum: ['notice', 'assignment', 'timetable', 'reportCard', 'result', 'reminder'],
    required: true,
  },
  entityType: { type: String, required: true, trim: true },
  entityId: { type: mongoose.Schema.Types.ObjectId, required: true },
  isRead: { type: Boolean, default: false },
  sentAt: { type: Date, default: Date.now },
  dedupeKey: { type: String, sparse: true, unique: true },
}, { timestamps: true });

notificationSchema.index({ recipientUserId: 1, isRead: 1, createdAt: -1 });
notificationSchema.index({ type: 1 });
notificationSchema.index({ entityType: 1, entityId: 1 });

module.exports = mongoose.model('Notification', notificationSchema);
