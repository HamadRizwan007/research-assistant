const logger = require('../utils/logger');

/**
 * Global error handling middleware
 */
const errorHandler = (err, req, res, next) => {
  // Log the error
  logger.error('Unhandled error occurred', {
    error: err.message,
    stack: err.stack,
    url: req.url,
    method: req.method,
    ip: req.ip,
    userAgent: req.get('User-Agent'),
  });

  // Don't leak error details in production
  const isDevelopment = process.env.NODE_ENV !== 'production';

  // Default error response
  let statusCode = 500;
  let message = 'Internal Server Error';
  let details = isDevelopment ? err.message : 'Something went wrong';

  // Handle specific error types
  if (err.name === 'ValidationError') {
    statusCode = 400;
    message = 'Validation Error';
  } else if (err.name === 'CastError') {
    statusCode = 400;
    message = 'Invalid Data Format';
  } else if (err.code === 11000) {
    statusCode = 409;
    message = 'Duplicate Entry';
  } else if (err.message && err.message.includes('API key')) {
    statusCode = 500;
    message = 'Service Configuration Error';
    details = 'API service is not properly configured';
  }

  // Send error response
  res.status(statusCode).json({
    error: message,
    message: details,
    ...(isDevelopment && { stack: err.stack }),
    timestamp: new Date().toISOString(),
    path: req.url,
  });
};

/**
 * Handle 404 errors
 */
const notFoundHandler = (req, res) => {
  logger.warn('Route not found', {
    url: req.url,
    method: req.method,
    ip: req.ip,
  });

  res.status(404).json({
    error: 'Not Found',
    message: `Route ${req.method} ${req.url} not found`,
    availableRoutes: {
      'GET /health': 'Health check',
      'POST /analyze': 'Analyze text with Gemini AI',
    },
    timestamp: new Date().toISOString(),
  });
};

/**
 * Async error wrapper
 */
const asyncHandler = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};

module.exports = {
  errorHandler,
  notFoundHandler,
  asyncHandler,
};