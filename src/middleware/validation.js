const logger = require('../utils/logger');

/**
 * Validate text analysis request
 */
const validateTextAnalysis = (req, res, next) => {
  const { text } = req.body;

  // Check if text field exists
  if (!text) {
    logger.warn('Text analysis request missing text field', { ip: req.ip });
    return res.status(400).json({
      error: 'Validation Error',
      message: 'Text field is required',
      details: 'Please provide a "text" field in the request body'
    });
  }

  // Check if text is a string
  if (typeof text !== 'string') {
    logger.warn('Text analysis request with invalid text type', {
      ip: req.ip,
      textType: typeof text
    });
    return res.status(400).json({
      error: 'Validation Error',
      message: 'Text must be a string',
      details: 'The "text" field must be a string value'
    });
  }

  // Check if text is not empty after trimming
  if (text.trim() === '') {
    logger.warn('Text analysis request with empty text', { ip: req.ip });
    return res.status(400).json({
      error: 'Validation Error',
      message: 'Text cannot be empty',
      details: 'Please provide non-empty text to analyze'
    });
  }

  // Check text length (reasonable limits)
  const maxLength = 10000; // 10k characters
  if (text.length > maxLength) {
    logger.warn('Text analysis request too long', {
      ip: req.ip,
      textLength: text.length,
      maxLength
    });
    return res.status(400).json({
      error: 'Validation Error',
      message: 'Text too long',
      details: `Text must be less than ${maxLength} characters. Current length: ${text.length}`
    });
  }

  // Sanitize the text (basic)
  req.body.text = text.trim();

  logger.info('Text analysis request validated successfully', {
    ip: req.ip,
    textLength: req.body.text.length
  });

  next();
};

/**
 * Validate academic email generation request
 */
const validateGenerateEmail = (req, res, next) => {
  const { researchContext, professorName, researchArea } = req.body;

  if (!researchContext) {
    logger.warn('Generate email request missing researchContext field', { ip: req.ip });
    return res.status(400).json({
      error: 'Validation Error',
      message: 'researchContext field is required',
      details: 'Please provide a "researchContext" field in the request body'
    });
  }

  if (typeof researchContext !== 'string') {
    logger.warn('Generate email request with invalid researchContext type', {
      ip: req.ip,
      researchContextType: typeof researchContext
    });
    return res.status(400).json({
      error: 'Validation Error',
      message: 'researchContext must be a string',
      details: 'The "researchContext" field must be a string value'
    });
  }

  if (researchContext.trim() === '') {
    logger.warn('Generate email request with empty researchContext', { ip: req.ip });
    return res.status(400).json({
      error: 'Validation Error',
      message: 'researchContext cannot be empty',
      details: 'Please provide non-empty research context'
    });
  }

  if (professorName !== undefined && typeof professorName !== 'string') {
    logger.warn('Generate email request with invalid professorName type', {
      ip: req.ip,
      professorNameType: typeof professorName
    });
    return res.status(400).json({
      error: 'Validation Error',
      message: 'professorName must be a string',
      details: 'When provided, "professorName" must be a string value'
    });
  }

  if (researchArea !== undefined && typeof researchArea !== 'string') {
    logger.warn('Generate email request with invalid researchArea type', {
      ip: req.ip,
      researchAreaType: typeof researchArea
    });
    return res.status(400).json({
      error: 'Validation Error',
      message: 'researchArea must be a string',
      details: 'When provided, "researchArea" must be a string value'
    });
  }

  const maxContextLength = 10000;
  if (researchContext.length > maxContextLength) {
    logger.warn('Generate email request researchContext too long', {
      ip: req.ip,
      researchContextLength: researchContext.length,
      maxContextLength
    });
    return res.status(400).json({
      error: 'Validation Error',
      message: 'researchContext too long',
      details: `researchContext must be less than ${maxContextLength} characters. Current length: ${researchContext.length}`
    });
  }

  req.body.researchContext = researchContext.trim();
  if (typeof professorName === 'string') req.body.professorName = professorName.trim();
  if (typeof researchArea === 'string') req.body.researchArea = researchArea.trim();

  logger.info('Generate email request validated successfully', {
    ip: req.ip,
    researchContextLength: req.body.researchContext.length,
    hasProfessorName: Boolean(req.body.professorName),
    hasResearchArea: Boolean(req.body.researchArea)
  });

  next();
};

/**
 * General request validation middleware
 */
const validateRequest = (req, res, next) => {
  // Check content type for POST requests
  if (req.method === 'POST' && !req.is('application/json')) {
    logger.warn('Invalid content type for POST request', {
      ip: req.ip,
      contentType: req.get('content-type')
    });
    return res.status(400).json({
      error: 'Validation Error',
      message: 'Invalid Content-Type',
      details: 'POST requests must have Content-Type: application/json'
    });
  }

  next();
};

module.exports = {
  validateTextAnalysis,
  validateGenerateEmail,
  validateRequest,
};