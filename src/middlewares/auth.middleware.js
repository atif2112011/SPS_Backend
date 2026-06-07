import { verifyAccessToken } from '../utils/tokenUtils.js';
import User from '../models/User.model.js';
import ERROR_CODES from '../constants/errorCodes.js';

/**
 * Authentication middleware — use standard async/await with try/catch
 * (not asyncWrapper) so that early returns properly halt the Express
 * middleware chain before route-level guards (authorizeRole) run.
 */
const authenticate = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        success: false,
        message: 'Access token is required',
        errorCode: ERROR_CODES.TOKEN_INVALID,
        traceId: req.traceId,
      });
    }

    const token = authHeader.split(' ')[1];
    const decoded = verifyAccessToken(token);

    const user = await User.findById(decoded.userId).select('role status');
    if (!user || user.status === 'deleted') {
      return res.status(401).json({
        success: false,
        message: 'User not found',
        errorCode: ERROR_CODES.TOKEN_INVALID,
        traceId: req.traceId,
      });
    }
    if (user.status === 'blocked') {
      return res.status(403).json({
        success: false,
        message: 'Your account has been blocked',
        errorCode: ERROR_CODES.ACCOUNT_BLOCKED,
        traceId: req.traceId,
      });
    }

    req.user = { userId: decoded.userId, role: user.role };
    next();
  } catch (err) {
    next(err);
  }
};

export { authenticate };
export default { authenticate };
