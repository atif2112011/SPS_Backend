import ERROR_CODES from '../constants/errorCodes.js';

const WINDOW_MS = 15 * 60 * 1000;
const MAX_RESETS = 5;
const attemptsByActor = new Map();

const passwordResetRateLimit = (req, res, next) => {
  const now = Date.now();
  const actorId = String(req.user?.userId || req.ip || 'unknown');
  const recent = (attemptsByActor.get(actorId) || []).filter((timestamp) => now - timestamp < WINDOW_MS);

  if (recent.length >= MAX_RESETS) {
    attemptsByActor.set(actorId, recent);
    return res.status(429).json({
      success: false,
      message: 'Too many password resets. Try again later.',
      errorCode: ERROR_CODES.RATE_LIMITED,
      traceId: req.traceId,
    });
  }

  recent.push(now);
  attemptsByActor.set(actorId, recent);
  next();
};

export { passwordResetRateLimit };
export default passwordResetRateLimit;
