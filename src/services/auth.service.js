import User from '../models/User.model.js';
import RefreshToken from '../models/RefreshToken.model.js';
import { hashPassword, comparePassword } from '../utils/hashUtils.js';
import { signAccessToken, signRefreshToken, verifyRefreshToken, hashToken } from '../utils/tokenUtils.js';
import logger from '../config/logger.js';

const login = async (username, password, deviceInfo) => {
  const user = await User.findOne({ username }).select('+passwordHash');
  if (!user) {
    const err = new Error('Invalid username or password');
    err.statusCode = 401;
    err.errorCode = 'INVALID_CREDENTIALS';
    throw err;
  }

  if (user.status === 'blocked') {
    const err = new Error('Your account has been blocked. Contact admin.');
    err.statusCode = 403;
    err.errorCode = 'ACCOUNT_BLOCKED';
    throw err;
  }

  if (user.status === 'deleted') {
    const err = new Error('Invalid username or password');
    err.statusCode = 401;
    err.errorCode = 'INVALID_CREDENTIALS';
    throw err;
  }

  const isMatch = await comparePassword(password, user.passwordHash);
  if (!isMatch) {
    const err = new Error('Invalid username or password');
    err.statusCode = 401;
    err.errorCode = 'INVALID_CREDENTIALS';
    throw err;
  }

  await User.findByIdAndUpdate(user._id, { lastLoginAt: new Date() });

  const accessToken = signAccessToken({ userId: user._id, role: user.role, tokenVersion: user.refreshTokenVersion });
  const refreshToken = signRefreshToken({ userId: user._id, tokenVersion: user.refreshTokenVersion });

  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
  await RefreshToken.create({
    userId: user._id,
    tokenHash: hashToken(refreshToken),
    deviceInfo,
    expiresAt,
  });

  logger.info('User logged in', { userId: user._id, role: user.role });

  return {
    accessToken,
    refreshToken,
    user: {
      id: user._id,
      username: user.username,
      name: user.name,
      role: user.role,
      status: user.status,
      email: user.email,
      profileImage: user.profileImage,
      metrics: user.metrics,
      firstPasswordChange: user.firstPasswordChange !== false,
    },
  };
};

const refresh = async (oldRefreshToken) => {
  const decoded = verifyRefreshToken(oldRefreshToken);
  const tokenHash = hashToken(oldRefreshToken);

  const session = await RefreshToken.findOneAndUpdate(
    { tokenHash, revokedAt: null },
    { $set: { revokedAt: new Date() } },
    { returnDocument: 'before' }
  );
  if (!session) {
    await RefreshToken.updateMany(
      { userId: decoded.userId },
      { revokedAt: new Date() }
    );
    const err = new Error('Refresh token reuse detected. All sessions revoked.');
    err.statusCode = 401;
    err.errorCode = 'REFRESH_TOKEN_REUSE';
    throw err;
  }

  const user = await User.findById(decoded.userId).select('role status refreshTokenVersion');
  if (!user || user.status !== 'active' || decoded.tokenVersion !== user.refreshTokenVersion) {
    const err = new Error('User not found or inactive');
    err.statusCode = 401;
    err.errorCode = 'TOKEN_INVALID';
    throw err;
  }

  const newAccessToken = signAccessToken({ userId: user._id, role: user.role, tokenVersion: user.refreshTokenVersion });
  const newRefreshToken = signRefreshToken({ userId: user._id, tokenVersion: user.refreshTokenVersion });

  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
  await RefreshToken.create({
    userId: user._id,
    tokenHash: hashToken(newRefreshToken),
    deviceInfo: session.deviceInfo,
    expiresAt,
  });

  return { accessToken: newAccessToken, refreshToken: newRefreshToken };
};

const logout = async (refreshToken) => {
  if (!refreshToken) return;
  const tokenHash = hashToken(refreshToken);
  await RefreshToken.findOneAndUpdate({ tokenHash }, { revokedAt: new Date() });
};

const getMe = async (userId) => {
  const user = await User.findById(userId);
  if (!user) {
    const err = new Error('User not found');
    err.statusCode = 404;
    err.errorCode = 'NOT_FOUND';
    throw err;
  }
  const userData = user.toObject();
  if (userData.firstPasswordChange === undefined) userData.firstPasswordChange = true;
  return userData;
};

const changePassword = async (userId, currentPassword, newPassword) => {
  const user = await User.findById(userId).select('+passwordHash');
  if (!user) {
    const err = new Error('User not found');
    err.statusCode = 404;
    err.errorCode = 'NOT_FOUND';
    throw err;
  }

  const isMatch = await comparePassword(currentPassword, user.passwordHash);
  if (!isMatch) {
    const err = new Error('Current password is incorrect');
    err.statusCode = 400;
    err.errorCode = 'INVALID_CREDENTIALS';
    throw err;
  }

  const newHash = await hashPassword(newPassword);

  await User.findByIdAndUpdate(userId, {
    passwordHash: newHash,
    firstPasswordChange: true,
    $inc: { refreshTokenVersion: 1 },
  });

  await RefreshToken.updateMany({ userId }, { revokedAt: new Date() });

  logger.info('Password changed, all sessions revoked', { userId });
  return { firstPasswordChange: true, requiresLogin: true };
};

export { login, refresh, logout, getMe, changePassword };
export default { login, refresh, logout, getMe, changePassword };
