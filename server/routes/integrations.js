/**
 * Integration API Routes
 * Handles all provider connections, OAuth, and credential management
 */

import express from 'express';
import { testProvider } from '../services/integrations.js';
import { saveCredentials, getCredentials, deleteCredentials, getAllCredentials } from '../db/credentials.js';
import { oauthService } from '../services/oauth.js';

export const integrationsRouter = express.Router();

/**
 * GET /api/integrations/status
 * Get connection status for all providers
 */
integrationsRouter.get('/status', async (req, res) => {
  try {
    const allCredentials = await getAllCredentials();
    const statuses = {};

    for (const [providerId, creds] of Object.entries(allCredentials)) {
      statuses[providerId] = {
        connected: !!creds,
        connectedAt: creds?.connectedAt,
        expiresAt: creds?.expiresAt,
        lastTested: creds?.lastTested,
      };
    }

    res.json(statuses);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/integrations/:providerId/test
 * Test connection for a provider
 */
integrationsRouter.post('/:providerId/test', async (req, res) => {
  try {
    const { providerId } = req.params;
    const credentials = req.body.credentials || req.body;

    // If no credentials provided, try to get from storage
    let credsToTest = credentials;
    if (!credsToTest || Object.keys(credsToTest).length === 0) {
      const stored = await getCredentials(providerId);
      if (stored) {
        credsToTest = stored.credentials;
      } else {
        return res.status(400).json({
          success: false,
          error: 'No credentials provided and none stored',
        });
      }
    }

    const result = await testProvider(providerId, credsToTest);

    // Update last tested time if credentials are stored
    if (result.success) {
      const stored = await getCredentials(providerId);
      if (stored) {
        await saveCredentials(providerId, stored.credentials, {
          ...stored,
          lastTested: new Date().toISOString(),
        });
      }
    }

    res.json(result);
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * POST /api/integrations/:providerId/credentials
 * Save provider credentials
 */
integrationsRouter.post('/:providerId/credentials', async (req, res) => {
  try {
    const { providerId } = req.params;
    const credentials = req.body.credentials || req.body;

    // Test credentials before saving
    const testResult = await testProvider(providerId, credentials);
    
    if (!testResult.success) {
      return res.status(400).json({
        success: false,
        error: testResult.error || 'Credentials validation failed',
      });
    }

    // Save credentials
    await saveCredentials(providerId, credentials, {
      connectedAt: new Date().toISOString(),
      lastTested: new Date().toISOString(),
      testData: testResult.data,
    });

    res.json({
      success: true,
      message: 'Credentials saved and validated',
      testData: testResult.data,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * GET /api/integrations/:providerId/credentials
 * Get provider credentials (without sensitive data)
 */
integrationsRouter.get('/:providerId/credentials', async (req, res) => {
  try {
    const { providerId } = req.params;
    const creds = await getCredentials(providerId);

    if (!creds) {
      return res.status(404).json({ error: 'Credentials not found' });
    }

    // Return metadata without sensitive data
    res.json({
      providerId,
      connected: true,
      connectedAt: creds.connectedAt,
      expiresAt: creds.expiresAt,
      lastTested: creds.lastTested,
      // Don't return actual credentials for security
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * DELETE /api/integrations/:providerId/credentials
 * Delete provider credentials
 */
integrationsRouter.delete('/:providerId/credentials', async (req, res) => {
  try {
    const { providerId } = req.params;
    const deleted = await deleteCredentials(providerId);

    if (!deleted) {
      return res.status(404).json({ error: 'Credentials not found' });
    }

    res.json({ success: true, message: 'Credentials deleted' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * OAuth Routes
 */

/**
 * POST /api/oauth/start/:providerId
 * Start OAuth flow
 */
integrationsRouter.post('/oauth/start/:providerId', async (req, res) => {
  try {
    const { providerId } = req.params;
    const { redirectUri, oauthConfig } = req.body;

    const result = await oauthService.startFlow(
      providerId, 
      redirectUri || req.body.redirect_uri,
      oauthConfig // User-provided OAuth credentials (clientId, clientSecret)
    );

    res.json(result);
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * GET /api/integrations/oauth/status/:handshakeId
 * Check OAuth status
 */
integrationsRouter.get('/oauth/status/:handshakeId', async (req, res) => {
  try {
    const { handshakeId } = req.params;
    const result = await oauthService.checkStatus(handshakeId);

    res.json(result);
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * GET /api/integrations/oauth/callback/:providerId
 * OAuth callback endpoint
 */
integrationsRouter.get('/oauth/callback/:providerId', async (req, res) => {
  try {
    const { providerId } = req.params;
    const { code, state, error } = req.query;

    if (error) {
      return res.redirect(`/?oauth_error=${encodeURIComponent(error)}`);
    }

    if (!code || !state) {
      return res.redirect(`/?oauth_error=${encodeURIComponent('Missing code or state')}`);
    }

    const result = await oauthService.handleCallback(providerId, code, state);

    if (result.success) {
      // Save credentials
      await saveCredentials(providerId, result.credentials, {
        connectedAt: new Date().toISOString(),
        expiresAt: result.expiresAt,
        lastTested: new Date().toISOString(),
      });

      return res.redirect(`/?oauth_success=${providerId}`);
    } else {
      return res.redirect(`/?oauth_error=${encodeURIComponent(result.error || 'OAuth failed')}`);
    }
  } catch (error) {
    res.redirect(`/?oauth_error=${encodeURIComponent(error.message)}`);
  }
});

