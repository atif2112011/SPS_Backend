import dotenv from 'dotenv';
dotenv.config();

import mongoose from 'mongoose';
import jwt from 'jsonwebtoken';
import authService from './src/services/auth.service.js';

const username = process.env.TEST_STUDENT_USERNAME;
const password = process.env.TEST_STUDENT_PASSWORD;
if (!username || !password) throw new Error('Set TEST_STUDENT_USERNAME and TEST_STUDENT_PASSWORD to run this test');

await mongoose.connect(process.env.MONGODB_URI);
const [{ default: app }, { default: User }] = await Promise.all([
  import('./src/app.js'),
  import('./src/models/User.model.js'),
]);

const student = await User.findOne({ username, role: 'student', status: 'active' });
if (!student) throw new Error('Configured test student was not found');

const checks = [];
const check = (label, passed) => checks.push({ label, passed: Boolean(passed) });
const server = await new Promise((resolve) => {
  const instance = app.listen(0, '127.0.0.1', () => resolve(instance));
});
const baseUrl = `http://127.0.0.1:${server.address().port}/api/v1`;
const issuedRefreshTokens = [];

async function call(path, { method = 'GET', body, token, cookie } = {}) {
  const response = await fetch(`${baseUrl}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(cookie ? { Cookie: cookie } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  return { response, payload: await response.json() };
}

const cookieFrom = (response) => response.headers.get('set-cookie')?.split(';')[0];

try {
  const mobileLogin = await call('/auth/login', { method: 'POST', body: { username, password, clientType: 'mobile' } });
  if (mobileLogin.payload.data?.refreshToken) issuedRefreshTokens.push(mobileLogin.payload.data.refreshToken);
  check('mobile login returns both tokens', mobileLogin.response.ok && mobileLogin.payload.data?.accessToken && mobileLogin.payload.data?.refreshToken);

  const expiredToken = jwt.sign(
    { userId: student._id, role: student.role },
    process.env.JWT_ACCESS_SECRET,
    { expiresIn: -1 }
  );
  const expiredRequest = await call('/auth/me', { token: expiredToken });
  check('expired access token is rejected', expiredRequest.response.status === 401);

  const mobileRefresh = await call('/auth/refresh', {
    method: 'POST',
    body: { refreshToken: mobileLogin.payload.data.refreshToken, clientType: 'mobile' },
  });
  if (mobileRefresh.payload.data?.refreshToken) issuedRefreshTokens.push(mobileRefresh.payload.data.refreshToken);
  check('mobile refresh rotates both tokens', mobileRefresh.response.ok && mobileRefresh.payload.data?.accessToken && mobileRefresh.payload.data?.refreshToken);

  const retriedRequest = await call('/auth/me', { token: mobileRefresh.payload.data.accessToken });
  check('request succeeds with refreshed access token', retriedRequest.response.ok && retriedRequest.payload.data?.username === username);

  const mobileLogout = await call('/auth/logout', { method: 'POST', body: { refreshToken: mobileRefresh.payload.data.refreshToken } });
  check('mobile logout accepts the body token', mobileLogout.response.ok);

  const webLogin = await call('/auth/login', { method: 'POST', body: { username, password, clientType: 'web' } });
  const webCookie = cookieFrom(webLogin.response);
  if (webCookie?.startsWith('refreshToken=')) issuedRefreshTokens.push(decodeURIComponent(webCookie.slice('refreshToken='.length)));
  check('web login keeps refresh token cookie-only', webLogin.response.ok && webCookie && !webLogin.payload.data?.refreshToken);

  const webRefresh = await call('/auth/refresh', { method: 'POST', body: { clientType: 'web' }, cookie: webCookie });
  const rotatedWebCookie = cookieFrom(webRefresh.response);
  if (rotatedWebCookie?.startsWith('refreshToken=')) issuedRefreshTokens.push(decodeURIComponent(rotatedWebCookie.slice('refreshToken='.length)));
  check('web cookie refresh still works', webRefresh.response.ok && rotatedWebCookie && !webRefresh.payload.data?.refreshToken);

  const webLogout = await call('/auth/logout', { method: 'POST', body: {}, cookie: rotatedWebCookie });
  check('web cookie logout still works', webLogout.response.ok);
} finally {
  await Promise.all(issuedRefreshTokens.map((refreshToken) => authService.logout(refreshToken)));
  await new Promise((resolve) => server.close(resolve));
  await mongoose.disconnect();
}

for (const item of checks) console.log(`${item.passed ? 'PASS' : 'FAIL'} ${item.label}`);
const failures = checks.filter((item) => !item.passed);
console.log(`\n${checks.length - failures.length}/${checks.length} passed`);
if (failures.length) process.exit(1);
