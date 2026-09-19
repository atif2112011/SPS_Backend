import mongoose from 'mongoose';
import Assignment from '../models/Assignment.model.js';
import Class from '../models/Class.model.js';
import Notice from '../models/Notice.model.js';
import ReportCard from '../models/ReportCard.model.js';
import Assessment from '../models/Assessment.model.js';
import StudentProfile from '../models/StudentProfile.model.js';
import StudentTransferRequest from '../models/StudentTransferRequest.model.js';
import Timetable from '../models/Timetable.model.js';
import User from '../models/User.model.js';
import { hashPassword } from '../utils/hashUtils.js';
import { buildPaginationMeta, buildSearchRegex, parsePagination } from '../utils/paginationHelper.js';
import ERROR_CODES from '../constants/errorCodes.js';
import { assertStudentBelongsToTeacher, getTeacherContext } from './teacherContext.service.js';

const appError = (message, statusCode, errorCode) => {
  const err = new Error(message);
  err.statusCode = statusCode;
  err.errorCode = errorCode;
  return err;
};

const objectId = (value) => new mongoose.Types.ObjectId(value);

const transferPerson = (person) => person ? {
  _id: person._id,
  name: person.name,
  username: person.username,
  ...(person.role ? { role: person.role } : {}),
  ...(person.status ? { status: person.status } : {}),
  ...(person.phone ? { phone: person.phone } : {}),
} : null;

const transferClass = (classDoc) => classDoc ? {
  _id: classDoc._id,
  className: classDoc.className,
  section: classDoc.section,
  academicYear: classDoc.academicYear,
  progressionOrder: classDoc.progressionOrder,
  teacher: transferPerson(classDoc.classTeacherId),
} : null;

const normalizeTransferRequest = (request) => {
  if (!request) return null;
  const student = transferPerson(request.studentId);
  const sourceClass = transferClass(request.sourceClassId);
  const destinationClass = transferClass(request.destinationClassId);
  const requester = transferPerson(request.requestedBy);
  return {
  _id: request._id,
  student,
  sourceClass,
  destinationClass,
  requester,
  // Preserve the original populated keys for existing Admin clients.
  studentId: student,
  sourceClassId: sourceClass,
  destinationClassId: destinationClass,
  requestedBy: requester,
  decidedBy: transferPerson(request.decidedBy),
  decidedByRole: request.decidedByRole || null,
  status: request.status,
  requestNote: request.requestNote || '',
  decisionNote: request.decisionNote || '',
  createdAt: request.createdAt,
  updatedAt: request.updatedAt,
  decidedAt: request.decidedAt || null,
  };
};

const createStudent = async (teacherId, data) => {
  const { classDoc } = await getTeacherContext(teacherId);
  const passwordHash = await hashPassword(data.password);
  const session = await mongoose.startSession();
  let result;

  try {
    await session.withTransaction(async () => {
      const [user] = await User.create([{
        role: 'student',
        username: data.username,
        passwordHash,
        name: data.name,
        phone: data.phone,
        status: 'active',
      }], { session });

      const [profile] = await StudentProfile.create([{
        userId: user._id,
        admissionNo: data.admissionNo,
        rollNo: data.rollNo,
        classId: classDoc._id,
        section: classDoc.section,
        dob: data.dob ? new Date(data.dob) : undefined,
        guardianName: data.guardianName,
        guardianPhone: data.guardianPhone,
        address: data.address,
        gender: data.gender,
      }], { session });

      const membership = await Class.updateOne(
        { _id: classDoc._id, classTeacherId: teacherId, isDeleted: false },
        { $addToSet: { studentIds: user._id } },
        { session }
      );
      if (membership.matchedCount !== 1) {
        throw appError('The assigned class changed while creating the student', 409, ERROR_CODES.SCOPE_VIOLATION);
      }
      result = { user: user.toObject(), profile: profile.toObject() };
    });
    return result;
  } finally {
    await session.endSession();
  }
};

