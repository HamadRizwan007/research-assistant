const mongoose = require('mongoose');
const logger = require('./logger');
const config = require('../config');

/**
 * Initialize MongoDB connection using Mongoose
 * @returns {Promise<void>}
 */
async function connectToDatabase() {
  // Skip if no MongoDB URI is configured
  if (!config.database.mongoUri) {
    logger.warn('MongoDB URI not configured. Database connection skipped.');
    return;
  }

  try {
    logger.info('Connecting to MongoDB...', {
      mongoUri: config.database.mongoUri.substring(0, 50) + '...',
    });

    await mongoose.connect(config.database.mongoUri, config.database.options);

    logger.info('✅ MongoDB connected successfully', {
      host: mongoose.connection.host,
      database: mongoose.connection.name,
      readyState: mongoose.connection.readyState,
    });

    // Set up connection event listeners
    setupConnectionListeners();
  } catch (error) {
    logger.error('❌ MongoDB connection failed', {
      error: error.message,
      stack: error.stack,
      mongoUri: config.database.mongoUri.substring(0, 50) + '...',
    });

    // Don't throw error - allow app to start without database
    logger.warn('Continuing without database connection');
  }
}

/**
 * Set up MongoDB connection event listeners
 */
function setupConnectionListeners() {
  const connection = mongoose.connection;

  connection.on('connected', () => {
    logger.info('Mongoose connected to MongoDB');
  });

  connection.on('error', (error) => {
    logger.error('Mongoose connection error', {
      error: error.message,
      stack: error.stack,
    });
  });

  connection.on('disconnected', () => {
    logger.warn('Mongoose disconnected from MongoDB');
  });

  connection.on('reconnected', () => {
    logger.info('Mongoose reconnected to MongoDB');
  });

  // Handle process termination
  process.on('SIGINT', async () => {
    await disconnectFromDatabase();
  });

  process.on('SIGTERM', async () => {
    await disconnectFromDatabase();
  });
}

/**
 * Disconnect from MongoDB
 * @returns {Promise<void>}
 */
async function disconnectFromDatabase() {
  try {
    if (mongoose.connection.readyState !== 0) {
      await mongoose.disconnect();
      logger.info('MongoDB connection closed');
    }
  } catch (error) {
    logger.error('Error closing MongoDB connection', {
      error: error.message,
    });
  }
}

/**
 * Get the current connection state
 * @returns {Object} Connection state information
 */
function getConnectionState() {
  const states = ['Disconnected', 'Connected', 'Connecting', 'Disconnecting'];
  const readyState = mongoose.connection.readyState;

  return {
    connected: readyState === 1,
    readyState,
    state: states[readyState] || 'Unknown',
    host: mongoose.connection.host,
    database: mongoose.connection.name,
    models: Object.keys(mongoose.connection.models),
  };
}

module.exports = {
  connectToDatabase,
  disconnectFromDatabase,
  getConnectionState,
  mongoose,
};