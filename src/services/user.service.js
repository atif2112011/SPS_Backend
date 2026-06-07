import User from '../models/User.model.js';
import StudentProfile from '../models/StudentProfile.model.js';
import TeacherProfile from '../models/TeacherProfile.model.js';
import { hashPassword } from '../utils/hashUtils.js';
import { parsePagination, buildPaginationMeta } from '../utils/paginationHelper.js';
import ERROR_CODES from '../constants/errorCodes.js';

/** Helper: throw a structured app error */
const appError = (message, statusCode, errorCode) => {
  const err = new Error(message);
  err.statusCode = statusCode;
  err.errorCode = errorCode;
  return err;
};

/**
 * Create a student user + profile in a single operation.
 * Rolls back user if profile creation fails.
 */
const createStudent = async (data) => {
  const { username, password, name, email, phone, admissionNo, rollNo, section, dob, guardianName, guardianPhone, address, gender } = data;

  const existing = await User.findOne({ username });
  if (existing) throw appError('Username already taken', 409, ERROR_CODES.DUPLICATE_ENTRY);

  const existingAdmission = await StudentProfile.findOne({ admissionNo });
  if (existingAdmission) throw appError('Admission number already in use', 409, ERROR_CODES.DUPLICATE_ENTRY);

  const passwordHash = await hashPassword(password);
  const user = await User.create({ role: 'student', username, passwordHash, name, email: email || undefined, phone, status: 'active' });

  try {
    const profile = await StudentProfile.create({
      userId: user._id, admissionNo, rollNo, section,
      dob: dob ? new Date(dob) : undefined,
      guardianName, guardianPhone, address, gender,
    });
    return { user, profile };
  } catch (err) {
    await User.findByIdAndDelete(user._id); // rollback
    throw err;
  }
};

/**
 * Create a teacher user + profile.
 */
const createTeacher = async (data) => {
  const { username, password, name, email, phone, employeeId, subjects, qualification, joiningDate } = data;

  const existing = await User.findOne({ username });
  if (existing) throw appError('Username already taken', 409, ERROR_CODES.DUPLICATE_ENTRY);

  const existingEmployee = await TeacherProfile.findOne({ employeeId });
  if (existingEmployee) throw appError('Employee ID already in use', 409, ERROR_CODES.DUPLICATE_ENTRY);

  const passwordHash = await hashPassword(password);
  const user = await User.create({ role: 'teacher', username, passwordHash, name, email: email || undefined, phone, status: 'active' });

  try {
    const profile = await TeacherProfile.create({
      userId: user._id, employeeId,
      subjects: subjects || [],
      qualification,
      joiningDate: joiningDate ? new Date(joiningDate) : undefined,
    });
    return { user, profile };
  } catch (err) {
    await User.findByIdAndDelete(user._id);
    throw err;
  }
};

/**
 * List users with pagination, search, filter by status/role.
 */
const listUsers = async (query, roleFilter = null) => {
  const { page, limit, skip, sortBy, sortOrder } = parsePagination(query);
  const { search, status } = query;

  const filter = { status: { $ne: 'deleted' } };
  if (roleFilter) filter.role = roleFilter;
  if (status) filter.status = status;
  if (search) {
    filter.$or = [
      { name: { $regex: search, $options: 'i' } },
      { username: { $regex: search, $options: 'i' } },
      { email: { $regex: search, $options: 'i' } },
    ];
  }

  const [users, total] = await Promise.all([
    User.find(filter).sort({ [sortBy]: sortOrder }).skip(skip).limit(limit),
    User.countDocuments(filter),
  ]);

  return { users, pagination: buildPaginationMeta(total, page, limit) };
};

/**
 * Get a single user by ID with their profile.
 */
const getUserById = async (userId) => {
  const user = await User.findOne({ _id: userId, status: { $ne: 'deleted' } });
  if (!user) throw appError('User not found', 404, ERROR_CODES.NOT_FOUND);

  let profile = null;
  if (user.role === 'student') {
    profile = await StudentProfile.findOne({ userId });
  } else if (user.role === 'teacher') {
    profile = await TeacherProfile.findOne({ userId });
  }

  return { user, profile };
};

/**
 * Update student core fields + profile fields.
 */
