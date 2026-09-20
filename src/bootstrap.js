import connectDB from './config/db.js';
import { initFirebase } from './config/firebase.js';
import validateRuntimeEnv from './config/runtimeEnv.js';

let bootPromise;

const bootstrap = async () => {
  if (!bootPromise) {
    bootPromise = (async () => {
      validateRuntimeEnv();
      initFirebase();
      await connectDB();
    })().catch((err) => {
      bootPromise = undefined;
      throw err;
    });
  }

  await bootPromise;
};

export { bootstrap };
export default { bootstrap };
