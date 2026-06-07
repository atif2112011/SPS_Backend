import mongoose from 'mongoose';

const subjectMarkSchema = new mongoose.Schema({
  subject: String, marksObtained: Number, totalMarks: Number, grade: String,
}, { _id: false });

const resultSchema = new mongoose.Schema({
  studentId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  classId: { type: mongoose.Schema.Types.ObjectId, ref: 'Class', required: true },
  examName: { type: String, required: true },
  academicYear: { type: String, required: true },
  subjectMarks: [subjectMarkSchema],
  overallGrade: String,
  rank: Number,
  remarks: String,
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  isDeleted: { type: Boolean, default: false },
}, { timestamps: true });

resultSchema.index({ studentId: 1 });
resultSchema.index({ classId: 1 });
resultSchema.index({ examName: 1, academicYear: 1 });
resultSchema.index({ isDeleted: 1 });

export default mongoose.model('Result', resultSchema);
