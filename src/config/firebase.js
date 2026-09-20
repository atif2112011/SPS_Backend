import admin from 'firebase-admin';
import logger from './logger.js';
import { isFirebaseRuntime } from '../utils/env.js';

let initialized = false;

const initFirebase = () => {
  if (initialized || admin.apps.length > 0) {
    initialized = true;
    return;
  }

  const projectId = process.env.SPS_FIREBASE_PROJECT_ID || process.env.FIREBASE_PROJECT_ID;
  const privateKey = process.env.SPS_FIREBASE_PRIVATE_KEY || process.env.FIREBASE_PRIVATE_KEY;
  const clientEmail = process.env.SPS_FIREBASE_CLIENT_EMAIL || process.env.FIREBASE_CLIENT_EMAIL;
  const storageBucket = process.env.SPS_FIREBASE_STORAGE_BUCKET || process.env.FIREBASE_STORAGE_BUCKET;

  try {
    if (isFirebaseRuntime()) {
      // Google runtimes provide Application Default Credentials automatically.
      admin.initializeApp(storageBucket ? { storageBucket } : undefined);
    } else {
      const credential = privateKey && clientEmail
        ? admin.credential.cert({
          projectId,
          privateKey: privateKey.includes('\\n') ? privateKey.replace(/\\n/g, '\n') : privateKey,
          clientEmail,
        })
        : admin.credential.applicationDefault();

      admin.initializeApp({
        credential,
        ...(projectId ? { projectId } : {}),
        ...(storageBucket ? { storageBucket } : {}),
      });
    }

    initialized = true;
    logger.info('Firebase Admin initialized', {
      credentialSource: isFirebaseRuntime()
        ? 'application-default'
        : privateKey && clientEmail
          ? 'service-account-env'
          : 'application-default',
    });
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
