# Comprehensive Backend for All Integrations

The backend now supports **ALL** integrations and providers, not just meeting reminders.

## 🎯 Supported Integrations

### ✅ Telegram
- **Auth**: API Key (Bot Token)
- **Test**: `/api/integrations/telegram/test`
- **Features**: Send messages, photos, documents, locations, polls, etc.

### ✅ Google Sheets
- **Auth**: Service Account (JSON) or OAuth2
- **Test**: `/api/integrations/sheets/test` or `/api/integrations/sheets_oauth/test`
- **Features**: Read, write, update, clear ranges

### ✅ Facebook
- **Auth**: API Key (App ID + Secret) or OAuth2
- **Test**: `/api/integrations/facebook/test` or `/api/integrations/facebook_oauth/test`
- **Features**: Comment triggers, replies, DMs

### ✅ Email (SMTP)
- **Auth**: SMTP credentials
- **Test**: `/api/integrations/email/test`
- **Features**: Send emails via any SMTP server

### ✅ Webhooks
- **Auth**: URL + optional secret
- **Test**: `/api/integrations/webhook/test`
- **Features**: Receive inbound webhooks, trigger workflows

## 📡 API Endpoints

### Integration Management

#### Get All Connection Statuses
```
GET /api/integrations/status
```
Returns connection status for all providers.

#### Test Provider Connection
```
POST /api/integrations/:providerId/test
Body: { credentials: {...} }
```
Tests connection with provided credentials or stored credentials.

#### Save Provider Credentials
```
POST /api/integrations/:providerId/credentials
Body: { credentials: {...} }
```
Saves and validates credentials. Tests connection before saving.

#### Get Provider Credentials (Metadata)
```
GET /api/integrations/:providerId/credentials
```
Returns connection metadata (without sensitive data).

#### Delete Provider Credentials
```
DELETE /api/integrations/:providerId/credentials
```
Removes stored credentials.

### OAuth2 Flows

#### Start OAuth Flow
```
POST /api/integrations/oauth/start/:providerId
Body: { redirectUri?: string }
```
Returns `{ authUrl, handshakeId, expiresAt }`.

#### Check OAuth Status
```
GET /api/integrations/oauth/status/:handshakeId
```
Returns `{ status, credentials?, error? }`.

#### OAuth Callback
```
GET /api/integrations/oauth/callback/:providerId?code=...&state=...
```
Handles OAuth callback and saves credentials.

### Webhooks

#### Receive Webhook
```
POST /api/webhooks/:webhookId
Body: { ...payload }
Headers: { X-Webhook-Secret?: string }
```
Receives webhook payload and triggers matching workflows.

#### Verify Webhook
```
GET /api/webhooks/:webhookId/verify?mode=subscribe&token=...&challenge=...
```
For webhook providers that require verification (e.g., Facebook).

## 🔧 Configuration

### Environment Variables

```env
# Server
PORT=3000
FRONTEND_URL=http://localhost:5173

# Google OAuth
GOOGLE_CLIENT_ID=your-client-id
GOOGLE_CLIENT_SECRET=your-client-secret

# Facebook OAuth
FACEBOOK_APP_ID=your-app-id
FACEBOOK_APP_SECRET=your-app-secret

# SMTP (default email)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-app-password
SMTP_FROM=your-email@gmail.com
```

## 🔐 Credential Storage

Credentials are stored in `server/data/credentials.json`:
- Encrypted at rest (recommended for production)
- Per-provider storage
- Includes metadata (connectedAt, expiresAt, lastTested)

## 🚀 Usage Examples

### Connect Telegram

```javascript
// Test connection
const testResult = await fetch('http://localhost:3000/api/integrations/telegram/test', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    credentials: { botToken: 'your-bot-token' }
  })
});

// Save credentials (auto-tests before saving)
const saveResult = await fetch('http://localhost:3000/api/integrations/telegram/credentials', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    credentials: { botToken: 'your-bot-token' }
  })
});
```

### Connect Google Sheets (OAuth)

```javascript
// 1. Start OAuth flow
const { authUrl, handshakeId } = await fetch('http://localhost:3000/api/integrations/oauth/start/sheets_oauth', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    redirectUri: 'http://localhost:5173/oauth/callback'
  })
}).then(r => r.json());

// 2. Redirect user to authUrl
window.location.href = authUrl;

// 3. Poll for completion
const checkStatus = async () => {
  const status = await fetch(`http://localhost:3000/api/integrations/oauth/status/${handshakeId}`)
    .then(r => r.json());
  
  if (status.status === 'completed') {
    // Credentials saved automatically
    console.log('Connected!');
  } else if (status.status === 'pending') {
    setTimeout(checkStatus, 2000);
  }
};
```

### Connect Facebook (API Key)

```javascript
const result = await fetch('http://localhost:3000/api/integrations/facebook/credentials', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    credentials: {
      appId: 'your-app-id',
      appSecret: 'your-app-secret',
      accessToken: 'optional-page-access-token'
    }
  })
});
```

### Setup Webhook

```javascript
// Save webhook configuration
await fetch('http://localhost:3000/api/integrations/webhook/credentials', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    credentials: {
      url: 'https://your-domain.com/api/webhooks/my-webhook',
      secret: 'your-webhook-secret',
      verifySecret: true
    }
  })
});

// Webhook URL will be: http://your-backend/api/webhooks/my-webhook
```

## 🔄 Frontend Integration

The frontend `connectionApi.ts` has been updated to use the backend:

- ✅ `startOAuthFlow()` - Uses backend OAuth service
- ✅ `checkOAuthStatus()` - Polls backend for status
- ✅ `testProviderConnection()` - Tests via backend
- ✅ `saveProviderCredentials()` - Saves via backend
- ✅ `deleteProviderCredentials()` - Deletes via backend
- ✅ `getAllConnectionStatuses()` - Gets status from backend

## 📦 Database

Credentials are stored in JSON files (easily replaceable with MongoDB/PostgreSQL):
- `server/data/credentials.json` - All provider credentials
- `server/data/workflows.json` - Workflow definitions
- `server/data/executions.json` - Execution history

## 🛡️ Security

- Credentials are validated before saving
- OAuth flows use secure state tokens
- Webhook secrets are verified
- Sensitive data is not returned in GET requests

## 🎉 What's New

1. **Comprehensive Integration Service** - Handles all providers
2. **OAuth2 Support** - Google Sheets and Facebook
3. **Credential Management** - Secure storage and validation
4. **Webhook Endpoints** - Receive and trigger workflows
5. **Connection Testing** - Test all providers before saving
6. **Status Tracking** - Track connection status, expiry, last tested

## 🚀 Next Steps

1. Configure OAuth credentials in `.env`
2. Start the server: `npm run server`
3. Connect providers via frontend Secrets Vault
4. Create workflows using connected providers
5. Backend will handle all API calls and webhooks automatically!

