import Class from '../models/Class.model.js';
import StudentProfile from '../models/StudentProfile.model.js';
import TeacherProfile from '../models/TeacherProfile.model.js';
import ERROR_CODES from '../constants/errorCodes.js';

const appError = (message, statusCode, errorCode) => {
  const err = new Error(message);
  err.statusCode = statusCode;
  err.errorCode = errorCode;
  return err;
};

const getTeacherContext = async (teacherId, { session = null, requireClass = true } = {}) => {
  let profileQuery = TeacherProfile.findOne({ userId: teacherId });
  if (session) profileQuery = profileQuery.session(session);
  const teacherProfile = await profileQuery;

  if (!teacherProfile) {
    throw appError('Teacher profile not found', 404, ERROR_CODES.NOT_FOUND);
  }

  if (!teacherProfile.assignedClassId) {
    if (!requireClass) return { teacherProfile, classDoc: null, classId: null };
    throw appError('No active class is assigned to this teacher', 409, ERROR_CODES.NO_ASSIGNED_CLASS);
  }

  let classQuery = Class.findOne({
    _id: teacherProfile.assignedClassId,
    classTeacherId: teacherId,
    isDeleted: false,
  });
  if (session) classQuery = classQuery.session(session);
  const classDoc = await classQuery;

  if (!classDoc) {
    if (!requireClass) return { teacherProfile, classDoc: null, classId: null };
    throw appError('The assigned class is unavailable or no longer belongs to this teacher', 409, ERROR_CODES.NO_ASSIGNED_CLASS);
  }

  return { teacherProfile, classDoc, classId: classDoc._id };
};

const assertStudentBelongsToTeacher = async (studentId, teacherId, { session = null } = {}) => {
  const context = await getTeacherContext(teacherId, { session });
  let profileQuery = StudentProfile.findOne({ userId: studentId, classId: context.classId });
  if (session) profileQuery = profileQuery.session(session);
  const studentProfile = await profileQuery;

  if (!studentProfile || !context.classDoc.studentIds.some((id) => id.toString() === studentId.toString())) {
    throw appError('Student is outside the teacher assigned class', 403, ERROR_CODES.SCOPE_VIOLATION);
  }

  return { ...context, studentProfile };
};

const assertStudentsBelongToTeacher = async (studentIds, teacherId) => {
  const context = await getTeacherContext(teacherId);
  const uniqueIds = [...new Set(studentIds.map(String))];
  const matching = await StudentProfile.countDocuments({ userId: { $in: uniqueIds }, classId: context.classId });
  const classStudentIds = new Set(context.classDoc.studentIds.map(String));
  if (matching !== uniqueIds.length || uniqueIds.some((id) => !classStudentIds.has(id))) {
    throw appError('One or more students are outside the teacher assigned class', 403, ERROR_CODES.SCOPE_VIOLATION);
  }
  return context;
};

export { getTeacherContext, assertStudentBelongsToTeacher, assertStudentsBelongToTeacher };
export default { getTeacherContext, assertStudentBelongsToTeacher, assertStudentsBelongToTeacher };
