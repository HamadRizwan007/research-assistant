const groqService = require('../services/groqService');
const { asyncHandler } = require('../middleware/errorHandler');
const logger = require('../utils/logger');
const { getConnectionState } = require('../utils/database');
const Analysis = require('../models/Analysis');
const pdfParseLib = require('pdf-parse');

/**
 * Parse PDF buffer with pdf-parse v1/v2 compatibility
 */
const parsePdfBuffer = async (buffer) => {
  if (typeof pdfParseLib === 'function') {
    return pdfParseLib(buffer);
  }

  if (pdfParseLib && typeof pdfParseLib.PDFParse === 'function') {
    const parser = new pdfParseLib.PDFParse({ data: buffer });
    try {
      return await parser.getText();
    } finally {
      if (typeof parser.destroy === 'function') {
        await parser.destroy();
      }
    }
  }

  throw new Error('Unsupported pdf-parse module format');
};

/**
 * Analyze text using Groq AI
 * POST /analyze
 */
const analyzeText = asyncHandler(async (req, res) => {
  const { text } = req.body;

  logger.info('Processing text analysis request', {
    ip: req.ip,
    textLength: text.length,
    userAgent: req.get('User-Agent'),
  });

  // Analyze the text using Groq service
  const analysis = await groqService.analyzeText(text);

  logger.info('Text analysis completed successfully', {
    ip: req.ip,
    hasSummary: !!analysis.summary,
    keyPointsCount: analysis.keyPoints?.length || 0,
    limitationsCount: analysis.limitations?.length || 0,
  });

  // Save to DB when available
  try {
    const dbState = getConnectionState();
    if (dbState.connected) {
      const analysisDoc = new Analysis({
        text,
        summary: analysis.summary,
        keyPoints: analysis.keyPoints || [],
        limitations: analysis.limitations || [],
        futureWork: analysis.futureWork || [],
        source: 'text'
      });
      await analysisDoc.save();
    }
  } catch (dbError) {
    logger.error('Failed to save analysis to database', { error: dbError.message, ip: req.ip });
  }

  // Send successful response
  res.status(200).json({
    success: true,
    data: analysis,
    metadata: {
      analyzedAt: new Date().toISOString(),
      textLength: text.length,
      model: 'groq',
    },
  });
});

/**
 * Generate academic email using Groq AI
 * POST /generate-email
 */
const generateEmail = asyncHandler(async (req, res) => {
  const { researchContext, professorName, researchArea } = req.body;

  logger.info('Processing generate email request', {
    ip: req.ip,
    researchContextLength: researchContext.length,
    hasProfessorName: Boolean(professorName),
    hasResearchArea: Boolean(researchArea),
    userAgent: req.get('User-Agent')
  });

  try {
    const generated = await groqService.generateAcademicEmail({
      researchContext,
      professorName,
      researchArea
    });

    logger.info('Generate email completed successfully', {
      ip: req.ip,
      subjectLength: generated.subject?.length || 0,
      emailLength: generated.email?.length || 0
    });

    return res.status(200).json({
      subject: generated.subject,
      email: generated.email
    });
  } catch (error) {
    logger.error('Generate email request failed', {
      ip: req.ip,
      error: error.message
    });

    return res.status(503).json({
      error: 'AI Service Unavailable',
      message: 'Failed to generate academic email',
      details: 'AI generation service is temporarily unavailable or returned an invalid response. Please try again later.'
    });
  }
});

/**
 * Get analysis history
 * GET /history
 */
const getAnalysisHistory = asyncHandler(async (req, res) => {
  const limit = parseInt(req.query.limit, 10) || 10;
  const page = parseInt(req.query.page, 10) || 1;
  const skip = (page - 1) * limit;

  const dbState = getConnectionState();
  if (!dbState.connected) {
    return res.status(200).json({
      success: true,
      data: [],
      pagination: {
        currentPage: page,
        totalPages: 0,
        totalItems: 0,
        itemsPerPage: limit,
        hasNext: false,
        hasPrev: false
      },
      message: 'Database not configured - analysis history not available'
    });
  }

  const total = await Analysis.countDocuments();
  const analyses = await Analysis.find()
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(limit)
    .select('text summary keyPoints limitations futureWork createdAt source fileName');

  const totalPages = Math.ceil(total / limit);
  res.status(200).json({
    success: true,
    data: analyses,
    pagination: {
      currentPage: page,
      totalPages,
      totalItems: total,
      itemsPerPage: limit,
      hasNext: page < totalPages,
      hasPrev: page > 1
    }
  });
});

