const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 5050;

// Security middleware
app.use(helmet());

// CORS configuration - allow all origins for development
app.use(cors({
  origin: true, // Allow all origins
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'stripe-signature']
}));

// Logging middleware
app.use(morgan('combined'));

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development'
  });
});

// Stripe webhook endpoint (must be before express.json())
app.use('/webhooks', require('./routes/webhooks/stripe'));

// JSON parsing middleware (after webhook routes)
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// API routes
app.use('/api', require('./routes/payments'));
app.use('/api/admin', require('./routes/admin'));

// Root endpoint
app.get('/', (req, res) => {
  res.json({
    message: 'Rent Control Backend API',
    version: '1.0.0',
    endpoints: {
      health: '/health',
      createCheckoutSession: '/api/create-checkout-session',
      verifyPayment: '/api/verify-payment',
      stripeWebhook: '/webhooks/stripe'
    }
  });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Error:', err);
  res.status(500).json({
    error: 'Internal server error',
    message: process.env.NODE_ENV === 'development' ? err.message : 'Something went wrong'
  });
});

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({
    error: 'Not found',
    message: `Route ${req.originalUrl} not found`
  });
});

// Start server
app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Rent Control Backend running on port ${PORT}`);
  console.log(`📊 Health check: http://localhost:${PORT}/health`);
  console.log(`💳 Stripe webhook: http://localhost:${PORT}/webhooks/stripe`);
  console.log(`🔗 API endpoints: http://localhost:${PORT}/api`);
});

module.exports = app;

