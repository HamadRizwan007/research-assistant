const express = require('express');
const { analyzeText, generateEmail, getAnalysisHistory, healthCheck, uploadPdf } = require('../controllers/analysisController');
const { validateTextAnalysis, validateGenerateEmail, validateRequest } = require('../middleware/validation');
const { uploadSinglePdf } = require('../middleware/multer');

const router = express.Router();

// Apply general validation to non-file-upload routes
router.use((req, res, next) => {
  // Skip validation for multipart/form-data requests (file uploads)
  if (req.headers['content-type'] && req.headers['content-type'].startsWith('multipart/form-data')) {
    return next();
  }
  validateRequest(req, res, next);
});

// Health check route
router.get('/health', healthCheck);

// Text analysis route with validation
router.post('/analyze', validateTextAnalysis, analyzeText);

// Academic email generation route with validation
router.post('/generate-email', validateGenerateEmail, generateEmail);

// Analysis history route
router.get('/history', getAnalysisHistory);

// PDF file upload route
router.post('/upload-pdf', uploadSinglePdf, uploadPdf);

module.exports = router;