/**
 * Health check endpoint
 * GET /health
 */
const healthCheck = asyncHandler(async (req, res) => {
  const groqHealthy = await groqService.healthCheck();
  const dbState = getConnectionState();

  const health = {
    status: (groqHealthy && dbState.connected) ? 'healthy' : 'degraded',
    timestamp: new Date().toISOString(),
    services: {
      groq: groqHealthy ? 'healthy' : 'unhealthy',
      database: dbState.connected ? 'healthy' : 'disconnected'
    },
    database: dbState.connected ? { state: dbState.state, host: dbState.host, database: dbState.database } : null,
    uptime: process.uptime(),
  };

  const statusCode = (groqHealthy && dbState.connected) ? 200 : 503;

  logger.info('Health check performed', {
    ip: req.ip,
    status: health.status,
    groqHealthy,
  });

  res.status(statusCode).json(health);
});

/**
 * Handle PDF upload and analysis
 * POST /upload-pdf
 */
const uploadPdf = asyncHandler(async (req, res) => {
  if (!req.file) {
    return res.status(400).json({
      error: 'No File Uploaded',
      message: 'No file provided',
      details: 'Please upload a PDF file using the "file" field'
    });
  }

  const allowedMimeTypes = ['application/pdf'];
  if (!allowedMimeTypes.includes(req.file.mimetype)) {
    return res.status(415).json({
      error: 'Invalid File Type',
      message: 'File type not supported',
      details: `Only PDF files are supported. Received: ${req.file.mimetype}`
    });
  }

  let extractedText = '';
  try {
    const pdfData = await parsePdfBuffer(req.file.buffer);
    extractedText = pdfData.text || '';
  } catch (parseError) {
    logger.error('Failed to extract text from PDF', { error: parseError.message, ip: req.ip });
    return res.status(400).json({
      error: 'PDF Parse Error',
      message: 'Failed to parse PDF file',
      details: 'The uploaded file could not be parsed. Please ensure it is a valid, non-corrupted PDF file.'
    });
  }

  if (!extractedText.trim()) {
    return res.status(422).json({
      error: 'No Text Extracted',
      message: 'PDF contains no extractable text',
      details: 'The PDF was parsed but no readable text was found.'
    });
  }

  const MAX_TEXT_LENGTH = 8000;
  const trimmedText = extractedText.substring(0, MAX_TEXT_LENGTH);

  let analysis = null;
  try {
    analysis = await groqService.analyzeText(trimmedText);
  } catch (analysisError) {
    logger.error('Failed to analyze extracted PDF text', { error: analysisError.message, ip: req.ip });
    return res.status(503).json({
      error: 'AI Service Unavailable',
      message: 'Failed to analyze PDF content',
      details: 'AI analysis service is temporarily unavailable. Please try again later.'
    });
  }

  try {
    const dbState = getConnectionState();
    if (dbState.connected) {
      const analysisDoc = new Analysis({
        text: trimmedText,
        summary: analysis.summary,
        keyPoints: analysis.keyPoints || [],
        limitations: analysis.limitations || [],
        futureWork: analysis.futureWork || [],
        source: 'pdf',
        fileName: req.file.originalname
      });
      await analysisDoc.save();
    }
  } catch (dbError) {
    logger.error('Failed to save PDF analysis to database', { error: dbError.message, ip: req.ip });
  }

  res.status(200).json({
    success: true,
    data: {
      fileName: req.file.originalname,
      textLength: trimmedText.length,
      analysis
    }
  });
});

module.exports = {
  analyzeText,
  generateEmail,
  getAnalysisHistory,
  healthCheck,
  uploadPdf,
};