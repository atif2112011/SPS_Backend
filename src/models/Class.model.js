import mongoose from 'mongoose';

const classSchema = new mongoose.Schema({
  className: { type: String, required: true, trim: true },
  section: { type: String, required: true, trim: true },
  progressionOrder: { type: Number, min: 0, default: null },
  classTeacherId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  studentIds: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  timetableId: { type: mongoose.Schema.Types.ObjectId, ref: 'Timetable', default: null },
  academicYear: { type: String, required: true, trim: true },
  isDeleted: { type: Boolean, default: false },
}, { timestamps: true });

classSchema.index({ classTeacherId: 1 });
classSchema.index({ academicYear: 1 });
classSchema.index({ progressionOrder: 1, className: 1, section: 1 });
classSchema.index({ isDeleted: 1 });
classSchema.index(
  { className: 1, section: 1, academicYear: 1 },
  { unique: true, partialFilterExpression: { isDeleted: false } }
);

export default mongoose.model('Class', classSchema);
