const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const cookieParser = require('cookie-parser');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');
const requestContext = require('./middlewares/requestContext.middleware');
const errorHandler = require('./middlewares/errorHandler.middleware');
const routes = require('./routes/index');
const logger = require('./config/logger');
const { bootstrap } = require('./bootstrap');
const { isVercelRuntime } = require('./utils/env');

const app = express();

app.use(helmet());

app.use(cors({
  origin: process.env.ALLOWED_ORIGINS?.split(',') || 'http://localhost:3000',
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

module.exports = app;