const listStudents = async (teacherId, query) => {
  const { classDoc, classId } = await getTeacherContext(teacherId);
  const { page, limit, skip } = parsePagination(query);
  const search = query.search ? buildSearchRegex(query.search) : null;
  const sortFields = {
    name: 'user.name',
    username: 'user.username',
    status: 'user.status',
    admissionNo: 'admissionNo',
    rollNo: 'rollNo',
    createdAt: 'createdAt',
  };
  const sortBy = sortFields[query.sortBy] || 'user.name';
  const sortOrder = query.sortOrder === 'desc' ? -1 : 1;
  const match = {
    classId: objectId(classId),
    userId: { $in: classDoc.studentIds },
    ...(query.gender ? { gender: query.gender } : {}),
  };

  const pipeline = [
    { $match: match },
    { $lookup: { from: 'users', localField: 'userId', foreignField: '_id', as: 'user' } },
    { $unwind: '$user' },
    { $match: {
      'user.role': 'student',
      'user.status': query.status || { $ne: 'deleted' },
      ...(search ? { $or: [
        { 'user.name': search },
        { 'user.username': search },
        { 'user.phone': search },
        { admissionNo: search },
        { rollNo: search },
        { guardianName: search },
        { guardianPhone: search },
      ] } : {}),
    } },
    { $sort: { [sortBy]: sortOrder, _id: 1 } },
    { $facet: {
      rows: [
        { $skip: skip },
        { $limit: limit },
        { $project: {
          _id: 0,
          user: {
            _id: '$user._id', role: '$user.role', username: '$user.username', name: '$user.name',
            phone: '$user.phone', profileImage: '$user.profileImage', status: '$user.status',
            createdAt: '$user.createdAt', updatedAt: '$user.updatedAt',
          },
          profile: {
            _id: '$_id', userId: '$userId', admissionNo: '$admissionNo', rollNo: '$rollNo',
            classId: '$classId', section: '$section', dob: '$dob', guardianName: '$guardianName',
            guardianPhone: '$guardianPhone', address: '$address', gender: '$gender',
            createdAt: '$createdAt', updatedAt: '$updatedAt',
          },
        } },
      ],
      count: [{ $count: 'total' }],
    } },
  ];

  const [result] = await StudentProfile.aggregate(pipeline);
  const total = result?.count?.[0]?.total || 0;
  return { students: result?.rows || [], pagination: buildPaginationMeta(total, page, limit) };
};

const getStudent = async (teacherId, studentId) => {
  const { studentProfile } = await assertStudentBelongsToTeacher(studentId, teacherId);
  const user = await User.findOne({ _id: studentId, role: 'student', status: { $ne: 'deleted' } });
  if (!user) throw appError('Student not found', 404, ERROR_CODES.NOT_FOUND);
  const [pendingTransfer, reportCards, assessments, targetedAssignments, targetedNotices] = await Promise.all([
    StudentTransferRequest.findOne({ studentId, status: 'pending' })
      .populate('studentId', 'name username status phone')
      .populate({ path: 'sourceClassId', select: 'className section academicYear progressionOrder classTeacherId', populate: { path: 'classTeacherId', select: 'name username' } })
      .populate({ path: 'destinationClassId', select: 'className section academicYear progressionOrder classTeacherId', populate: { path: 'classTeacherId', select: 'name username' } })
      .populate('requestedBy', 'name username')
      .lean(),
    ReportCard.countDocuments({ studentId, isDeleted: false }),
    Assessment.countDocuments({ studentId, isDeleted: false }),
    Assignment.countDocuments({ studentIds: studentId, status: 'active', isDeleted: false }),
    Notice.countDocuments({ studentIds: studentId, audienceType: 'specific_students', status: 'active', isDeleted: false }),
  ]);
  return {
    user,
    profile: studentProfile,
    summary: { reportCards, assessments, targetedAssignments, targetedNotices },
    pendingTransfer: normalizeTransferRequest(pendingTransfer),
  };
};

