import authService from '../services/auth.service.js';
import { sendSuccess, sendError } from '../utils/responseHelper.js';
import asyncWrapper from '../utils/asyncWrapper.js';
import ERROR_CODES from '../constants/errorCodes.js';
import { isFirebaseRuntime } from '../utils/env.js';

const getRefreshCookieOptions = () => {
  const hostedRuntime = isFirebaseRuntime() || process.env.NODE_ENV === 'production';
  return {
    httpOnly: true,
    secure: hostedRuntime,
    sameSite: isFirebaseRuntime()
      ? 'none'
      : process.env.COOKIE_SAME_SITE || (hostedRuntime ? 'none' : 'lax'),
    maxAge: 7 * 24 * 60 * 60 * 1000,
    // The direct Functions URL adds /spsApi before the Express route path.
    path: process.env.COOKIE_PATH || '/',
  };
};

const clearRefreshCookie = (res) => {
  const { maxAge, ...options } = getRefreshCookieOptions();
  res.clearCookie('refreshToken', options);
};

const login = asyncWrapper(async (req, res) => {
  const { username, password, clientType } = req.body;
  const deviceInfo = req.headers['user-agent'] || 'unknown';

  const result = await authService.login(username, password, deviceInfo);

  res.cookie('refreshToken', result.refreshToken, getRefreshCookieOptions());

  sendSuccess(res, {
    message: 'Login successful',
    data: {
      accessToken: result.accessToken,
      ...(clientType === 'mobile' ? { refreshToken: result.refreshToken } : {}),
      user: result.user,
    },
  });
});

const refresh = asyncWrapper(async (req, res) => {
  const bodyRefreshToken = req.body?.refreshToken;
  const oldRefreshToken = bodyRefreshToken || req.cookies?.refreshToken;

  if (!oldRefreshToken) {
    return sendError(res, {
      message: 'Refresh token not found',
      errorCode: ERROR_CODES.TOKEN_INVALID,
      statusCode: 401,
      traceId: req.traceId,
    });
  }

  const result = await authService.refresh(oldRefreshToken);

  res.cookie('refreshToken', result.refreshToken, getRefreshCookieOptions());

  sendSuccess(res, {
    message: 'Token refreshed',
    data: {
      accessToken: result.accessToken,
      ...(bodyRefreshToken || req.body?.clientType === 'mobile' ? { refreshToken: result.refreshToken } : {}),
    },
  });
});

const logout = asyncWrapper(async (req, res) => {
  const refreshToken = req.body?.refreshToken || req.cookies?.refreshToken;
  await authService.logout(refreshToken);

  clearRefreshCookie(res);

  sendSuccess(res, { message: 'Logged out successfully' });
});

const getMe = asyncWrapper(async (req, res) => {
  const user = await authService.getMe(req.user.userId);
  sendSuccess(res, { message: 'Profile fetched', data: user });
});

const changePassword = asyncWrapper(async (req, res) => {
  const { currentPassword, newPassword } = req.body;
  const result = await authService.changePassword(req.user.userId, currentPassword, newPassword);

  clearRefreshCookie(res);

  sendSuccess(res, { message: 'Password changed successfully. Please log in again.', data: result });
});

export { login, refresh, logout, getMe, changePassword };
export default { login, refresh, logout, getMe, changePassword };
