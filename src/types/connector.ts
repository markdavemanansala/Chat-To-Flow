/**
 * @fileoverview Connector types and manifest definitions
 */

export type AuthType = 'oauth2' | 'api_key' | 'service_account' | 'webhook';

export interface ApiKeyField {
  name: string;
  label: string;
  type: 'text' | 'password' | 'textarea';
  placeholder?: string;
  required?: boolean;
  helpText?: string;
  apiKeyUrl?: string; // Deep link to API keys page
}

export interface OAuth2Field {
  name: string;
  label: string;
  type: 'text' | 'password';
  placeholder?: string;
  required?: boolean;
  helpText?: string;
}

export interface OAuth2Config {
  authorizationUrl: string;
  tokenUrl: string;
  scopes: string[];
  clientId?: string;
  clientSecret?: string;
  redirectUri?: string;
  configurable?: boolean; // Allow users to configure their own OAuth credentials
  fields?: OAuth2Field[]; // Fields for OAuth credential configuration
}

export interface ServiceAccountConfig {
  fields: Array<{
    name: string;
    label: string;
    type: 'file' | 'text' | 'textarea';
    required?: boolean;
  }>;
  acceptFileTypes?: string[];
}

export interface WebhookConfig {
  url: string;
  secret?: string;
  verifySecret?: boolean;
}

export interface ConnectorManifest {
  id: string;
  name: string;
  icon?: string;
  description: string;
  authType: AuthType;
  
  // Auth-specific configs
  oauth2?: OAuth2Config;
  apiKey?: {
    fields: ApiKeyField[];
  };
  serviceAccount?: ServiceAccountConfig;
  webhook?: WebhookConfig;
  
  // Node kinds this provider supports
  nodeKinds: string[];
  
  // Test endpoint (e.g., /me, /verify)
  testEndpoint?: string;
  
  // Token expiry handling
  tokenExpiryWarningDays?: number; // Show reauthorize badge N days before expiry
}

export interface ConnectionStatus {
  providerId: string;
  connected: boolean;
  connectedAt?: string;
  expiresAt?: string;
  lastTested?: string;
  testStatus?: 'success' | 'failed' | 'pending';
  testError?: string;
  credentials?: Record<string, any>; // Encrypted/stored credentials
}

export interface OAuthHandshakeStatus {
  providerId: string;
  status: 'pending' | 'completed' | 'failed' | 'expired';
  error?: string;
  expiresAt?: string;
}