const updateStudent = async (teacherId, studentId, data) => {
  await assertStudentBelongsToTeacher(studentId, teacherId);
  const userUpdates = {};
  if (data.name !== undefined) userUpdates.name = data.name;
  if (data.phone !== undefined) userUpdates.phone = data.phone;

  const profileUpdates = {};
  for (const field of ['rollNo', 'guardianName', 'guardianPhone', 'address', 'gender']) {
    if (data[field] !== undefined) profileUpdates[field] = data[field];
  }
  if (data.dob !== undefined) profileUpdates.dob = data.dob ? new Date(data.dob) : null;

  const [user, profile] = await Promise.all([
    Object.keys(userUpdates).length
      ? User.findByIdAndUpdate(studentId, userUpdates, { returnDocument: 'after', runValidators: true })
      : User.findById(studentId),
    Object.keys(profileUpdates).length
      ? StudentProfile.findOneAndUpdate({ userId: studentId }, profileUpdates, { returnDocument: 'after', runValidators: true })
      : StudentProfile.findOne({ userId: studentId }),
  ]);
  return { user, profile };
};

const setStudentBlocked = async (teacherId, studentId, blocked) => {
  await assertStudentBelongsToTeacher(studentId, teacherId);
  const expectedStatus = blocked ? 'active' : 'blocked';
  const nextStatus = blocked ? 'blocked' : 'active';
  const user = await User.findOneAndUpdate(
    { _id: studentId, role: 'student', status: expectedStatus },
    { status: nextStatus },
    { returnDocument: 'after', runValidators: true }
  );
  if (!user) {
    throw appError(
      blocked ? 'Student is not active or is already blocked' : 'Student is not blocked',
      409,
      ERROR_CODES.DUPLICATE_ENTRY
    );
  }
  return user;
};

const removeStudent = async (teacherId, studentId) => {
  const session = await mongoose.startSession();
  try {
    await session.withTransaction(async () => {
      const { classId } = await assertStudentBelongsToTeacher(studentId, teacherId, { session });
      const classUpdate = await Class.updateOne(
        { _id: classId, classTeacherId: teacherId, studentIds: studentId, isDeleted: false },
        { $pull: { studentIds: studentId } },
        { session }
      );
      const profileUpdate = await StudentProfile.updateOne(
        { userId: studentId, classId },
        { $set: { classId: null } },
        { session }
      );
      if (classUpdate.modifiedCount !== 1 || profileUpdate.modifiedCount !== 1) {
        throw appError('Student class membership changed during removal', 409, ERROR_CODES.TRANSFER_CONFLICT);
      }
      await StudentTransferRequest.updateMany(
        { studentId, status: 'pending' },
        { $set: { status: 'cancelled', decidedAt: new Date() } },
        { session }
      );
    });
  } finally {
    await session.endSession();
  }
};

const getTransferDestinations = async (teacherId) => {
  const { classDoc } = await getTeacherContext(teacherId);
  if (!Number.isFinite(classDoc.progressionOrder)) {
    throw appError('Progression order is not configured for the assigned class', 409, ERROR_CODES.TRANSFER_CONFLICT);
  }
  return Class.find({
    _id: { $ne: classDoc._id },
    progressionOrder: { $gt: classDoc.progressionOrder },
    isDeleted: false,
  })
    .select('className section academicYear progressionOrder classTeacherId')
    .populate('classTeacherId', 'name username')
    .sort({ progressionOrder: 1, className: 1, section: 1 });
};

const requestTransfer = async (teacherId, studentId, data) => {
  const { classDoc } = await assertStudentBelongsToTeacher(studentId, teacherId);
  if (!Number.isFinite(classDoc.progressionOrder)) {
    throw appError('Progression order is not configured for the assigned class', 409, ERROR_CODES.TRANSFER_CONFLICT);
  }
  const destination = await Class.findOne({
    _id: data.destinationClassId,
    isDeleted: false,
    progressionOrder: { $gt: classDoc.progressionOrder },
  });
  if (!destination) {
    throw appError('Destination must be an available higher class', 400, ERROR_CODES.VALIDATION_ERROR);
  }
  const pending = await StudentTransferRequest.findOne({ studentId, status: 'pending' });
  if (pending) throw appError('A pending transfer request already exists for this student', 409, ERROR_CODES.DUPLICATE_ENTRY);

  return StudentTransferRequest.create({
    studentId,
    sourceClassId: classDoc._id,
    destinationClassId: destination._id,
    requestedBy: teacherId,
    requestNote: data.requestNote,
  });
};

