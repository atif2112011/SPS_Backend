import { v4 as uuidv4 } from 'uuid';

const requestContext = (req, res, next) => {
  req.traceId = uuidv4();
  res.setHeader('X-Trace-Id', req.traceId);
  next();
};

export default requestContext;
