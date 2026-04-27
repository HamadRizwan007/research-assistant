const mongoose = require('mongoose');
const logger = require('../utils/logger');

/**
 * Analysis Schema
 * Stores text analysis history with summaries, key points, and limitations
 */
const analysisSchema = new mongoose.Schema({
  // The original text that was analyzed
  text: {
    type: String,
    required: [true, 'Text is required'],
    trim: true,
    maxlength: [10000, 'Text cannot exceed 10,000 characters']
  },

  // AI-generated summary of the text
  summary: {
    type: String,
    required: [true, 'Summary is required'],
    trim: true,
    maxlength: [2000, 'Summary cannot exceed 2,000 characters']
  },

  // Array of key points extracted from the text
  keyPoints: [{
    type: String,
    trim: true,
    maxlength: [500, 'Each key point cannot exceed 500 characters']
  }],

  // Array of limitations or potential issues identified
  limitations: [{
    type: String,
    trim: true,
    maxlength: [500, 'Each limitation cannot exceed 500 characters']
  }],

  // Array of potential future work or research directions
  futureWork: [{
    type: String,
    trim: true,
    maxlength: [500, 'Each future work item cannot exceed 500 characters']
  }],

  // Source of the analysis (e.g., "text", "pdf")
  source: {
    type: String,
    enum: ['text', 'pdf'],
    default: 'text'
  },

  // Original file name if source is "pdf"
  fileName: {
    type: String,
    trim: true,
    maxlength: [255, 'File name cannot exceed 255 characters']
  }
}, {
  timestamps: true, // Adds createdAt and updatedAt fields automatically
  collection: 'analyses'
});

// Indexes for better query performance
analysisSchema.index({ createdAt: -1 }); // Most recent analyses first
analysisSchema.index({ text: 'text' }); // Text search capability

// Virtual for analysis age in days
analysisSchema.virtual('ageInDays').get(function() {
  return Math.floor((Date.now() - this.createdAt) / (1000 * 60 * 60 * 24));
});

// Instance method to get a summary of the analysis
analysisSchema.methods.getSummary = function() {
  return {
    id: this._id,
    textPreview: this.text.substring(0, 100) + (this.text.length > 100 ? '...' : ''),
    summary: this.summary,
    keyPointsCount: this.keyPoints.length,
    limitationsCount: this.limitations.length,
    createdAt: this.createdAt
  };
};

// Static method to get recent analyses
analysisSchema.statics.getRecent = function(limit = 10) {
  return this.find()
    .sort({ createdAt: -1 })
    .limit(limit)
    .select('text summary keyPoints limitations createdAt');
};

// Static method to get basic analytics
analysisSchema.statics.getAnalytics = function(days = 30) {
  const cutoffDate = new Date(Date.now() - (days * 24 * 60 * 60 * 1000));

  return this.aggregate([
    { $match: { createdAt: { $gte: cutoffDate } } },
    {
      $group: {
        _id: null,
        totalAnalyses: { $sum: 1 },
        averageTextLength: { $avg: { $strLenCP: '$text' } },
        totalKeyPoints: { $sum: { $size: '$keyPoints' } },
        totalLimitations: { $sum: { $size: '$limitations' } }
      }
    },
    {
      $project: {
        totalAnalyses: 1,
        averageTextLength: { $round: ['$averageTextLength', 0] },
        totalKeyPoints: 1,
        totalLimitations: 1
      }
    }
  ]);
};

// Post-save middleware for logging
analysisSchema.post('save', function(doc) {
  logger.info('Analysis document saved successfully', {
    id: doc._id,
    createdAt: doc.createdAt
  });
});

module.exports = mongoose.model('Analysis', analysisSchema);