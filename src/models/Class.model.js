import mongoose from 'mongoose';

const classSchema = new mongoose.Schema({
  className: { type: String, required: true, trim: true },
  section: { type: String, required: true, trim: true },
  classTeacherId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  studentIds: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  timetableId: { type: mongoose.Schema.Types.ObjectId, ref: 'Timetable', default: null },
  academicYear: { type: String, required: true, trim: true },
  isDeleted: { type: Boolean, default: false },
}, { timestamps: true });

classSchema.index({ classTeacherId: 1 });
classSchema.index({ academicYear: 1 });
classSchema.index({ isDeleted: 1 });

export default mongoose.model('Class', classSchema);
