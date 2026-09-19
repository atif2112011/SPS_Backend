import dotenv from 'dotenv';
import connectDB from '../src/config/db.js';
import Result from '../src/models/Result.model.js';
import Assessment from '../src/models/Assessment.model.js';

dotenv.config();
await connectDB();
const cursor = Result.find({}).cursor();
let migrated = 0; let skipped = 0;
for await (const result of cursor) {
  const existing = await Assessment.findOne({ legacyResultId: result._id }).select('_id');
  if (existing) { skipped += 1; continue; }
  await Assessment.create({
    studentId: result.studentId, classId: result.classId, title: result.examName, category: 'academic_assessment',
    eventDate: result.createdAt || new Date(), academicYear: result.academicYear, subjectMarks: result.subjectMarks || [],
    overallGrade: result.overallGrade, rank: result.rank, remarks: result.remarks, createdBy: result.createdBy,
    isDeleted: result.isDeleted, legacyResultId: result._id, createdAt: result.createdAt, updatedAt: result.updatedAt,
  });
  migrated += 1;
}
console.log(JSON.stringify({ migrated, skipped }));
process.exit(0);