const buildTransferPipeline = ({ scope = {}, query = {} }) => {
  const { page, limit, skip } = parsePagination(query);
  const search = query.search ? buildSearchRegex(query.search) : null;
  const sortFields = {
    createdAt: 'createdAt',
    status: 'status',
    studentName: 'student.name',
    sourceClass: 'sourceClass.className',
    destinationClass: 'destinationClass.className',
  };
  const sortBy = sortFields[query.sortBy] || 'createdAt';
  const sortOrder = query.sortOrder === 'asc' ? 1 : -1;
  const initialMatch = {
    ...scope,
    ...(query.status ? { status: query.status } : {}),
    ...(query.sourceClassId ? { sourceClassId: objectId(query.sourceClassId) } : {}),
    ...(query.destinationClassId ? { destinationClassId: objectId(query.destinationClassId) } : {}),
  };
  if (query.dateFrom || query.dateTo) {
    initialMatch.createdAt = {};
    if (query.dateFrom) initialMatch.createdAt.$gte = new Date(`${query.dateFrom}T00:00:00.000Z`);
    if (query.dateTo) initialMatch.createdAt.$lte = new Date(`${query.dateTo}T23:59:59.999Z`);
  }

  return { page, limit, pipeline: [
    { $match: initialMatch },
    { $lookup: { from: 'users', localField: 'studentId', foreignField: '_id', as: 'student' } },
    { $unwind: '$student' },
    { $lookup: { from: 'classes', localField: 'sourceClassId', foreignField: '_id', as: 'sourceClass' } },
    { $unwind: '$sourceClass' },
    { $lookup: { from: 'classes', localField: 'destinationClassId', foreignField: '_id', as: 'destinationClass' } },
    { $unwind: '$destinationClass' },
    { $lookup: { from: 'users', localField: 'requestedBy', foreignField: '_id', as: 'requester' } },
    { $unwind: '$requester' },
    ...(search ? [{ $match: { $or: [
      { 'student.name': search }, { 'student.username': search },
      { 'sourceClass.className': search }, { 'sourceClass.section': search },
      { 'destinationClass.className': search }, { 'destinationClass.section': search },
      { 'requester.name': search },
    ] } }] : []),
    { $sort: { [sortBy]: sortOrder, _id: -1 } },
    { $facet: {
      rows: [{ $skip: skip }, { $limit: limit }, { $project: {
        student: { _id: '$student._id', name: '$student.name', username: '$student.username', status: '$student.status' },
        sourceClass: { _id: '$sourceClass._id', className: '$sourceClass.className', section: '$sourceClass.section', academicYear: '$sourceClass.academicYear' },
        destinationClass: { _id: '$destinationClass._id', className: '$destinationClass.className', section: '$destinationClass.section', academicYear: '$destinationClass.academicYear' },
        requester: { _id: '$requester._id', name: '$requester.name', username: '$requester.username' },
        status: 1, requestNote: 1, decisionNote: 1, decidedBy: 1, decidedByRole: 1, decidedAt: 1, createdAt: 1, updatedAt: 1,
      } }],
      count: [{ $count: 'total' }],
    } },
  ] };
};

const listTransferRequests = async (actor, query, { admin = false } = {}) => {
  let scope = {};
  if (!admin) {
    const { classId } = await getTeacherContext(actor.userId);
    scope = query.direction === 'sent'
      ? { requestedBy: objectId(actor.userId) }
      : { destinationClassId: objectId(classId) };
  }
  const { page, limit, pipeline } = buildTransferPipeline({ scope, query });
  const [result] = await StudentTransferRequest.aggregate(pipeline);
  const total = result?.count?.[0]?.total || 0;
  return { requests: result?.rows || [], pagination: buildPaginationMeta(total, page, limit) };
};

