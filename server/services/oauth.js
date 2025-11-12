/**
 * OAuth Service
 * Handles OAuth2 flows for Google Sheets and Facebook
 */

import { google } from 'googleapis';
import crypto from 'crypto';

class OAuthService {
  constructor() {
    this.handshakes = new Map(); // handshakeId -> { providerId, state, status, expiresAt }
    this.states = new Map(); // state -> handshakeId
  }

  /**
   * Start OAuth flow
   * @param {string} providerId - Provider ID
   * @param {string} redirectUri - OAuth redirect URI
   * @param {Object} oauthConfig - User-provided OAuth config { clientId, clientSecret }
   */
  async startFlow(providerId, redirectUri, oauthConfig = null) {
    const handshakeId = crypto.randomBytes(16).toString('hex');
    const state = crypto.randomBytes(16).toString('hex');

    let authUrl;
    let expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

    switch (providerId) {
      case 'sheets_oauth':
      case 'google_sheets':
        authUrl = await this.startGoogleOAuth(state, redirectUri, oauthConfig);
        break;

      case 'facebook_oauth':
      case 'facebook':
        authUrl = await this.startFacebookOAuth(state, redirectUri, oauthConfig);
        break;

      default:
        throw new Error(`OAuth not supported for provider: ${providerId}`);
    }

    this.handshakes.set(handshakeId, {
      providerId,
      state,
      status: 'pending',
      expiresAt: expiresAt.toISOString(),
      redirectUri,
      oauthConfig, // Store OAuth config for callback
    });

    this.states.set(state, handshakeId);

    // Clean up expired handshakes
    this.cleanupExpired();

    return {
      authUrl,
      handshakeId,
      expiresAt: expiresAt.toISOString(),
    };
  }

  /**
   * Start Google OAuth flow
   * @param {string} state - OAuth state parameter
   * @param {string} redirectUri - OAuth redirect URI
   * @param {Object} oauthConfig - User-provided OAuth config { clientId, clientSecret }
   */
  async startGoogleOAuth(state, redirectUri, oauthConfig = null) {
    // Use user-provided config if available, otherwise fall back to env vars
    const clientId = oauthConfig?.clientId || process.env.GOOGLE_CLIENT_ID || process.env.VITE_GOOGLE_CLIENT_ID;
    const clientSecret = oauthConfig?.clientSecret || process.env.GOOGLE_CLIENT_SECRET;

    if (!clientId) {
      throw new Error('Google Client ID not configured. Please provide Client ID in the connection form.');
    }

    const oauth2Client = new google.auth.OAuth2(
      clientId,
      clientSecret,
      redirectUri || `${process.env.FRONTEND_URL || 'http://localhost:5173'}/oauth/callback`
    );

    const scopes = [
      'https://www.googleapis.com/auth/spreadsheets',
      'https://www.googleapis.com/auth/userinfo.email',
    ];

    const authUrl = oauth2Client.generateAuthUrl({
      access_type: 'offline',
      scope: scopes,
      state,
      prompt: 'consent', // Force consent to get refresh token
    });

    return authUrl;
  }

  /**
   * Start Facebook OAuth flow
   * @param {string} state - OAuth state parameter
   * @param {string} redirectUri - OAuth redirect URI
   * @param {Object} oauthConfig - User-provided OAuth config { clientId, clientSecret }
   */
  async startFacebookOAuth(state, redirectUri, oauthConfig = null) {
    // Use user-provided config if available, otherwise fall back to env vars
    const clientId = oauthConfig?.clientId || process.env.FACEBOOK_APP_ID || process.env.VITE_FACEBOOK_APP_ID;
    const clientSecret = oauthConfig?.clientSecret || process.env.FACEBOOK_APP_SECRET;

    if (!clientId) {
      throw new Error('Facebook App ID not configured. Please provide App ID in the connection form.');
    }

    const redirect = redirectUri || `${process.env.FRONTEND_URL || 'http://localhost:5173'}/oauth/callback`;
    const scopes = ['pages_manage_posts', 'pages_read_engagement', 'pages_show_list'];

    const authUrl = `https://www.facebook.com/v18.0/dialog/oauth?` +
      `client_id=${clientId}` +
      `&redirect_uri=${encodeURIComponent(redirect)}` +
      `&scope=${scopes.join(',')}` +
      `&state=${state}` +
      `&response_type=code`;

    return authUrl;
  }

  /**
   * Check OAuth status
   */
  checkStatus(handshakeId) {
    const handshake = this.handshakes.get(handshakeId);

    if (!handshake) {
      return {
        status: 'expired',
        error: 'Handshake not found or expired',
      };
    }

    if (new Date(handshake.expiresAt) < new Date()) {
      this.handshakes.delete(handshakeId);
      this.states.delete(handshake.state);
      return {
        status: 'expired',
        error: 'Handshake expired',
      };
    }

    return {
      status: handshake.status,
      expiresAt: handshake.expiresAt,
      credentials: handshake.credentials,
      error: handshake.error,
    };
  }

