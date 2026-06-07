const admin = require('firebase-admin');
const logger = require('./logger');

let initialized = false;

const initFirebase = () => {
  if (initialized) return;
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
  }
};

const getStorage = () => admin.storage().bucket();
const getMessaging = () => admin.messaging();

module.exports = { initFirebase, getStorage, getMessaging };