const getTransferRequest = async (actor, requestId, { admin = false } = {}) => {
  const request = await StudentTransferRequest.findById(requestId)
    .populate('studentId', 'name username status phone')
    .populate({
      path: 'sourceClassId',
      select: 'className section academicYear progressionOrder classTeacherId',
      populate: { path: 'classTeacherId', select: 'name username' },
    })
    .populate({
      path: 'destinationClassId',
      select: 'className section academicYear progressionOrder classTeacherId',
      populate: { path: 'classTeacherId', select: 'name username' },
    })
    .populate('requestedBy', 'name username')
    .populate('decidedBy', 'name username role')
    .lean();
  if (!request) throw appError('Transfer request not found', 404, ERROR_CODES.NOT_FOUND);
  if (!admin) {
    const { classId } = await getTeacherContext(actor.userId);
    const canView = request.requestedBy?._id?.toString() === actor.userId.toString()
      || request.destinationClassId?._id?.toString() === classId.toString();
    if (!canView) throw appError('Transfer request is outside the teacher scope', 403, ERROR_CODES.SCOPE_VIOLATION);
  }
  return normalizeTransferRequest(request);
};

const approveTransfer = async (actor, requestId, decisionNote = '', { admin = false } = {}) => {
  const session = await mongoose.startSession();
  let approved;
  try {
    await session.withTransaction(async () => {
      const request = await StudentTransferRequest.findOne({ _id: requestId, status: 'pending' }).session(session);
      if (!request) throw appError('Pending transfer request not found', 409, ERROR_CODES.TRANSFER_CONFLICT);

      const [sourceClass, destinationClass, profile] = await Promise.all([
        Class.findOne({ _id: request.sourceClassId, isDeleted: false }).session(session),
        Class.findOne({ _id: request.destinationClassId, isDeleted: false }).session(session),
        StudentProfile.findOne({ userId: request.studentId }).session(session),
      ]);
      if (!sourceClass || !destinationClass || !profile
        || profile.classId?.toString() !== sourceClass._id.toString()
        || !sourceClass.studentIds.some((id) => id.toString() === request.studentId.toString())
        || destinationClass.studentIds.some((id) => id.toString() === request.studentId.toString())
        || !Number.isFinite(sourceClass.progressionOrder)
        || !Number.isFinite(destinationClass.progressionOrder)
        || destinationClass.progressionOrder <= sourceClass.progressionOrder) {
        throw appError('Transfer request is stale or no longer eligible', 409, ERROR_CODES.TRANSFER_CONFLICT);
      }
      if (!admin && destinationClass.classTeacherId?.toString() !== actor.userId.toString()) {
        throw appError('Only the destination teacher or an administrator can approve this request', 403, ERROR_CODES.SCOPE_VIOLATION);
      }

      const sourceUpdate = await Class.updateOne(
        { _id: sourceClass._id, studentIds: request.studentId },
        { $pull: { studentIds: request.studentId } },
        { session }
      );
      const destinationUpdate = await Class.updateOne(
        { _id: destinationClass._id, isDeleted: false, studentIds: { $ne: request.studentId } },
        { $addToSet: { studentIds: request.studentId } },
        { session }
      );
      const profileUpdate = await StudentProfile.updateOne(
        { userId: request.studentId, classId: sourceClass._id },
        { $set: { classId: destinationClass._id, section: destinationClass.section } },
        { session }
      );
      if (sourceUpdate.modifiedCount !== 1 || destinationUpdate.modifiedCount !== 1 || profileUpdate.modifiedCount !== 1) {
        throw appError('Student membership changed while approving the transfer', 409, ERROR_CODES.TRANSFER_CONFLICT);
      }

      request.status = 'approved';
      request.decisionNote = decisionNote;
      request.decidedBy = actor.userId;
      request.decidedByRole = actor.role;
      request.decidedAt = new Date();
      await request.save({ session });
      approved = request.toObject();
    });
    return approved;
  } finally {
    await session.endSession();
  }
};

