require('dotenv').config();
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

async function seed() {
  await mongoose.connect(process.env.MONGODB_URI);
  const User = require('./src/models/User.model');

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
