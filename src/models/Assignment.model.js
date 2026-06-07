const mongoose = require('mongoose');

const attachmentSchema = new mongoose.Schema({
  url: String, path: String, originalName: String, mimeType: String, size: Number,
}, { _id: false });

const assignmentSchema = new mongoose.Schema({
  title: { type: String, required: true, trim: true },
  description: { type: String, required: true },
  attachments: [attachmentSchema],
  classIds: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Class' }],
  studentIds: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  deadline: { type: Date, required: true },
  assignedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  assignedByRole: { type: String, enum: ['admin', 'teacher'] },
  status: { type: String, enum: ['active', 'archived'], default: 'active' },
  isDeleted: { type: Boolean, default: false },
}, { timestamps: true });

assignmentSchema.index({ assignedBy: 1 });
assignmentSchema.index({ deadline: 1 });
assignmentSchema.index({ classIds: 1 });
assignmentSchema.index({ isDeleted: 1 });

module.exports = mongoose.model('Assignment', assignmentSchema);
