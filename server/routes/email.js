/**
 * Email API Routes
 */

import express from 'express';
import { sendEmail } from '../services/email.js';

export const emailRouter = express.Router();

/**
 * POST /api/email/send
 * Send an email
 */
emailRouter.post('/send', async (req, res) => {
  try {
    const { to, subject, body, smtpConfig } = req.body;

    if (!to || !subject) {
      return res.status(400).json({
        error: 'Missing required fields: to, subject',
      });
    }

    const result = await sendEmail({
      to,
      subject,
      body,
      smtpConfig,
    });

    res.json({
      success: true,
      emailId: result.messageId || `email_${Date.now()}`,
      to,
      subject,
      message: 'Email sent successfully',
    });
  } catch (error) {
    console.error('Email send error:', error);
    res.status(500).json({
      error: 'Failed to send email',
      message: error.message,
    });
  }
});

/**
 * POST /api/email/test
 * Test email configuration
 */
emailRouter.post('/test', async (req, res) => {
  try {
    const { smtpConfig } = req.body;

    if (!smtpConfig) {
      return res.status(400).json({
        error: 'Missing smtpConfig',
      });
    }

    // Test connection
    const result = await sendEmail({
      to: smtpConfig.testEmail || smtpConfig.from || 'test@example.com',
      subject: 'Test Email',
      body: 'This is a test email from AI Agent Workflow Automation.',
      smtpConfig,
    });

    res.json({
      success: true,
      message: 'Test email sent successfully',
      messageId: result.messageId,
    });
  } catch (error) {
    console.error('Email test error:', error);
    res.status(500).json({
      error: 'Failed to send test email',
      message: error.message,
    });
  }
});

