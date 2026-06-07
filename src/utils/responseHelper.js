const sendSuccess = (res, { message = 'Success', data = null, statusCode = 200, pagination = null } = {}) => {
  const body = { success: true, message };
  if (data !== null) body.data = data;
  if (pagination) body.pagination = pagination;
  return res.status(statusCode).json(body);
};

const sendError = (res, { message = 'An error occurred', errorCode = 'INTERNAL_ERROR', details = null, statusCode = 500, traceId = null } = {}) => {
  const body = { success: false, message, errorCode };
  if (details) body.details = details;
  if (traceId) body.traceId = traceId;
  return res.status(statusCode).json(body);
};

export { sendSuccess, sendError };
export default { sendSuccess, sendError };
