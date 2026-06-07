const { v4: uuidv4 } = require('uuid');

const requestContext = (req, res, next) => {
  req.traceId = uuidv4();
  res.setHeader('X-Trace-Id', req.traceId);
  next();
};

module.exports = requestContext;
