const mongoose = require('mongoose');

const studentProfileSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
  admissionNo: { type: String, required: true, unique: true, trim: true },
  rollNo: { type: String, trim: true },
  classId: { type: mongoose.Schema.Types.ObjectId, ref: 'Class', default: null },
  section: { type: String, trim: true },
  dob: { type: Date },
  guardianName: { type: String, trim: true },
  guardianPhone: { type: String, trim: true },
  address: { type: String, trim: true },
  gender: { type: String, enum: ['male', 'female', 'other'] },
  resultSummary: { type: String },
}, { timestamps: true });

// admissionNo and userId already indexed via unique:true in schema definition
studentProfileSchema.index({ classId: 1 });

module.exports = mongoose.model('StudentProfile', studentProfileSchema);
