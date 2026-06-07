const Timetable = require('../models/Timetable.model');
const TeacherProfile = require('../models/TeacherProfile.model');
const StudentProfile = require('../models/StudentProfile.model');
const ERROR_CODES = require('../constants/errorCodes');
const logActivity = require('../utils/activityLogger');
const eventBus = require('../events/eventBus');
const EVENTS = require('../constants/events');

const appError = (message, statusCode, errorCode) => {
  const err = new Error(message);
  err.statusCode = statusCode;
  err.errorCode = errorCode;
  return err;
};

const getTeacherClassId = async (userId) => {
  const profile = await TeacherProfile.findOne({ userId });
  if (!profile || !profile.assignedClassId) {
    throw appError('Teacher has no assigned class', 400, ERROR_CODES.SCOPE_VIOLATION);
  }
  return profile.assignedClassId.toString();
};

/**
 * POST /timetables
 * One timetable per class.
 */
const createTimetable = async (data, actor) => {
  const { classId, schedule } = data;

  if (actor.role === 'teacher') {
    const assignedClassId = await getTeacherClassId(actor.userId);
    if (assignedClassId !== classId) {
      throw appError('Teacher can only manage timetable for their assigned class', 403, ERROR_CODES.SCOPE_VIOLATION);
    }
  }

  const existing = await Timetable.findOne({ classId });
  if (existing) throw appError('Timetable already exists for this class', 409, ERROR_CODES.DUPLICATE_ENTRY);

  const timetable = await Timetable.create({ classId, schedule, updatedBy: actor.userId });

  logActivity({
    actorId: actor.userId, actorName: actor.userId, actorRole: actor.role,
    actionType: 'CREATE_TIMETABLE', entityType: 'Timetable', entityId: timetable._id,
    metadata: { classId },
  });

  eventBus.emit(EVENTS.TIMETABLE_UPDATED, { timetableId: timetable._id, classId });

  return timetable;
};

/**
 * GET /timetables/class/:classId
 */
const getClassTimetable = async (classId, actor) => {
  if (actor.role === 'teacher') {
    const assignedClassId = await getTeacherClassId(actor.userId);
    if (assignedClassId !== classId) {
      throw appError('Access denied', 403, ERROR_CODES.SCOPE_VIOLATION);
    }
  } else if (actor.role === 'student') {
    const profile = await StudentProfile.findOne({ userId: actor.userId });
    if (!profile || profile.classId?.toString() !== classId) {
      throw appError('Access denied', 403, ERROR_CODES.SCOPE_VIOLATION);
    }
  }

  const timetable = await Timetable.findOne({ classId });
  if (!timetable) throw appError('Timetable not found for this class', 404, ERROR_CODES.NOT_FOUND);
  return timetable;
};

/**
 * PATCH /timetables/:id
 * Replaces full schedule.
 */
const updateTimetable = async (timetableId, data, actor) => {
  const timetable = await Timetable.findById(timetableId);
  if (!timetable) throw appError('Timetable not found', 404, ERROR_CODES.NOT_FOUND);

  if (actor.role === 'teacher') {
    const assignedClassId = await getTeacherClassId(actor.userId);
    if (timetable.classId.toString() !== assignedClassId) {
      throw appError('Teacher can only manage timetable for their assigned class', 403, ERROR_CODES.SCOPE_VIOLATION);
    }
  }

  const updated = await Timetable.findByIdAndUpdate(
    timetableId,
    { schedule: data.schedule, updatedBy: actor.userId },
    { returnDocument: 'after' }
  );

  logActivity({
    actorId: actor.userId, actorName: actor.userId, actorRole: actor.role,
    actionType: 'UPDATE_TIMETABLE', entityType: 'Timetable', entityId: timetableId,
    metadata: { classId: timetable.classId },
  });

  eventBus.emit(EVENTS.TIMETABLE_UPDATED, { timetableId, classId: timetable.classId });

  return updated;
};

/**
 * DELETE /timetables/:id — admin only
 */
const deleteTimetable = async (timetableId, actor) => {
  const timetable = await Timetable.findById(timetableId);
  if (!timetable) throw appError('Timetable not found', 404, ERROR_CODES.NOT_FOUND);

  await Timetable.findByIdAndDelete(timetableId);

  logActivity({
    actorId: actor.userId, actorName: actor.userId, actorRole: actor.role,
    actionType: 'DELETE_TIMETABLE', entityType: 'Timetable', entityId: timetableId,
    metadata: { classId: timetable.classId },
  });
};

module.exports = { createTimetable, getClassTimetable, updateTimetable, deleteTimetable };
