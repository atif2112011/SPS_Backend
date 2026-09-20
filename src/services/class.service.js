import mongoose from 'mongoose';
import Class from '../models/Class.model.js';
import User from '../models/User.model.js';
import StudentProfile from '../models/StudentProfile.model.js';
import TeacherProfile from '../models/TeacherProfile.model.js';
import { parsePagination, buildPaginationMeta, buildSearchRegex } from '../utils/paginationHelper.js';
import ERROR_CODES from '../constants/errorCodes.js';

const appError = (message, statusCode, errorCode) => {
  const err = new Error(message);
  err.statusCode = statusCode;
  err.errorCode = errorCode;
  return err;
};

/**
 * Create a new class.
 */
const createClass = async (data) => {
  const { className, section, academicYear, progressionOrder, classTeacherId } = data;

  // Check for duplicate class+section+year
  const existing = await Class.findOne({ className, section, academicYear, isDeleted: false });
  if (existing) throw appError('Class with this name, section, and academic year already exists', 409, ERROR_CODES.DUPLICATE_ENTRY);

  const classDoc = await Class.create({ className, section, academicYear, progressionOrder, classTeacherId: classTeacherId || null });

  // If teacher assigned, update their profile
  if (classTeacherId) {
    await TeacherProfile.findOneAndUpdate({ userId: classTeacherId }, { assignedClassId: classDoc._id });
  }

  return classDoc;
};

/**
 * List classes with pagination and search.
 */
const listClasses = async (query) => {
  const { page, limit, skip, sortBy, sortOrder } = parsePagination(query, ['className', 'section', 'academicYear', 'progressionOrder', 'createdAt']);
  const { search, academicYear } = query;

  const filter = { isDeleted: false };
  if (academicYear) filter.academicYear = academicYear;
  if (search) {
    const searchRegex = buildSearchRegex(search);
    filter.$or = [
      { className: searchRegex },
      { section: searchRegex },
      { academicYear: searchRegex },
    ];
  }

  const [classes, total] = await Promise.all([
    Class.find(filter)
      .populate('classTeacherId', 'name username')
      .sort({ [sortBy]: sortOrder })
      .skip(skip)
      .limit(limit),
    Class.countDocuments(filter),
  ]);

  return { classes, pagination: buildPaginationMeta(total, page, limit) };
};

/**
 * Get a class by ID with teacher populated.
 */
const getClassById = async (classId) => {
  const classDoc = await Class.findOne({ _id: classId, isDeleted: false })
    .populate('classTeacherId', 'name username email');
  if (!classDoc) throw appError('Class not found', 404, ERROR_CODES.NOT_FOUND);
  return classDoc;
};

/**
 * Update class metadata.
 */
const updateClass = async (classId, data) => {
  const classDoc = await Class.findOne({ _id: classId, isDeleted: false });
  if (!classDoc) throw appError('Class not found', 404, ERROR_CODES.NOT_FOUND);

  Object.assign(classDoc, data);
  await classDoc.save();
  return classDoc;
};

/**
 * Soft-delete a class.
 * Unlinks all students from the class (preserves their profiles).
 */
const deleteClass = async (classId) => {
  const classDoc = await Class.findOne({ _id: classId, isDeleted: false });
  if (!classDoc) throw appError('Class not found', 404, ERROR_CODES.NOT_FOUND);

  // Unlink students from this class
  await StudentProfile.updateMany({ classId }, { classId: null });

  // Unlink teacher from this class
  if (classDoc.classTeacherId) {
    await TeacherProfile.findOneAndUpdate({ userId: classDoc.classTeacherId }, { assignedClassId: null });
  }

  classDoc.isDeleted = true;
  classDoc.studentIds = [];
  classDoc.classTeacherId = null;
  await classDoc.save();
};

/**
 * Add or remove students from a class.
 * action: 'add' | 'remove'
 * studentIds: array of user ObjectId strings
 */
