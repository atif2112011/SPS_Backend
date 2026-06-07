import dotenv from 'dotenv';
dotenv.config();
import { fileURLToPath } from 'node:url';
import app from './src/app.js';
import logger from './src/config/logger.js';
import { bootstrap } from './src/bootstrap.js';
import { isVercelRuntime } from './src/utils/env.js';

const PORT = process.env.PORT || 5000;
const isVercel = isVercelRuntime();

const start = async () => {
  await bootstrap({ startJobs: !isVercel });

  if (isVercel) {
    logger.info('SPS API initialized for Vercel serverless runtime');
    return;
  }

  app.listen(PORT, () => {
    logger.info(`SPS API running on port ${PORT} [${process.env.NODE_ENV}]`);
  });
};

const isMainModule = process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1];

if (isMainModule && !isVercel) {
  start().catch((err) => {
    logger.error('Failed to start server', err);
    process.exit(1);
  });
}

export default app;
