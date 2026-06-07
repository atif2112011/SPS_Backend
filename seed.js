import dotenv from 'dotenv';
dotenv.config();
import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import User from './src/models/User.model.js';

async function seed() {
  await mongoose.connect(process.env.MONGODB_URI);

  const usernames = ['admin_test', 'teacher_test', 'student_test', 'blocked_test'];
  await User.deleteMany({ username: { $in: usernames } });

  const hash = await bcrypt.hash('Test@1234', 12);
  await User.insertMany([
    { role: 'admin',   username: 'admin_test',   passwordHash: hash, name: 'Test Admin',   status: 'active' },
    { role: 'teacher', username: 'teacher_test', passwordHash: hash, name: 'Test Teacher', status: 'active' },
    { role: 'student', username: 'student_test', passwordHash: hash, name: 'Test Student', status: 'active' },
    { role: 'admin',   username: 'blocked_test', passwordHash: hash, name: 'Blocked User', status: 'blocked' },
  ]);

  console.log('Seeded: admin_test, teacher_test, student_test, blocked_test | password: Test@1234');
  await mongoose.disconnect();
}

seed().catch(console.error);
