import mongoose from 'mongoose';

const periodSchema = new mongoose.Schema({
  startTime: String,
  endTime: String,
  subject: String,
  teacherName: String,
  room: String,
}, { _id: false });

const dayScheduleSchema = new mongoose.Schema({
  day: { type: String, enum: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'] },
  periods: [periodSchema],
}, { _id: false });

const timetableSchema = new mongoose.Schema({
  classId: { type: mongoose.Schema.Types.ObjectId, ref: 'Class', required: true, unique: true },
  schedule: [dayScheduleSchema],
  updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
}, { timestamps: true });

// classId unique index is already defined on the field itself above

export default mongoose.model('Timetable', timetableSchema);
