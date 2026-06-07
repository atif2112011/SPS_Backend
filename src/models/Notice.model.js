const mongoose = require('mongoose');

const attachmentSchema = new mongoose.Schema({
  url: String, path: String, originalName: String, mimeType: String, size: Number,
}, { _id: false });

const noticeSchema = new mongoose.Schema({
  title: { type: String, required: true, trim: true },
  message: { type: String, required: true },
  attachments: [attachmentSchema],
  audienceType: { type: String, enum: ['all_classes', 'specific_classes', 'specific_students'], required: true },
  classIds: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Class' }],
  studentIds: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  createdByRole: { type: String, enum: ['admin', 'teacher'] },
  status: { type: String, enum: ['active', 'archived'], default: 'active' },
  publishedAt: { type: Date, default: Date.now },
  isDeleted: { type: Boolean, default: false },
}, { timestamps: true });

noticeSchema.index({ createdBy: 1 });
noticeSchema.index({ audienceType: 1 });
noticeSchema.index({ classIds: 1 });
noticeSchema.index({ isDeleted: 1 });

module.exports = mongoose.model('Notice', noticeSchema);
