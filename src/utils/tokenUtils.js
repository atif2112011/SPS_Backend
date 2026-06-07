import jwt from 'jsonwebtoken';
import crypto from 'crypto';

const signAccessToken = (payload) => {
  return jwt.sign(payload, process.env.JWT_ACCESS_SECRET, {
    expiresIn: process.env.JWT_ACCESS_EXPIRES_IN || '15m',
  });
};

const signRefreshToken = (payload) => {
  return jwt.sign(payload, process.env.JWT_REFRESH_SECRET, {
    expiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '7d',
  });
};

const verifyAccessToken = (token) => {
  return jwt.verify(token, process.env.JWT_ACCESS_SECRET);
};

const verifyRefreshToken = (token) => {
  return jwt.verify(token, process.env.JWT_REFRESH_SECRET);
};

const hashToken = (token) => {
  return crypto.createHash('sha256').update(token).digest('hex');
};

export { signAccessToken, signRefreshToken, verifyAccessToken, verifyRefreshToken, hashToken };
export default { signAccessToken, signRefreshToken, verifyAccessToken, verifyRefreshToken, hashToken };
