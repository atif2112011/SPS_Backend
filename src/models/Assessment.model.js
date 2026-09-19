import mongoose from 'mongoose';

const attachmentSchema = new mongoose.Schema({
  url: String, path: String, originalName: String, mimeType: String, size: Number,
}, { _id: false });

const subjectMarkSchema = new mongoose.Schema({
  subject: { type: String, required: true, trim: true },
  marksObtained: { type: Number, required: true, min: 0, validate: { validator(value) { return !this.totalMarks || value <= this.totalMarks; }, message: 'Marks obtained cannot exceed total marks' } },
  totalMarks: { type: Number, required: true, min: 1 },
  grade: { type: String, trim: true },
}, { _id: false });

const assessmentSchema = new mongoose.Schema({
  studentId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  classId: { type: mongoose.Schema.Types.ObjectId, ref: 'Class', required: true },
  title: { type: String, required: true, trim: true, maxlength: 200 },
  category: { type: String, enum: ['academic_assessment', 'achievement', 'other'], required: true },
  eventDate: { type: Date, required: true },
  academicYear: { type: String, trim: true, maxlength: 10 },
  subjectMarks: [subjectMarkSchema],
  overallGrade: { type: String, trim: true, maxlength: 20 },
  outcome: { type: String, trim: true, maxlength: 200 },
  score: { type: Number, min: 0 },
  maxScore: { type: Number, min: 1 },
  grade: { type: String, trim: true, maxlength: 20 },
  rank: { type: Number, min: 1 },
  remarks: { type: String, trim: true, maxlength: 1000 },
  attachments: [attachmentSchema],
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  legacyResultId: { type: mongoose.Schema.Types.ObjectId, ref: 'Result', unique: true, sparse: true },
  isDeleted: { type: Boolean, default: false },
}, { timestamps: true });

assessmentSchema.index({ studentId: 1, isDeleted: 1 });
assessmentSchema.index({ classId: 1, isDeleted: 1 });
assessmentSchema.index({ category: 1, eventDate: -1 });
assessmentSchema.index({ academicYear: 1 });
assessmentSchema.index({ title: 1 });
assessmentSchema.index({ studentId: 1, classId: 1, category: 1, title: 1, eventDate: 1, isDeleted: 1 }, { unique: true, partialFilterExpression: { isDeleted: false } });

export default mongoose.model('Assessment', assessmentSchema);
