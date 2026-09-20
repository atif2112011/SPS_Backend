import fs from 'node:fs';
import assert from 'node:assert/strict';
import {
  spsApi,
  notificationWorker,
  hourlyAssignmentReminders,
  dailyAssignmentReminders,
} from './firebase.js';
import validateRuntimeEnv from './src/config/runtimeEnv.js';

const endpoint = (fn) => fn.__endpoint || {};

assert.equal(typeof spsApi, 'function');
assert.equal(endpoint(spsApi).platform, 'gcfv2');
assert.deepEqual(endpoint(spsApi).region, ['asia-south1']);
assert.deepEqual(endpoint(spsApi).httpsTrigger?.invoker, ['public']);

const schedules = [
  [notificationWorker, '* * * * *'],
  [hourlyAssignmentReminders, '0 * * * *'],
  [dailyAssignmentReminders, '0 8 * * *'],
];

for (const [fn, schedule] of schedules) {
  assert.equal(typeof fn, 'function');
  assert.equal(endpoint(fn).platform, 'gcfv2');
  assert.deepEqual(endpoint(fn).region, ['asia-south1']);
  assert.equal(endpoint(fn).scheduleTrigger?.schedule, schedule);
  assert.equal(endpoint(fn).scheduleTrigger?.timeZone, 'Asia/Kolkata');
  assert.equal(endpoint(fn).maxInstances, 1);
}

const firebaseConfig = JSON.parse(fs.readFileSync(new URL('./firebase.json', import.meta.url), 'utf8'));
assert.equal(firebaseConfig.functions.runtime, 'nodejs22');
assert.equal(firebaseConfig.functions.source, '.');
assert.doesNotThrow(() => validateRuntimeEnv());
assert.throws(
  () => validateRuntimeEnv({ SPS_FIREBASE_STORAGE_BUCKET: 'bucket.example' }),
  /MONGODB_URI, JWT_ACCESS_SECRET, JWT_REFRESH_SECRET, COOKIE_SECRET/,
);

if (fs.existsSync(new URL('./.env', import.meta.url))) {
  const envKeys = fs.readFileSync(new URL('./.env', import.meta.url), 'utf8')
    .split(/\r?\n/)
    .map((line) => line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=/)?.[1])
    .filter(Boolean);
  const reservedExact = new Set([
    'PORT',
    'FUNCTION_TARGET',
    'FUNCTION_NAME',
    'FUNCTION_REGION',
    'K_SERVICE',
    'K_REVISION',
    'K_CONFIGURATION',
    'GOOGLE_CLOUD_PROJECT',
    'GCLOUD_PROJECT',
    'GCP_PROJECT',
  ]);
  const forbidden = envKeys.filter((key) => key.startsWith('FIREBASE_') || reservedExact.has(key));
  assert.deepEqual(forbidden, [], `Firebase-reserved .env keys found: ${forbidden.join(', ')}`);
}

console.log('Firebase Functions configuration passed: Node 22, Mumbai region, public API, three schedules, and deployable environment names.');
