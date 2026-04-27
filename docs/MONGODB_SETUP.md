# MongoDB Setup Guide

This application includes MongoDB/Mongoose support for persistent data storage.

## Configuration

### Environment Variables

Add to your `.env` file:

```env
# MongoDB URI (Optional - if not set, MongoDB features are disabled)
MONGO_URI=mongodb://localhost:27017/research-assistant
```

### Connection Formats

**Local MongoDB:**
```
mongodb://localhost:27017/research-assistant
```

**MongoDB Atlas (Cloud):**
```
mongodb+srv://username:password@cluster0.mongodb.net/research-assistant
```

**With Authentication:**
```
mongodb://username:password@localhost:27017/research-assistant?authSource=admin
```

## Features

### Automatic Connection Management

- ✅ **Auto-connect on startup**: Attempts to connect to MongoDB if `MONGO_URI` is set
- ✅ **Connection pooling**: Configurable min/max pool size (2-10 connections)
- ✅ **Error handling**: Comprehensive error logging with retry information
- ✅ **Event listeners**: Tracks connection, disconnection, and reconnection events
- ✅ **Graceful shutdown**: Properly closes database connections on app termination

### Connection Configuration

Located in `src/utils/database.js`:

- **Max Pool Size**: 10 connections
- **Min Pool Size**: 2 connections
- **Max Idle Time**: 45 seconds
- **Connection Timeout**: 10 seconds
- **Server Selection Timeout**: 5 seconds
- **Retries**: Automatic with write concern

## Models

### Example: Analysis Model

Location: `src/models/Analysis.js`

```javascript
{
  text: String,              // Original text to analyze
  summary: String,           // AI-generated summary
  keyPoints: [String],       // Key points extracted
  limitations: [String],     // Identified limitations
  model: String,            // AI model used (e.g., 'groq')
  processingTime: Number,   // Time taken in ms
  userIp: String,          // User's IP address
  status: String,          // 'pending', 'completed', or 'failed'
  error: String,           // Error message if failed
  createdAt: Date,         // Auto-generated timestamp
  updatedAt: Date          // Auto-generated timestamp
}
```

## Usage Examples

### Save Analysis Result to Database

```javascript
const Analysis = require('../models/Analysis');

const analysis = new Analysis({
  text: 'Your text to analyze',
  summary: 'Summary result',
  keyPoints: ['Point 1', 'Point 2'],
  limitations: ['Limitation 1'],
  model: 'groq',
  processingTime: 1234,
  userIp: '192.168.1.1',
  status: 'completed'
});

await analysis.save();
```

### Query Analyses

```javascript
// Find all analyses
const allAnalyses = await Analysis.find();

// Find by status
const completed = await Analysis.find({ status: 'completed' });

// Find recent analyses (last 24 hours)
const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
const recent = await Analysis.find({ createdAt: { $gte: oneDayAgo } });

// Find by user IP
const userAnalyses = await Analysis.find({ userIp: '192.168.1.1' });

// Pagination
const page1 = await Analysis.find()
  .limit(10)
  .skip(0)
  .sort({ createdAt: -1 });
```

### Update Analysis

```javascript
const analysis = await Analysis.findById(id);
analysis.status = 'completed';
await analysis.save();
```

### Delete Analysis

```javascript
await Analysis.deleteOne({ _id: id });
```

## Health Check Response

The `/health` endpoint includes database connection status:

```json
{
  "status": "healthy",
  "services": {
    "groq": "healthy",
    "database": "healthy"
  },
  "database": {
    "state": "Connected",
    "host": "localhost",
    "database": "research-assistant",
    "models": ["Analysis"]
  },
  "uptime": 3600
}
```

## Troubleshooting

### Connection Failed

**Issue**: "MongoNetworkError: connect ECONNREFUSED"

**Solutions**:
- Ensure MongoDB is running: `mongod`
- Check connection string in `.env`
- Verify firewall allows port 27017
- For MongoDB Atlas: Check IP whitelist in cluster settings

### Authentication Failed

**Issue**: "MongoAuthenticationError: authentication failed"

**Solutions**:
- Verify username and password are correct
- Ensure database name is correct in connection string
- Check that user has proper database access

### Connection Timeout

**Issue**: "serverSelectionTimeoutMS"

**Solutions**:
- Check network connectivity
- Verify MongoDB server is running
- Increase timeout in `src/config/index.js`

### MongoDB Not Required

If you don't want to use MongoDB:
1. Don't set `MONGO_URI` in `.env`
2. App will skip database connection automatically
3. Features requiring database will be unavailable

## Logging

MongoDB connection events are logged using Winston:

```
info: Connecting to MongoDB...
info: ✅ MongoDB connected successfully
info: Mongoose connected to MongoDB
info: Mongoose disconnected from MongoDB
error: ❌ MongoDB connection failed
```

Check `logs/combined.log` for detailed connection information.

## Performance Tips

1. **Indexing**: Indexes are created on `createdAt`, `status`, and `userIp`
2. **Batch Operations**: Use `insertMany()` for multiple documents
3. **Projection**: Specify fields to retrieve: `Analysis.find({}, 'text summary')`
4. **Connection Pooling**: Configured automatically
5. **Query Optimization**: Use `.explain()` to analyze query performance

## Production Deployment

For production:

1. Use MongoDB Atlas for managed hosting
2. Enable IP whitelist restrictions
3. Use connection pooling (included)
4. Enable retryWrites for better reliability
5. Monitor connection logs regularly
6. Set up automated backups

## Next Steps

1. Install and run MongoDB locally or use MongoDB Atlas
2. Add your `MONGO_URI` to `.env`
3. Extend `Analysis` model or create new models as needed
4. Update controller to persist analysis results to database