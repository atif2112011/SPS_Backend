import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import morgan from 'morgan';
import rateLimit from 'express-rate-limit';
import requestContext from './middlewares/requestContext.middleware.js';
import errorHandler from './middlewares/errorHandler.middleware.js';
import routes from './routes/index.js';
import logger from './config/logger.js';
import { bootstrap } from './bootstrap.js';
import { isVercelRuntime } from './utils/env.js';

const app = express();

app.use(helmet());

app.use(cors({
  origin: process.env.CORS_ORIGIN ? process.env.CORS_ORIGIN.split(',') : ['http://localhost:3000', 'http://localhost:3001'],
  credentials: true,
}));

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser(process.env.COOKIE_SECRET));

app.use(morgan('combined', {
  stream: { write: (msg) => logger.http(msg.trim()) },
}));

app.use(rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000,
  max: parseInt(process.env.RATE_LIMIT_MAX) || 100,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Too many requests, please try again later.' },
}));

if (isVercelRuntime()) {
  app.use(async (req, res, next) => {
    try {
      await bootstrap({ startJobs: false });
      next();
    } catch (err) {
      next(err);
    }
  });
}

app.use(requestContext);

app.use('/api/v1', routes);

app.get('/health', (req, res) => res.json({ success: true, message: 'SPS API is running' }));

app.use((req, res) => {
  res.status(404).json({ success: false, message: 'Route not found', errorCode: 'NOT_FOUND' });
});

app.use(errorHandler);

export default app;
