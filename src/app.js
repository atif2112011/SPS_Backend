import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import morgan from 'morgan';
import requestContext from './middlewares/requestContext.middleware.js';
import errorHandler from './middlewares/errorHandler.middleware.js';
import routes from './routes/index.js';

const app = express();

app.use(helmet());

app.use(cors({
  origin: (process.env.ALLOWED_ORIGINS || process.env.CORS_ORIGIN)
    ? (process.env.ALLOWED_ORIGINS || process.env.CORS_ORIGIN).split(',').map((origin) => origin.trim()).filter(Boolean)
    : ['http://localhost:3000', 'http://localhost:3001', 'http://localhost:8081', 'http://localhost:8082'],
  credentials: true,
}));

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser(process.env.COOKIE_SECRET));

app.use(morgan('dev'));

app.use(requestContext);

app.use('/api/v1', routes);

app.get('/health', (req, res) => res.json({ success: true, message: 'SPS API is running' }));

app.use((req, res) => {
  res.status(404).json({ success: false, message: 'Route not found', errorCode: 'NOT_FOUND' });
});

app.use(errorHandler);

export default app;
