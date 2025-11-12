/**
 * Backend Server for AI Agent Workflow Automation
 * Handles workflow execution, cron scheduling, and email notifications
 */

import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { emailRouter } from './routes/email.js';
import { workflowRouter } from './routes/workflows.js';
import { integrationsRouter } from './routes/integrations.js';
import { webhookRouter } from './routes/webhooks.js';
import { schedulerService } from './services/scheduler.js';
import { initDatabase } from './db/index.js';

// Load environment variables
dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:5173',
  credentials: true,
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Ignore Chrome DevTools requests
app.get('/.well-known/*', (req, res) => {
  res.status(404).json({ error: 'Not found' });
});

// Root route
app.get('/', (req, res) => {
  res.json({ 
    name: 'AI Agent Workflow Automation API',
    version: '1.0.0',
    status: 'running',
    endpoints: {
      health: '/health',
      api: '/api',
      integrations: '/api/integrations',
      workflows: '/api/workflows',
      email: '/api/email',
      webhooks: '/api/webhooks',
    },
    timestamp: new Date().toISOString(),
  });
});

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// API Routes
app.use('/api/email', emailRouter);
app.use('/api/workflows', workflowRouter);
app.use('/api/integrations', integrationsRouter);
app.use('/api/webhooks', webhookRouter);

// Initialize database
initDatabase().then(() => {
  console.log('✅ Database initialized');
  
  // Start scheduler service
  schedulerService.start();
  console.log('✅ Scheduler service started');
  
  // Start server
  app.listen(PORT, () => {
    console.log(`🚀 Server running on http://localhost:${PORT}`);
    console.log(`📧 Email service: ${process.env.SMTP_HOST ? 'configured' : 'not configured'}`);
    console.log(`⏰ Cron scheduler: active`);
  });
}).catch((error) => {
  console.error('❌ Failed to initialize:', error);
  process.exit(1);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received, shutting down gracefully...');
  schedulerService.stop();
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('SIGINT received, shutting down gracefully...');
  schedulerService.stop();
  process.exit(0);
});

export default app;

