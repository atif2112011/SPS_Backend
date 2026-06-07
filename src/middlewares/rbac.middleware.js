const ERROR_CODES = require('../constants/errorCodes');

const authorizeRole = (...roles) => (req, res, next) => {
  if (!req.user || !roles.includes(req.user.role)) {
    return res.status(403).json({
      success: false,
      message: 'You do not have permission to perform this action',
      errorCode: ERROR_CODES.UNAUTHORIZED,
      traceId: req.traceId,
    });
  }
  next();
};

const authorizeOwner = (paramKey = 'id') => (req, res, next) => {
  const { userId, role } = req.user;
  if (role === 'admin' || role === 'teacher') return next();
  if (req.params[paramKey] !== userId.toString()) {
    return res.status(403).json({
      success: false,
      message: 'You can only access your own data',
      errorCode: ERROR_CODES.SCOPE_VIOLATION,
      traceId: req.traceId,
    });
  }
  next();
};

module.exports = { authorizeRole, authorizeOwner };
