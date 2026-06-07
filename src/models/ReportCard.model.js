import mongoose from 'mongoose';

const attachmentSchema = new mongoose.Schema({
  url: String, path: String, originalName: String, mimeType: String, size: Number,
}, { _id: false });

const markSchema = new mongoose.Schema({
  subject: String, marksObtained: Number, totalMarks: Number, grade: String,
}, { _id: false });

const reportCardSchema = new mongoose.Schema({
  studentId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  classId: { type: mongoose.Schema.Types.ObjectId, ref: 'Class', required: true },
  term: { type: String, required: true },
  academicYear: { type: String, required: true },
  marks: [markSchema],
  remarks: String,
  attachments: [attachmentSchema],
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  isDeleted: { type: Boolean, default: false },
}, { timestamps: true });

reportCardSchema.index({ studentId: 1 });
reportCardSchema.index({ classId: 1 });
reportCardSchema.index({ term: 1, academicYear: 1 });
reportCardSchema.index({ isDeleted: 1 });

export default mongoose.model('ReportCard', reportCardSchema);
