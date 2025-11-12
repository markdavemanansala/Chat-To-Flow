/**
 * @fileoverview Connector manifests for all supported providers
 */

import { ConnectorManifest } from '@/types/connector';

export const CONNECTOR_MANIFESTS: ConnectorManifest[] = [
  {
    id: 'telegram',
    name: 'Telegram',
    icon: '✈️',
    description: 'Connect to Telegram Bot API to send messages, photos, and more',
    authType: 'api_key',
    apiKey: {
      fields: [
        {
          name: 'botToken',
          label: 'Bot Token',
          type: 'password',
          placeholder: '123456789:ABCdefGHIjklMNOpqrsTUVwxyz',
          required: true,
          helpText: 'Get your bot token from @BotFather on Telegram. Send /newbot command to create a new bot.',
          apiKeyUrl: 'https://t.me/BotFather',
        },
      ],
    },
    nodeKinds: [
      'action.telegram.sendMessage',
      'action.telegram.sendPhoto',
      'action.telegram.sendDocument',
      'action.telegram.sendLocation',
      'action.telegram.sendPoll',
      'action.telegram.editMessage',
      'action.telegram.deleteMessage',
      'action.telegram.sendVideo',
      'action.telegram.sendAudio',
      'action.telegram.sendSticker',
      'action.telegram.sendVenue',
      'action.telegram.sendContact',
      'action.telegram.getUpdates',
    ],
    testEndpoint: '/telegram/getMe',
  },
  {
    id: 'sheets_oauth',
    name: 'Google Sheets',
    icon: '📊',
    description: 'Connect to Google Sheets using OAuth2 - No JSON file needed! Just sign in with your Google account',
    authType: 'oauth2',
    oauth2: {
      authorizationUrl: 'https://accounts.google.com/o/oauth2/v2/auth',
      tokenUrl: 'https://oauth2.googleapis.com/token',
      scopes: ['https://www.googleapis.com/auth/spreadsheets'],
      clientId: import.meta.env.VITE_GOOGLE_CLIENT_ID || '',
      redirectUri: `${window.location.origin}/oauth/callback`,
      // Allow users to configure their own OAuth credentials
      configurable: true,
      fields: [
        {
          name: 'clientId',
          label: 'Google Client ID',
          type: 'text',
          placeholder: 'your-google-client-id.apps.googleusercontent.com',
          required: true,
          helpText: 'Get from Google Cloud Console > APIs & Services > Credentials',
        },
        {
          name: 'clientSecret',
          label: 'Google Client Secret',
          type: 'password',
          placeholder: 'your-google-client-secret',
          required: true,
          helpText: 'Get from Google Cloud Console > APIs & Services > Credentials',
        },
      ],
    },
    nodeKinds: [
      'trigger.sheets.newRow',
      'trigger.sheets.update',
      'action.sheets.appendRow',
      'action.sheets.readRows',
      'action.sheets.updateCell',
      'action.sheets.clearRange',
    ],
    testEndpoint: '/sheets/test',
    tokenExpiryWarningDays: 7,
  },
  {
    id: 'sheets_service_account',
    name: 'Google Sheets (Service Account)',
    icon: '📊',
    description: 'Advanced: Connect using a Service Account JSON file (for server-to-server access)',
    authType: 'service_account',
    serviceAccount: {
      fields: [
        {
          name: 'serviceAccountJson',
          label: 'Service Account JSON',
          type: 'file',
          required: true,
        },
      ],
      acceptFileTypes: ['.json'],
    },
    nodeKinds: [
      'trigger.sheets.newRow',
      'trigger.sheets.update',
      'action.sheets.appendRow',
      'action.sheets.readRows',
      'action.sheets.updateCell',
      'action.sheets.clearRange',
    ],
    testEndpoint: '/sheets/test',
  },
  {
    id: 'facebook',
    name: 'Facebook',
    icon: '📘',
    description: 'Connect to Facebook Graph API to manage pages and comments',
    authType: 'api_key',
    apiKey: {
      fields: [
        {
          name: 'appId',
          label: 'App ID',
          type: 'text',
          placeholder: '123456789012345',
          required: true,
          helpText: 'Get your App ID from Facebook Developers (developers.facebook.com)',
          apiKeyUrl: 'https://developers.facebook.com/apps/',
        },
        {
          name: 'appSecret',
          label: 'App Secret',
          type: 'password',
          placeholder: 'your-app-secret',
          required: true,
          helpText: 'Get your App Secret from Facebook App Settings > Basic',
        },
        {
          name: 'accessToken',
          label: 'Page Access Token (Optional)',
          type: 'password',
          placeholder: 'your-page-access-token',
          required: false,
          helpText: 'Required for posting/reply actions. Get from Graph API Explorer or Page Settings',
        },
      ],
    },
    nodeKinds: [
      'trigger.facebook.comment',
      'action.facebook.reply',
      'action.facebook.dm',
    ],
    testEndpoint: '/facebook/me',
  },
  {
    id: 'facebook_oauth',
    name: 'Facebook (OAuth)',
    icon: '📘',
    description: 'Connect to Facebook using OAuth2 for user-level access',
    authType: 'oauth2',
    oauth2: {
      authorizationUrl: 'https://www.facebook.com/v18.0/dialog/oauth',
      tokenUrl: 'https://graph.facebook.com/v18.0/oauth/access_token',
      scopes: ['pages_manage_posts', 'pages_read_engagement', 'pages_show_list'],
      clientId: import.meta.env.VITE_FACEBOOK_APP_ID || '',
      redirectUri: `${window.location.origin}/oauth/callback`,
      // Allow users to configure their own OAuth credentials
      configurable: true,
      fields: [
        {
          name: 'clientId',
          label: 'Facebook App ID',
          type: 'text',
          placeholder: '123456789012345',
          required: true,
          helpText: 'Get from Facebook Developers > App Settings > Basic',
        },
        {
          name: 'clientSecret',
          label: 'Facebook App Secret',
          type: 'password',
          placeholder: 'your-facebook-app-secret',
          required: true,
          helpText: 'Get from Facebook Developers > App Settings > Basic',
        },
      ],
    },
    nodeKinds: [
      'trigger.facebook.comment',
      'action.facebook.reply',
      'action.facebook.dm',
    ],
    testEndpoint: '/facebook/me',
    tokenExpiryWarningDays: 30,
  },
  {
    id: 'email',
    name: 'Email (SMTP)',
    icon: '📧',
    description: 'Connect to SMTP server to send emails',
    authType: 'api_key',
    apiKey: {
      fields: [
        {
          name: 'smtpHost',
          label: 'SMTP Host',
          type: 'text',
          placeholder: 'smtp.gmail.com',
          required: true,
        },
        {
          name: 'smtpPort',
          label: 'SMTP Port',
          type: 'text',
          placeholder: '587',
          required: true,
        },
        {
          name: 'username',
          label: 'Username',
          type: 'text',
          placeholder: 'your-email@gmail.com',
          required: true,
        },
        {
          name: 'password',
          label: 'Password / App Password',
          type: 'password',
          placeholder: 'Your SMTP password',
          required: true,
          helpText: 'For Gmail, use an App Password instead of your regular password',
        },
      ],
    },
    nodeKinds: ['action.email.send'],
    testEndpoint: '/email/test',
  },
  {
    id: 'webhook',
    name: 'Webhook',
    icon: '🔗',
    description: 'Configure webhook endpoint to receive incoming requests',
    authType: 'webhook',
    webhook: {
      url: '',
      secret: '',
      verifySecret: true,
    },
    nodeKinds: ['trigger.webhook.inbound'],
    testEndpoint: '/webhook/verify',
  },
];

/**
 * Get manifest for a provider by ID
 */
export function getConnectorManifest(providerId: string): ConnectorManifest | undefined {
  return CONNECTOR_MANIFESTS.find((m) => m.id === providerId);
}

/**
 * Get manifest for a node kind
 * Prefers OAuth over Service Account when multiple options exist
 */
export function getManifestForNodeKind(nodeKind: string): ConnectorManifest | undefined {
  const allManifests = CONNECTOR_MANIFESTS.filter((m) => m.nodeKinds.includes(nodeKind));
  
  // Prefer OAuth over Service Account
  const oauthManifest = allManifests.find((m) => m.authType === 'oauth2');
  if (oauthManifest) return oauthManifest;
  
  // Fall back to first available
  return allManifests[0];
}

/**
 * Get all providers that support a node kind
 */
export function getProvidersForNodeKind(nodeKind: string): ConnectorManifest[] {
  return CONNECTOR_MANIFESTS.filter((m) => m.nodeKinds.includes(nodeKind));
}

