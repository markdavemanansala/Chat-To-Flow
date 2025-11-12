/**
 * Email Service using Nodemailer
 */

import nodemailer from 'nodemailer';

/**
 * Create SMTP transporter from config
 */
function createTransporter(smtpConfig) {
  // If smtpConfig is a string, try to parse it as JSON
  let config = smtpConfig;
  if (typeof smtpConfig === 'string') {
    try {
      config = JSON.parse(smtpConfig);
    } catch {
      // If not JSON, assume it's a simple API key
      config = { apiKey: smtpConfig };
    }
  }

  // Use environment variables if config is not provided
  const host = config.host || process.env.SMTP_HOST;
  const port = config.port || parseInt(process.env.SMTP_PORT || '587');
  const secure = config.secure !== undefined ? config.secure : (port === 465);
  const user = config.user || config.auth?.user || process.env.SMTP_USER;
  const pass = config.pass || config.auth?.pass || process.env.SMTP_PASS;
  const from = config.from || process.env.SMTP_FROM || user;

  if (!host || !user || !pass) {
    throw new Error('SMTP configuration incomplete. Required: host, user, pass');
  }

  return nodemailer.createTransport({
    host,
    port,
    secure,
    auth: {
      user,
      pass,
    },
  });
}

/**
 * Send an email
 */
export async function sendEmail({ to, subject, body, smtpConfig, from, html }) {
  try {
    const transporter = createTransporter(smtpConfig);

    // Determine from address
    let fromAddress = from;
    if (!fromAddress && smtpConfig) {
      const config = typeof smtpConfig === 'string' ? JSON.parse(smtpConfig) : smtpConfig;
      fromAddress = config.from || process.env.SMTP_FROM;
    }
    if (!fromAddress) {
      fromAddress = process.env.SMTP_FROM || process.env.SMTP_USER || 'noreply@aiagent.com';
    }

    const mailOptions = {
      from: fromAddress,
      to: Array.isArray(to) ? to.join(', ') : to,
      subject,
      text: body,
      html: html || body.replace(/\n/g, '<br>'),
    };

    const info = await transporter.sendMail(mailOptions);

    console.log(`✅ Email sent to ${to}: ${info.messageId}`);

    return {
      messageId: info.messageId,
      response: info.response,
      success: true,
    };
  } catch (error) {
    console.error('❌ Email send failed:', error);
    throw new Error(`Failed to send email: ${error.message}`);
  }
}

/**
 * Verify SMTP connection
 */
export async function verifySmtpConnection(smtpConfig) {
  try {
    const transporter = createTransporter(smtpConfig);
    await transporter.verify();
    return { success: true, message: 'SMTP connection verified' };
  } catch (error) {
    return { success: false, message: error.message };
  }
}

