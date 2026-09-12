import admin from 'firebase-admin';
import logger from './logger.js';

let initialized = false;

const initFirebase = () => {
  if (initialized) return;
  const required = ['FIREBASE_PROJECT_ID', 'FIREBASE_PRIVATE_KEY', 'FIREBASE_CLIENT_EMAIL'];
  const missing = required.filter((key) => !process.env[key]);
  if (missing.length > 0) {
    throw new Error(`Firebase configuration missing: ${missing.join(', ')}`);
  }
  try {
    admin.initializeApp({
      credential: admin.credential.cert({
        projectId: process.env.FIREBASE_PROJECT_ID,
        // Handle both escaped \\n (from dotenv) and literal newlines
        privateKey: process.env.FIREBASE_PRIVATE_KEY?.includes('\\n')
          ? process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n')
          : process.env.FIREBASE_PRIVATE_KEY,
        clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      }),
      storageBucket: process.env.FIREBASE_STORAGE_BUCKET,
    });
    initialized = true;
    logger.info('Firebase Admin initialized');
  } catch (err) {
    logger.error('Firebase initialization failed', { error: err.message });
    throw err;
  }
};

const getStorage = () => admin.storage().bucket();
const getMessaging = () => {
  if (!initialized) throw new Error('Firebase Admin is not initialized');
  return admin.messaging();
};

export { initFirebase, getStorage, getMessaging };
export default { initFirebase, getStorage, getMessaging };
