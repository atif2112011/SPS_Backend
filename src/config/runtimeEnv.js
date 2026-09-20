const requiredKeys = [
  'MONGODB_URI',
  'JWT_ACCESS_SECRET',
  'JWT_REFRESH_SECRET',
  'COOKIE_SECRET',
];

const firebaseConfigFrom = (env) => {
  if (!env.FIREBASE_CONFIG) return {};
  try {
    return JSON.parse(env.FIREBASE_CONFIG);
  } catch {
    return {};
  }
};

const validateRuntimeEnv = (env = process.env) => {
  const missing = requiredKeys.filter((key) => !String(env[key] || '').trim());
  const firebaseConfig = firebaseConfigFrom(env);
  const storageBucket = env.SPS_FIREBASE_STORAGE_BUCKET
    || env.FIREBASE_STORAGE_BUCKET
    || firebaseConfig.storageBucket;

  if (!storageBucket) missing.push('SPS_FIREBASE_STORAGE_BUCKET');
  if (missing.length > 0) {
    throw new Error(`Runtime configuration missing: ${missing.join(', ')}`);
  }

  return { storageBucket };
};

export { validateRuntimeEnv };
export default validateRuntimeEnv;
