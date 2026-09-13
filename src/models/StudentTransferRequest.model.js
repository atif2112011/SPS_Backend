import mongoose from 'mongoose';

const studentTransferRequestSchema = new mongoose.Schema({
  studentId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  sourceClassId: { type: mongoose.Schema.Types.ObjectId, ref: 'Class', required: true },
  destinationClassId: { type: mongoose.Schema.Types.ObjectId, ref: 'Class', required: true },
  requestedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  status: {
    type: String,
    enum: ['pending', 'approved', 'rejected', 'cancelled'],
    default: 'pending',
  },
  requestNote: { type: String, trim: true, maxlength: 500 },
  decisionNote: { type: String, trim: true, maxlength: 500 },
  decidedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  decidedByRole: { type: String, enum: ['teacher', 'admin'], default: null },
  decidedAt: { type: Date, default: null },
}, { timestamps: true });

studentTransferRequestSchema.index({ destinationClassId: 1, status: 1, createdAt: -1 });
studentTransferRequestSchema.index({ sourceClassId: 1, status: 1, createdAt: -1 });
studentTransferRequestSchema.index({ requestedBy: 1, status: 1, createdAt: -1 });
studentTransferRequestSchema.index(
  { studentId: 1 },
  { unique: true, partialFilterExpression: { status: 'pending' } }
);

export default mongoose.model('StudentTransferRequest', studentTransferRequestSchema);
