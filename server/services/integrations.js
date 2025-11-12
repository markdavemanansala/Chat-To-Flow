/**
 * Integration Service
 * Handles all provider integrations: Telegram, Google Sheets, Facebook, Email, Webhooks
 */

import { google } from 'googleapis';
import { sendEmail } from './email.js';

/**
 * Test Telegram connection
 */
export async function testTelegram(credentials) {
  try {
    const botToken = credentials.botToken || credentials.token;
    if (!botToken) {
      throw new Error('Bot token required');
    }

    const response = await fetch(`https://api.telegram.org/bot${botToken}/getMe`);
    const data = await response.json();

    if (!data.ok) {
      throw new Error(data.description || 'Invalid bot token');
    }

    return {
      success: true,
      data: {
        id: data.result.id,
        username: data.result.username,
        firstName: data.result.first_name,
        isBot: data.result.is_bot,
      },
    };
  } catch (error) {
    return {
      success: false,
      error: error.message || 'Failed to connect to Telegram',
    };
  }
}

/**
 * Test Google Sheets connection (Service Account)
 */
export async function testGoogleSheets(credentials) {
  try {
    let serviceAccount;
    
    if (typeof credentials === 'string') {
      serviceAccount = JSON.parse(credentials);
    } else if (credentials.serviceAccountJson) {
      serviceAccount = typeof credentials.serviceAccountJson === 'string'
        ? JSON.parse(credentials.serviceAccountJson)
        : credentials.serviceAccountJson;
    } else {
      serviceAccount = credentials;
    }

    if (!serviceAccount.client_email || !serviceAccount.private_key) {
      throw new Error('Invalid service account JSON');
    }

    const auth = new google.auth.GoogleAuth({
      credentials: serviceAccount,
      scopes: ['https://www.googleapis.com/auth/spreadsheets'],
    });

    const sheets = google.sheets({ version: 'v4', auth });
    
    // Test by listing spreadsheets (requires Drive API scope, but we'll try a simple call)
    // For now, just verify credentials are valid
    const client = await auth.getClient();
    
    return {
      success: true,
      data: {
        email: serviceAccount.client_email,
        projectId: serviceAccount.project_id,
      },
    };
  } catch (error) {
    return {
      success: false,
      error: error.message || 'Failed to connect to Google Sheets',
    };
  }
}

/**
 * Test Google Sheets connection (OAuth2)
 */
export async function testGoogleSheetsOAuth(credentials) {
  try {
    const accessToken = credentials.accessToken || credentials.access_token;
    if (!accessToken) {
      throw new Error('Access token required');
    }

    const auth = new google.auth.OAuth2();
    auth.setCredentials({ access_token: accessToken });

    const sheets = google.sheets({ version: 'v4', auth });
    
    // Test by getting user info
    const oauth2 = google.oauth2({ version: 'v2', auth });
    const userInfo = await oauth2.userinfo.get();

    return {
      success: true,
      data: {
        email: userInfo.data.email,
        name: userInfo.data.name,
      },
    };
  } catch (error) {
    return {
      success: false,
      error: error.message || 'Failed to connect to Google Sheets',
    };
  }
}

/**
 * Test Facebook connection (API Key)
 */
export async function testFacebook(credentials) {
  try {
    const appId = credentials.appId;
    const appSecret = credentials.appSecret;
    const accessToken = credentials.accessToken;

    if (!appId || !appSecret) {
      throw new Error('App ID and App Secret required');
    }

    // Test by getting app info
    const response = await fetch(
      `https://graph.facebook.com/v18.0/${appId}?access_token=${appId}|${appSecret}`
    );
    const data = await response.json();

    if (data.error) {
      throw new Error(data.error.message || 'Invalid credentials');
    }

    const result = {
      success: true,
      data: {
        appId: data.id,
        name: data.name,
      },
    };

    // If access token provided, test it
    if (accessToken) {
      try {
        const tokenResponse = await fetch(
          `https://graph.facebook.com/v18.0/me?access_token=${accessToken}`
        );
        const tokenData = await tokenResponse.json();
        
        if (!tokenData.error) {
          result.data.accessTokenValid = true;
          result.data.userId = tokenData.id;
        }
      } catch (e) {
        // Access token test failed, but app credentials are valid
        result.data.accessTokenValid = false;
      }
    }

    return result;
  } catch (error) {
    return {
      success: false,
      error: error.message || 'Failed to connect to Facebook',
    };
  }
}

/**
 * Test Facebook connection (OAuth2)
 */
export async function testFacebookOAuth(credentials) {
  try {
    const accessToken = credentials.accessToken || credentials.access_token;
    if (!accessToken) {
      throw new Error('Access token required');
    }

    const response = await fetch(
      `https://graph.facebook.com/v18.0/me?access_token=${accessToken}&fields=id,name,email`
    );
    const data = await response.json();

    if (data.error) {
      throw new Error(data.error.message || 'Invalid access token');
    }

    return {
      success: true,
      data: {
        id: data.id,
        name: data.name,
        email: data.email,
      },
    };
  } catch (error) {
    return {
      success: false,
      error: error.message || 'Failed to connect to Facebook',
    };
  }
}

/**
 * Test Email/SMTP connection
 */
export async function testEmail(credentials) {
  try {
    const smtpConfig = typeof credentials === 'string' ? JSON.parse(credentials) : credentials;
    
    // Use the email service to send a test email
    const testEmail = smtpConfig.testEmail || smtpConfig.username || smtpConfig.user;
    
    if (!testEmail) {
      throw new Error('Test email address required');
    }

    const result = await sendEmail({
      to: testEmail,
      subject: 'Test Email from AI Agent',
      body: 'This is a test email to verify your SMTP configuration.',
      smtpConfig,
    });

    return {
      success: true,
      data: {
        messageId: result.messageId,
        message: 'Test email sent successfully',
      },
    };
  } catch (error) {
    return {
      success: false,
      error: error.message || 'Failed to send test email',
    };
  }
}

/**
 * Test Webhook configuration
 */
export async function testWebhook(credentials) {
  try {
    const url = credentials.url || credentials.webhookUrl;
    const secret = credentials.secret || credentials.webhookSecret;

    if (!url) {
      throw new Error('Webhook URL required');
    }

    // Test by sending a test payload
    const testPayload = {
      test: true,
      timestamp: new Date().toISOString(),
      secret: secret ? '***' : undefined,
    };

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(secret ? { 'X-Webhook-Secret': secret } : {}),
      },
      body: JSON.stringify(testPayload),
    });

    return {
      success: response.ok,
      data: {
        status: response.status,
        statusText: response.statusText,
        url,
        verified: response.ok,
      },
      error: response.ok ? undefined : `Webhook returned status ${response.status}`,
    };
  } catch (error) {
    return {
      success: false,
      error: error.message || 'Failed to test webhook',
    };
  }
}

/**
 * Test any provider connection
 */
export async function testProvider(providerId, credentials) {
  switch (providerId) {
    case 'telegram':
      return testTelegram(credentials);
    
    case 'sheets':
      return testGoogleSheets(credentials);
    
    case 'sheets_oauth':
      return testGoogleSheetsOAuth(credentials);
    
    case 'facebook':
      return testFacebook(credentials);
    
    case 'facebook_oauth':
      return testFacebookOAuth(credentials);
    
    case 'email':
      return testEmail(credentials);
    
    case 'webhook':
      return testWebhook(credentials);
    
    default:
      return {
        success: false,
        error: `Unknown provider: ${providerId}`,
      };
  }
}

