require('dotenv').config();
const app = require('./src/app');
const logger = require('./src/config/logger');
const { bootstrap } = require('./src/bootstrap');
const { isVercelRuntime } = require('./src/utils/env');

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

if (require.main === module && !isVercel) {
  start().catch((err) => {
    logger.error('Failed to start server', err);
    process.exit(1);
  });
}

module.exports = app;
