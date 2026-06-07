import Class from '../models/Class.model.js';
import User from '../models/User.model.js';
import StudentProfile from '../models/StudentProfile.model.js';
import TeacherProfile from '../models/TeacherProfile.model.js';
import { parsePagination, buildPaginationMeta } from '../utils/paginationHelper.js';
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
  const { className, section, academicYear, classTeacherId } = data;

  // Check for duplicate class+section+year
  const existing = await Class.findOne({ className, section, academicYear, isDeleted: false });
  if (existing) throw appError('Class with this name, section, and academic year already exists', 409, ERROR_CODES.DUPLICATE_ENTRY);

  const classDoc = await Class.create({ className, section, academicYear, classTeacherId: classTeacherId || null });

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
  const { page, limit, skip, sortBy, sortOrder } = parsePagination(query);
  const { search, academicYear } = query;

  const filter = { isDeleted: false };
  if (academicYear) filter.academicYear = academicYear;
  if (search) {
    filter.$or = [
      { className: { $regex: search, $options: 'i' } },
      { section: { $regex: search, $options: 'i' } },
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
  const classDoc = await Class.findOne({ _id: classId, isDeleted: false });
  if (!classDoc) throw appError('Class not found', 404, ERROR_CODES.NOT_FOUND);

  // Validate all IDs are real students
  const students = await User.find({ _id: { $in: studentIds }, role: 'student', status: { $ne: 'deleted' } });
  if (students.length !== studentIds.length) {
    throw appError('One or more student IDs are invalid', 400, ERROR_CODES.VALIDATION_ERROR);
  }

  if (action === 'add') {
    // Filter already-in-class to avoid duplicates
    const newIds = studentIds.filter(id => !classDoc.studentIds.map(s => s.toString()).includes(id.toString()));
    classDoc.studentIds.push(...newIds);
    // Update each student's classId in their profile
    await StudentProfile.updateMany({ userId: { $in: newIds } }, { classId });
  } else if (action === 'remove') {
    classDoc.studentIds = classDoc.studentIds.filter(id => !studentIds.includes(id.toString()));
    // Unlink from class in profiles
    await StudentProfile.updateMany({ userId: { $in: studentIds }, classId }, { classId: null });
  }

  await classDoc.save();
  return classDoc;
};

/**
 * Assign a teacher to a class.
 * Removes old teacher assignment first.
 */
const assignTeacher = async (classId, teacherId) => {
  const classDoc = await Class.findOne({ _id: classId, isDeleted: false });
  if (!classDoc) throw appError('Class not found', 404, ERROR_CODES.NOT_FOUND);

  const teacher = await User.findOne({ _id: teacherId, role: 'teacher', status: 'active' });
  if (!teacher) throw appError('Teacher not found', 404, ERROR_CODES.NOT_FOUND);

  // Remove previous teacher's class assignment if different
  if (classDoc.classTeacherId && classDoc.classTeacherId.toString() !== teacherId.toString()) {
    await TeacherProfile.findOneAndUpdate({ userId: classDoc.classTeacherId }, { assignedClassId: null });
  }

  classDoc.classTeacherId = teacherId;
  await classDoc.save();

  await TeacherProfile.findOneAndUpdate({ userId: teacherId }, { assignedClassId: classId }, { upsert: true });

  return classDoc;
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
