const multer = require('multer');
const logger = require('../utils/logger');

/**
 * Configure multer for in-memory PDF file uploads
 * Stores files in memory buffer without writing to disk
 */
const storage = multer.memoryStorage();

const fileFilter = (req, file, cb) => {
  // Validate file exists
  if (!file) {
    const error = new Error('No file provided');
    error.statusCode = 400;
    return cb(error);
  }

  // Validate MIME type and extension
  const allowedMimeTypes = ['application/pdf'];
  const mimeTypeValid = allowedMimeTypes.includes(file.mimetype);
  const filenameValid = file.originalname.toLowerCase().endsWith('.pdf');

  if (!mimeTypeValid || !filenameValid) {
    logger.warn('PDF upload rejected - invalid file type', {
      originalName: file.originalname,
      mimetype: file.mimetype,
    });
    const error = new Error('Invalid file type. Only PDF files are allowed');
    error.statusCode = 400;
    return cb(error);
  }

  cb(null, true);
};

const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 50 * 1024 * 1024, // 50MB limit
  },
});

const uploadSinglePdf = upload.single('file');

module.exports = {
  upload,
  uploadSinglePdf,
};
