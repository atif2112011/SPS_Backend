const mongoose = require('mongoose');

const teacherProfileSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
  employeeId: { type: String, required: true, unique: true, trim: true },
  assignedClassId: { type: mongoose.Schema.Types.ObjectId, ref: 'Class', default: null },
  subjects: [{ type: String, trim: true }],
  qualification: { type: String, trim: true },
  joiningDate: { type: Date },
}, { timestamps: true });

teacherProfileSchema.index({ assignedClassId: 1 });

module.exports = mongoose.model('TeacherProfile', teacherProfileSchema);