  /**
   * Handle OAuth callback
   */
  async handleCallback(providerId, code, state) {
    const handshakeId = this.states.get(state);

    if (!handshakeId) {
      return {
        success: false,
        error: 'Invalid state parameter',
      };
    }

    const handshake = this.handshakes.get(handshakeId);

    if (!handshake || handshake.providerId !== providerId) {
      return {
        success: false,
        error: 'Invalid handshake',
      };
    }

    if (new Date(handshake.expiresAt) < new Date()) {
      this.handshakes.delete(handshakeId);
      this.states.delete(state);
      return {
        success: false,
        error: 'Handshake expired',
      };
    }

    try {
      let credentials;
      let expiresAt;

      // Use stored OAuth config from handshake
      const oauthConfig = handshake.oauthConfig;

      switch (providerId) {
        case 'sheets_oauth':
        case 'google_sheets':
          ({ credentials, expiresAt } = await this.handleGoogleCallback(code, handshake.redirectUri, oauthConfig));
          break;

        case 'facebook_oauth':
        case 'facebook':
          ({ credentials, expiresAt } = await this.handleFacebookCallback(code, handshake.redirectUri, oauthConfig));
          break;

        default:
          throw new Error(`OAuth not supported for provider: ${providerId}`);
      }

      // Update handshake
      handshake.status = 'completed';
      handshake.credentials = credentials;
      handshake.expiresAt = expiresAt;

      // Clean up state
      this.states.delete(state);

      return {
        success: true,
        credentials,
        expiresAt,
      };
    } catch (error) {
      handshake.status = 'failed';
      handshake.error = error.message;

      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * Handle Google OAuth callback
   * @param {string} code - OAuth authorization code
   * @param {string} redirectUri - OAuth redirect URI
   * @param {Object} oauthConfig - User-provided OAuth config { clientId, clientSecret }
   */
  async handleGoogleCallback(code, redirectUri, oauthConfig = null) {
    // Use user-provided config if available, otherwise fall back to env vars
    const clientId = oauthConfig?.clientId || process.env.GOOGLE_CLIENT_ID || process.env.VITE_GOOGLE_CLIENT_ID;
    const clientSecret = oauthConfig?.clientSecret || process.env.GOOGLE_CLIENT_SECRET;

    const oauth2Client = new google.auth.OAuth2(
      clientId,
      clientSecret,
      redirectUri
    );

    const { tokens } = await oauth2Client.getToken(code);

    oauth2Client.setCredentials(tokens);

    // Get user info
    const oauth2 = google.oauth2({ version: 'v2', auth: oauth2Client });
    const userInfo = await oauth2.userinfo.get();

    return {
      credentials: {
        accessToken: tokens.access_token,
        refreshToken: tokens.refresh_token,
        tokenType: tokens.token_type,
        expiryDate: tokens.expiry_date,
        email: userInfo.data.email,
      },
      expiresAt: tokens.expiry_date ? new Date(tokens.expiry_date).toISOString() : undefined,
    };
  }

  /**
   * Handle Facebook OAuth callback
   * @param {string} code - OAuth authorization code
   * @param {string} redirectUri - OAuth redirect URI
   * @param {Object} oauthConfig - User-provided OAuth config { clientId, clientSecret }
   */
  async handleFacebookCallback(code, redirectUri, oauthConfig = null) {
    // Use user-provided config if available, otherwise fall back to env vars
    const clientId = oauthConfig?.clientId || process.env.FACEBOOK_APP_ID || process.env.VITE_FACEBOOK_APP_ID;
    const clientSecret = oauthConfig?.clientSecret || process.env.FACEBOOK_APP_SECRET;

    // Exchange code for access token
    const tokenUrl = `https://graph.facebook.com/v18.0/oauth/access_token?` +
      `client_id=${clientId}` +
      `&client_secret=${clientSecret}` +
      `&redirect_uri=${encodeURIComponent(redirectUri)}` +
      `&code=${code}`;

    const tokenResponse = await fetch(tokenUrl);
    const tokenData = await tokenResponse.json();

    if (tokenData.error) {
      throw new Error(tokenData.error.message || 'Failed to get access token');
    }

    const accessToken = tokenData.access_token;
    const expiresIn = tokenData.expires_in;

    // Get user info
    const userResponse = await fetch(
      `https://graph.facebook.com/v18.0/me?access_token=${accessToken}&fields=id,name,email`
    );
    const userData = await userResponse.json();

    if (userData.error) {
      throw new Error(userData.error.message || 'Failed to get user info');
    }

    const expiresAt = expiresIn
      ? new Date(Date.now() + expiresIn * 1000).toISOString()
      : undefined;

    return {
      credentials: {
        accessToken,
        userId: userData.id,
        userName: userData.name,
        email: userData.email,
        expiresIn,
      },
      expiresAt,
    };
  }

  /**
   * Clean up expired handshakes
   */
  cleanupExpired() {
    const now = new Date();
    for (const [handshakeId, handshake] of this.handshakes.entries()) {
      if (new Date(handshake.expiresAt) < now) {
        this.handshakes.delete(handshakeId);
        this.states.delete(handshake.state);
      }
    }
  }
}

export const oauthService = new OAuthService();

