import User from '../models/User.model.js';
import RefreshToken from '../models/RefreshToken.model.js';
import { hashPassword } from '../utils/hashUtils.js';
import { buildStudentPassword } from '../utils/studentCredentials.js';
import ERROR_CODES from '../constants/errorCodes.js';

const appError = (message, statusCode, errorCode) => {
  const err = new Error(message);
  err.statusCode = statusCode;
  err.errorCode = errorCode;
  return err;
};

const resetStudentPassword = async (studentId) => {
  const student = await User.findOne({
    _id: studentId,
    role: 'student',
    status: { $ne: 'deleted' },
  }).select('name username');

  if (!student) {
    throw appError('Student not found', 404, ERROR_CODES.NOT_FOUND);
  }

  const password = buildStudentPassword(student.name);
  const passwordHash = await hashPassword(password);
  const updatedStudent = await User.findOneAndUpdate(
    { _id: studentId, role: 'student', status: { $ne: 'deleted' } },
    {
      $set: { passwordHash, firstPasswordChange: false },
      $inc: { refreshTokenVersion: 1 },
    },
    { returnDocument: 'after' }
  ).select('name username firstPasswordChange');

  if (!updatedStudent) {
    throw appError('Student not found', 404, ERROR_CODES.NOT_FOUND);
  }

  await RefreshToken.updateMany(
    { userId: studentId, revokedAt: null },
    { $set: { revokedAt: new Date() } }
  );

  return {
    studentId: updatedStudent._id,
    studentName: updatedStudent.name,
    username: updatedStudent.username,
    password,
    firstPasswordChange: false,
  };
};

export { resetStudentPassword };
export default { resetStudentPassword };
