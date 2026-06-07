import mongoose from 'mongoose';
import logger from './logger.js';
import { isVercelRuntime } from '../utils/env.js';

const connectDB = async () => {
  try {
    if (mongoose.connection.readyState === 1) {
      return mongoose.connection;
    }
    if (mongoose.connection.readyState === 2) {
      await mongoose.connection.asPromise();
      return mongoose.connection;
    }

    const conn = await mongoose.connect(process.env.MONGODB_URI);
    logger.info(`MongoDB connected: ${conn.connection.host}`);
    return conn.connection;
  } catch (err) {
    logger.error('MongoDB connection failed', { error: err.message });
    if (isVercelRuntime()) {
      throw err;
    }
    process.exit(1);
  }
};

export default connectDB;
