const { sendError } = require('../utils/responseHelper');
const ERROR_CODES = require('../constants/errorCodes');

const validate = (schema, source = 'body') => (req, res, next) => {
  const result = schema.safeParse(req[source]);
  if (!result.success) {
    const details = (result.error.issues ?? result.error.errors ?? []).map((e) => ({
      field: e.path.join('.'),
      message: e.message,
    }));
    return sendError(res, {
      message: 'Validation failed',
      errorCode: ERROR_CODES.VALIDATION_ERROR,
      details,
      statusCode: 400,
      traceId: req.traceId,
    });
  }
  req[source] = result.data;
  next();
};

module.exports = validate;
