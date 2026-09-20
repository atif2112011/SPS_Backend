import 'dotenv/config';
import { fileURLToPath } from 'node:url';
import app from './src/app.js';
import logger from './src/config/logger.js';
import { bootstrap } from './src/bootstrap.js';

const PORT = process.env.APP_PORT || process.env.PORT || 5000;

const start = async () => {
  await bootstrap();

  app.listen(PORT, () => {
    logger.info(`SPS API running on port ${PORT} [${process.env.NODE_ENV}]`);
  });
};

const isMainModule = process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1];

if (isMainModule) {
  start().catch((err) => {
    logger.error('Failed to start server', err);
    process.exit(1);
  });
}

export default app;
