import mongoose from 'mongoose';
import ROLES from '../constants/roles.js';

const metricsSchema = new mongoose.Schema({
  dueAssignments: { type: Number, default: 0, min: 0 },
  unreadNotices: { type: Number, default: 0, min: 0 },
}, { _id: false });

const userSchema = new mongoose.Schema(
  {
    role: {
      type: String,
      enum: Object.values(ROLES),
      required: true,
    },
    username: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      lowercase: true,
    },
    passwordHash: {
      type: String,
      required: true,
      select: false,
    },
    status: {
      type: String,
      enum: ['active', 'blocked', 'deleted'],
      default: 'active',
    },
    name: { type: String, required: true, trim: true },
    email: { type: String, trim: true, lowercase: true, sparse: true },
    phone: { type: String, trim: true },
    profileImage: { type: String },
    lastLoginAt: { type: Date },
    refreshTokenVersion: { type: Number, default: 0 },
    firstPasswordChange: { type: Boolean, default: true },
    metrics: { type: metricsSchema, default: () => ({}) },
  },
  { timestamps: true }
);

// username is unique; email is sparse-indexed for lookup but may be shared by family members
// Only add compound or non-schema indexes here
userSchema.index({ role: 1 });
userSchema.index({ status: 1 });

export default mongoose.model('User', userSchema);
