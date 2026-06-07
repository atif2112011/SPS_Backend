import mongoose from 'mongoose';
import ROLES from '../constants/roles.js';

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
  },
  { timestamps: true }
);

// username and email are already indexed via unique:true / sparse:true in schema definition
// Only add compound or non-schema indexes here
userSchema.index({ role: 1 });
userSchema.index({ status: 1 });

export default mongoose.model('User', userSchema);