const updateStudent = async (userId, data) => {
  const { name, email, phone, rollNo, section, dob, guardianName, guardianPhone, address, gender, resultSummary } = data;

  const user = await User.findOne({ _id: userId, role: 'student', status: { $ne: 'deleted' } });
  if (!user) throw appError('Student not found', 404, ERROR_CODES.NOT_FOUND);

  const userUpdates = {};
  if (name)  userUpdates.name  = name;
  if (email) userUpdates.email = email;
  if (phone) userUpdates.phone = phone;

  const profileUpdates = {};
  if (rollNo        !== undefined) profileUpdates.rollNo        = rollNo;
  if (section       !== undefined) profileUpdates.section       = section;
  if (dob           !== undefined) profileUpdates.dob           = new Date(dob);
  if (guardianName  !== undefined) profileUpdates.guardianName  = guardianName;
  if (guardianPhone !== undefined) profileUpdates.guardianPhone = guardianPhone;
  if (address       !== undefined) profileUpdates.address       = address;
  if (gender        !== undefined) profileUpdates.gender        = gender;
  if (resultSummary !== undefined) profileUpdates.resultSummary = resultSummary;

  const [updatedUser, updatedProfile] = await Promise.all([
    Object.keys(userUpdates).length ? User.findByIdAndUpdate(userId, userUpdates, { returnDocument: 'after' }) : user,
    Object.keys(profileUpdates).length ? StudentProfile.findOneAndUpdate({ userId }, profileUpdates, { returnDocument: 'after', upsert: true }) : StudentProfile.findOne({ userId }),
  ]);

  return { user: updatedUser, profile: updatedProfile };
};

/**
 * Update teacher core fields + profile fields.
 */
const updateTeacher = async (userId, data) => {
  const { name, email, phone, subjects, qualification, joiningDate } = data;

  const user = await User.findOne({ _id: userId, role: 'teacher', status: { $ne: 'deleted' } });
  if (!user) throw appError('Teacher not found', 404, ERROR_CODES.NOT_FOUND);

  const userUpdates = {};
  if (name)  userUpdates.name  = name;
  if (email) userUpdates.email = email;
  if (phone) userUpdates.phone = phone;

  const profileUpdates = {};
  if (subjects      !== undefined) profileUpdates.subjects      = subjects;
  if (qualification !== undefined) profileUpdates.qualification = qualification;
  if (joiningDate   !== undefined) profileUpdates.joiningDate   = new Date(joiningDate);

  const [updatedUser, updatedProfile] = await Promise.all([
    Object.keys(userUpdates).length ? User.findByIdAndUpdate(userId, userUpdates, { returnDocument: 'after' }) : user,
    Object.keys(profileUpdates).length ? TeacherProfile.findOneAndUpdate({ userId }, profileUpdates, { returnDocument: 'after', upsert: true }) : TeacherProfile.findOne({ userId }),
  ]);

  return { user: updatedUser, profile: updatedProfile };
};

/**
 * Soft-delete a user (set status to deleted).
 * Does NOT remove profile records.
 */
const deleteUser = async (userId) => {
  const user = await User.findOne({ _id: userId, status: { $ne: 'deleted' } });
  if (!user) throw appError('User not found', 404, ERROR_CODES.NOT_FOUND);
  await User.findByIdAndUpdate(userId, { status: 'deleted' });
};

/**
 * Block a user account.
 */
const blockUser = async (userId) => {
  const user = await User.findOne({ _id: userId, status: { $ne: 'deleted' } });
  if (!user) throw appError('User not found', 404, ERROR_CODES.NOT_FOUND);
  if (user.status === 'blocked') throw appError('User is already blocked', 400, ERROR_CODES.DUPLICATE_ENTRY);
  await User.findByIdAndUpdate(userId, { status: 'blocked' });
};

/**
 * Unblock a user account.
 */
const unblockUser = async (userId) => {
  const user = await User.findOne({ _id: userId, status: 'blocked' });
  if (!user) throw appError('User not found or not blocked', 404, ERROR_CODES.NOT_FOUND);
  await User.findByIdAndUpdate(userId, { status: 'active' });
};

export { createStudent, createTeacher, listUsers, getUserById, updateStudent, updateTeacher, deleteUser, blockUser, unblockUser };
export default { createStudent, createTeacher, listUsers, getUserById, updateStudent, updateTeacher, deleteUser, blockUser, unblockUser };