const manageMembers = async (classId, action, studentIds) => {
  const uniqueStudentIds = [...new Set(studentIds.map(String))];
  const session = await mongoose.startSession();
  let result;
  try {
    await session.withTransaction(async () => {
      const classDoc = await Class.findOne({ _id: classId, isDeleted: false }).session(session);
      if (!classDoc) throw appError('Class not found', 404, ERROR_CODES.NOT_FOUND);

      const students = await User.find({ _id: { $in: uniqueStudentIds }, role: 'student', status: { $ne: 'deleted' } }).session(session);
      if (students.length !== uniqueStudentIds.length) {
        throw appError('One or more student IDs are invalid', 400, ERROR_CODES.VALIDATION_ERROR);
      }

      if (action === 'add') {
        const currentIds = new Set(classDoc.studentIds.map((id) => id.toString()));
        const newIds = uniqueStudentIds.filter((id) => !currentIds.has(id));
        if (newIds.length > 0) {
          await Class.updateMany(
            { _id: { $ne: classId }, studentIds: { $in: newIds }, isDeleted: false },
            { $pull: { studentIds: { $in: newIds } } },
            { session }
          );
          classDoc.studentIds.push(...newIds);
          await StudentProfile.updateMany({ userId: { $in: newIds } }, { classId }, { session });
        }
      } else {
        const removedIds = new Set(uniqueStudentIds);
        classDoc.studentIds = classDoc.studentIds.filter((id) => !removedIds.has(id.toString()));
        await StudentProfile.updateMany({ userId: { $in: uniqueStudentIds }, classId }, { classId: null }, { session });
      }

      await classDoc.save({ session });
      result = classDoc;
    });
    return result;
  } finally {
    await session.endSession();
  }
};

/**
 * Assign a teacher to a class.
 * Removes old teacher assignment first.
 */
const assignTeacher = async (classId, teacherId) => {
  const session = await mongoose.startSession();
  let result;
  try {
    await session.withTransaction(async () => {
      const classDoc = await Class.findOne({ _id: classId, isDeleted: false }).session(session);
      if (!classDoc) throw appError('Class not found', 404, ERROR_CODES.NOT_FOUND);

      const teacher = await User.findOne({ _id: teacherId, role: 'teacher', status: 'active' }).session(session);
      if (!teacher) throw appError('Teacher not found', 404, ERROR_CODES.NOT_FOUND);

      const teacherProfile = await TeacherProfile.findOne({ userId: teacherId }).session(session);
      if (!teacherProfile) throw appError('Teacher profile not found', 404, ERROR_CODES.NOT_FOUND);

      if (classDoc.classTeacherId && classDoc.classTeacherId.toString() !== teacherId.toString()) {
        await TeacherProfile.findOneAndUpdate(
          { userId: classDoc.classTeacherId },
          { assignedClassId: null },
          { session }
        );
      }

      if (teacherProfile.assignedClassId && teacherProfile.assignedClassId.toString() !== classId.toString()) {
        await Class.findByIdAndUpdate(
          teacherProfile.assignedClassId,
          { classTeacherId: null },
          { runValidators: true, session }
        );
      }

      classDoc.classTeacherId = teacherId;
      await classDoc.save({ session });
      await TeacherProfile.findOneAndUpdate(
        { userId: teacherId },
        { assignedClassId: classId },
        { runValidators: true, session }
      );
      result = classDoc;
    });
    return result;
  } finally {
    await session.endSession();
  }
};

/**
 * Get all students in a class with their profiles.
 */
const getClassStudents = async (classId) => {
  const classDoc = await Class.findOne({ _id: classId, isDeleted: false });
  if (!classDoc) throw appError('Class not found', 404, ERROR_CODES.NOT_FOUND);

  const students = await User.find({ _id: { $in: classDoc.studentIds }, status: { $ne: 'deleted' } })
    .select('-passwordHash');

  const profiles = await StudentProfile.find({ userId: { $in: classDoc.studentIds } });
  const profileMap = {};
  profiles.forEach(p => { profileMap[p.userId.toString()] = p; });

  return students.map(s => ({ user: s, profile: profileMap[s._id.toString()] || null }));
};

export { createClass, listClasses, getClassById, updateClass, deleteClass, manageMembers, assignTeacher, getClassStudents };
export default { createClass, listClasses, getClassById, updateClass, deleteClass, manageMembers, assignTeacher, getClassStudents };
