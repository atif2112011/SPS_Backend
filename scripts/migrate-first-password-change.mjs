import dotenv from 'dotenv';
import connectDB from '../src/config/db.js';
import User from '../src/models/User.model.js';

dotenv.config();
await connectDB();

const result = await User.updateMany(
  { firstPasswordChange: { $exists: false } },
  { $set: { firstPasswordChange: true } }
);

console.log(JSON.stringify({
  matched: result.matchedCount,
  updated: result.modifiedCount,
}));
process.exit(0);
