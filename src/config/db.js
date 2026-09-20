import mongoose from 'mongoose';
import logger from './logger.js';

const connectDB = async () => {
  try {
    if (mongoose.connection.readyState === 1) {
      return mongoose.connection;
    }
    if (mongoose.connection.readyState === 2) {
      await mongoose.connection.asPromise();
      return mongoose.connection;
    }

    if (!process.env.MONGODB_URI) {
      throw new Error('MongoDB configuration missing: MONGODB_URI');
    }

    const configuredPoolSize = Number.parseInt(process.env.MONGODB_MAX_POOL_SIZE || '10', 10);
    const maxPoolSize = Number.isFinite(configuredPoolSize) && configuredPoolSize > 0
      ? configuredPoolSize
      : 10;
    const conn = await mongoose.connect(process.env.MONGODB_URI, {
      maxPoolSize,
      serverSelectionTimeoutMS: 10_000,
    });
    logger.info(`MongoDB connected: ${conn.connection.host}`);
    return conn.connection;
  } catch (err) {
    logger.error('MongoDB connection failed', { error: err.message });
    throw err;
  }
};

export default connectDB;
