const logger = require('../config/logger');
const ERROR_CODES = require('../constants/errorCodes');

const errorHandler = (err, req, res, next) => {
  const traceId = req.traceId;

  logger.error(err.message, {
    traceId,
    stack: err.stack,
    path: req.path,
    method: req.method,
  });

  if (err.name === 'ValidationError') {
    return res.status(400).json({
      success: false,
      message: 'Validation failed',
      errorCode: ERROR_CODES.VALIDATION_ERROR,
      details: Object.values(err.errors).map((e) => e.message),
      traceId,
    });
  }

  if (err.code === 11000) {
    const field = Object.keys(err.keyValue || {})[0];
    return res.status(409).json({
      success: false,
      message: `${field ? field : 'Field'} already exists`,
      errorCode: ERROR_CODES.DUPLICATE_ENTRY,
      traceId,
    });
  }

  if (err.name === 'JsonWebTokenError') {
    return res.status(401).json({
      success: false,
      message: 'Invalid token',
      errorCode: ERROR_CODES.TOKEN_INVALID,
      traceId,
    });
  }
  if (err.name === 'TokenExpiredError') {
    return res.status(401).json({
      success: false,
      message: 'Token expired',
      errorCode: ERROR_CODES.TOKEN_EXPIRED,
      traceId,
    });
  }

  if (err.statusCode) {
    return res.status(err.statusCode).json({
      success: false,
      message: err.message,
      errorCode: err.errorCode || ERROR_CODES.INTERNAL_ERROR,
      details: err.details || null,
      traceId,
    });
  }

  return res.status(500).json({
    success: false,
    message: 'Internal server error',
    errorCode: ERROR_CODES.INTERNAL_ERROR,
    traceId,
  });
};

module.exports = errorHandler;