const rejectTransfer = async (actor, requestId, decisionNote = '', { admin = false } = {}) => {
  const request = await StudentTransferRequest.findOne({ _id: requestId, status: 'pending' });
  if (!request) throw appError('Pending transfer request not found', 409, ERROR_CODES.TRANSFER_CONFLICT);
  if (!admin) {
    const { classId } = await getTeacherContext(actor.userId);
    if (request.destinationClassId.toString() !== classId.toString()) {
      throw appError('Only the destination teacher or an administrator can reject this request', 403, ERROR_CODES.SCOPE_VIOLATION);
    }
  }
  const rejected = await StudentTransferRequest.findOneAndUpdate(
    { _id: requestId, status: 'pending' },
    {
      status: 'rejected', decisionNote, decidedBy: actor.userId,
      decidedByRole: actor.role, decidedAt: new Date(),
    },
    { returnDocument: 'after', runValidators: true }
  );
  if (!rejected) throw appError('Transfer request was already decided', 409, ERROR_CODES.TRANSFER_CONFLICT);
  return rejected;
};

const cancelTransfer = async (teacherId, requestId) => {
  const request = await StudentTransferRequest.findOneAndUpdate(
    { _id: requestId, requestedBy: teacherId, status: 'pending' },
    { status: 'cancelled', decidedAt: new Date() },
    { returnDocument: 'after', runValidators: true }
  );
  if (!request) throw appError('Pending transfer request not found or cannot be cancelled', 409, ERROR_CODES.TRANSFER_CONFLICT);
  return request;
};

const getDashboard = async (teacherId) => {
  const { classDoc, classId } = await getTeacherContext(teacherId);
  const now = new Date();
  const assignmentScope = { $or: [{ classIds: classId }, { assignedBy: teacherId }] };
  const noticeScope = { $or: [{ audienceType: 'all_classes' }, { classIds: classId }, { createdBy: teacherId }] };
  const [
    activeStudents, blockedStudents, activeAssignments, upcomingAssignments, activeNotices,
    reportCardsCreated, assessmentsCreated, pendingIncomingTransfers, timetable,
    recentAssignments, recentNotices,
  ] = await Promise.all([
    User.countDocuments({ _id: { $in: classDoc.studentIds }, role: 'student', status: 'active' }),
    User.countDocuments({ _id: { $in: classDoc.studentIds }, role: 'student', status: 'blocked' }),
    Assignment.countDocuments({ ...assignmentScope, status: 'active', isDeleted: false }),
    Assignment.countDocuments({ ...assignmentScope, status: 'active', isDeleted: false, deadline: { $gte: now } }),
    Notice.countDocuments({ ...noticeScope, status: 'active', isDeleted: false }),
    ReportCard.countDocuments({ classId, isDeleted: false }),
    Assessment.countDocuments({ classId, isDeleted: false }),
    StudentTransferRequest.countDocuments({ destinationClassId: classId, status: 'pending' }),
    Timetable.findOne({ classId }).lean(),
    Assignment.find({ ...assignmentScope, isDeleted: false }).sort({ createdAt: -1 }).limit(5).lean(),
    Notice.find({ ...noticeScope, isDeleted: false }).sort({ createdAt: -1 }).limit(5).lean(),
  ]);

  const dayName = new Intl.DateTimeFormat('en-US', { weekday: 'long', timeZone: 'Asia/Kolkata' }).format(now);
  return {
    assignedClass: classDoc,
    metrics: {
      activeStudents, blockedStudents, activeAssignments, upcomingAssignments,
      activeNotices, reportCardsCreated, assessmentsCreated, pendingIncomingTransfers,
    },
    todayTimetable: timetable?.schedule?.find((entry) => entry.day === dayName)?.periods || [],
    recentAssignments,
    recentNotices,
  };
};

export {
  approveTransfer, cancelTransfer, createStudent, getDashboard, getStudent, getTransferDestinations,
  getTransferRequest, listStudents, listTransferRequests, rejectTransfer, removeStudent,
  requestTransfer, setStudentBlocked, updateStudent,
};

export default {
  approveTransfer, cancelTransfer, createStudent, getDashboard, getStudent, getTransferDestinations,
  getTransferRequest, listStudents, listTransferRequests, rejectTransfer, removeStudent,
  requestTransfer, setStudentBlocked, updateStudent,
};
