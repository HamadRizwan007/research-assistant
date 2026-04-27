const app = require('./src/app');
const config = require('./src/config');
const logger = require('./src/utils/logger');
const { connectToDatabase } = require('./src/utils/database');

console.log(process.env.GROQ_API_KEY ? 'API KEY OK' : 'MISSING KEY');

/**
 * Start the server
 */
async function startServer() {
  try {
    // Initialize MongoDB connection (if configured) - don't fail if it doesn't connect
    try {
      await connectToDatabase();
    } catch (dbError) {
      logger.warn('Database connection failed, but continuing without database', {
        error: dbError.message
      });
    }

    // Graceful shutdown handling
    const gracefulShutdown = (signal) => {
      logger.info(`Received ${signal}, shutting down gracefully...`);

      server.close((err) => {
        if (err) {
          logger.error('Error during server shutdown', { error: err.message });
          process.exit(1);
        }

        logger.info('Server shut down gracefully');
        process.exit(0);
      });

      // Force shutdown after 10 seconds
      setTimeout(() => {
        logger.error('Forced shutdown after timeout');
        process.exit(1);
      }, 10000);
    };

    // Start server
    const server = app.listen(config.port, () => {
      logger.info(`🚀 Research Assistant server running`, {
        port: config.port,
        environment: config.env,
        url: `http://localhost:${config.port}`,
        database: config.database.mongoUri ? 'MongoDB Connected' : 'No Database',
      });

  console.log(`\n📊 Research Assistant Server`);
  console.log(`================================`);
  console.log(`🌐 Server: http://localhost:${config.port}`);
  console.log(`🔧 Environment: ${config.env}`);
  console.log(`🤖 Groq Model: ${config.groq.model}`);
  console.log(`📁 Static files: public/`);
      if (config.database.mongoUri) {
        console.log(`💾 Database: MongoDB Connected`);
      }
      console.log(`\n📋 Available endpoints:`);
      console.log(`  GET  /health - Health check`);
      console.log(`  POST /analyze - Analyze text with Groq AI`);
      console.log(`================================\n`);
    });

    // Handle shutdown signals
    process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
    process.on('SIGINT', () => gracefulShutdown('SIGINT'));

    return server;
  } catch (error) {
    logger.error('Failed to start server', {
      error: error.message,
      stack: error.stack,
    });
    process.exit(1);
  }
}

// Handle uncaught exceptions
process.on('uncaughtException', (err) => {
  logger.error('Uncaught Exception', {
    error: err.message,
    stack: err.stack,
  });
  process.exit(1);
});

// Handle unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled Rejection', {
    reason: reason?.message || reason,
    promise,
  });
  process.exit(1);
});

// Start the server
const server = startServer();
