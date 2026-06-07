import { sendError } from '../utils/responseHelper.js';
import ERROR_CODES from '../constants/errorCodes.js';

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
  if (source === 'query' || source === 'params') {
    const target = req[source];
    Object.keys(target).forEach((key) => delete target[key]);
    Object.assign(target, result.data);
  } else {
    req[source] = result.data;
  }
  next();
};

export default validate;
