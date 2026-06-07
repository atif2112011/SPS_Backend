const ActivityLog = require('../models/ActivityLog.model');
const logger = require('../config/logger');

/**
 * Log an auditable action to the ActivityLog collection.
 * Fire-and-forget (non-blocking). Never throws.
 */
const logActivity = async ({
  actorId, actorName, actorRole,
  targetId = null, targetName = null, targetRole = null,
  actionType, entityType, entityId = null,
  metadata = {}, ipAddress = null, userAgent = null,
}) => {
  try {
    await ActivityLog.create({
      actorId, actorName, actorRole,
      targetId, targetName, targetRole,
      actionType, entityType, entityId,
      metadata, ipAddress, userAgent,
    });
  } catch (err) {
    logger.error('Failed to write activity log', { error: err.message });
  }
};

module.exports = logActivity;
