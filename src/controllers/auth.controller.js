import authService from '../services/auth.service.js';
import { sendSuccess, sendError } from '../utils/responseHelper.js';
import asyncWrapper from '../utils/asyncWrapper.js';
import ERROR_CODES from '../constants/errorCodes.js';

const getRefreshCookieOptions = () => ({
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: process.env.NODE_ENV === 'production' ? 'strict' : 'lax',
  maxAge: 7 * 24 * 60 * 60 * 1000,
  path: '/api/v1/auth',
});

const login = asyncWrapper(async (req, res) => {
  const { username, password } = req.body;
  const deviceInfo = req.headers['user-agent'] || 'unknown';

  const result = await authService.login(username, password, deviceInfo);

  res.cookie('refreshToken', result.refreshToken, getRefreshCookieOptions());

  sendSuccess(res, {
    message: 'Login successful',
    data: {
      accessToken: result.accessToken,
      user: result.user,
    },
  });
});

const refresh = asyncWrapper(async (req, res) => {
  const oldRefreshToken = req.cookies?.refreshToken;

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
    data: { accessToken: result.accessToken },
  });
});

const logout = asyncWrapper(async (req, res) => {
  const refreshToken = req.cookies?.refreshToken;
  await authService.logout(refreshToken);

  res.clearCookie('refreshToken', { path: '/api/v1/auth' });

  sendSuccess(res, { message: 'Logged out successfully' });
});

const getMe = asyncWrapper(async (req, res) => {
  const user = await authService.getMe(req.user.userId);
  sendSuccess(res, { message: 'Profile fetched', data: user });
});

const changePassword = asyncWrapper(async (req, res) => {
  const { currentPassword, newPassword } = req.body;
  await authService.changePassword(req.user.userId, currentPassword, newPassword);

  res.clearCookie('refreshToken', { path: '/api/v1/auth' });

  sendSuccess(res, { message: 'Password changed successfully. Please log in again.' });
});

export { login, refresh, logout, getMe, changePassword };
export default { login, refresh, logout, getMe, changePassword };
