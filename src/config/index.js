require('dotenv').config();

const config = {
  // Server configuration
  port: process.env.PORT || 3000,

  // Groq API configuration
  groq: {
    apiKey: process.env.GROQ_API_KEY,
    model: process.env.GROQ_MODEL || 'llama-3.1-8b-instant',
    fallbackModels: (process.env.GROQ_FALLBACK_MODELS || '')
      .split(',')
      .map((model) => model.trim())
      .filter(Boolean),
  },

  // Environment
  env: process.env.NODE_ENV || 'development',

  // CORS configuration
  cors: {
    origin: process.env.CORS_ORIGIN || '*',
    credentials: true,
  },

  // Rate limiting
  rateLimit: {
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100, // limit each IP to 100 requests per windowMs
  },

  // Logging
  logging: {
    level: process.env.LOG_LEVEL || 'info',
  },

  // MongoDB/Mongoose configuration
  database: {
    mongoUri: process.env.MONGO_URI,
    options: {
      maxPoolSize: 10,
      minPoolSize: 2,
      maxIdleTimeMS: 45000,
      socketTimeoutMS: 45000,
      connectTimeoutMS: 10000,
      serverSelectionTimeoutMS: 5000,
      retryWrites: true,
      w: 'majority',
    },
  },
};

// Validate required configuration
const validateConfig = () => {
  const required = ['groq.apiKey'];

  for (const key of required) {
    const keys = key.split('.');
    let value = config;

    for (const k of keys) {
      value = value[k];
    }

    if (!value) {
      throw new Error(`Missing required configuration: ${key}`);
    }
  }
};

validateConfig();

module.exports = config;