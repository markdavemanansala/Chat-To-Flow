# Quick Start Guide

## Starting the Backend Server

### 1. Install Dependencies

```bash
npm install
```

### 2. Configure Environment (Optional)

Create a `.env` file in the root directory:

```bash
cp .env.example .env
```

Edit `.env` with your settings (optional - OAuth credentials can be configured in frontend):

```env
PORT=3000
FRONTEND_URL=http://localhost:5173

# Optional: Default OAuth credentials (users can override in frontend)
GOOGLE_CLIENT_ID=your-google-client-id
GOOGLE_CLIENT_SECRET=your-google-client-secret
FACEBOOK_APP_ID=your-facebook-app-id
FACEBOOK_APP_SECRET=your-facebook-app-secret

# Optional: Default SMTP settings
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-app-password
SMTP_FROM=your-email@gmail.com
```

**Note:** OAuth credentials can be configured in the frontend, so `.env` is optional!

### 3. Start the Backend

```bash
# Start backend only
npm run server

# Or start with auto-reload (development)
npm run dev:server
```

The server will start on `http://localhost:3000`

### 4. Start Frontend (in another terminal)

```bash
npm run dev
```

The frontend will start on `http://localhost:5173`

### 5. Or Start Both Together

```bash
npm run dev:all
```

This starts both frontend and backend concurrently.

## Verify Backend is Running

Check the health endpoint:

```bash
curl http://localhost:3000/health
```

You should see:
```json
{
  "status": "ok",
  "timestamp": "2024-01-15T10:30:00.000Z"
}
```

## What the Backend Provides

- ✅ **Integration Management**: Connect Telegram, Google Sheets, Facebook, Email, Webhooks
- ✅ **OAuth2 Flows**: Google Sheets and Facebook OAuth (with user-configurable credentials)
- ✅ **Credential Storage**: Secure storage of API keys and tokens
- ✅ **Webhook Endpoints**: Receive inbound webhooks
- ✅ **Email Service**: SMTP email sending
- ✅ **Cron Scheduler**: Automatic workflow execution
- ✅ **Workflow Execution**: Execute workflows with all integrations

## API Endpoints

- `GET /health` - Health check
- `GET /api/integrations/status` - All connection statuses
- `POST /api/integrations/:providerId/test` - Test connection
- `POST /api/integrations/:providerId/credentials` - Save credentials
- `POST /api/integrations/oauth/start/:providerId` - Start OAuth flow
- `GET /api/integrations/oauth/status/:handshakeId` - Check OAuth status
- `POST /api/webhooks/:webhookId` - Receive webhook
- `POST /api/email/send` - Send email
- `GET /api/workflows` - List workflows
- `POST /api/workflows/:id/execute` - Execute workflow

## Troubleshooting

### Port 3000 already in use
Change the port in `.env`:
```env
PORT=3001
```

### TypeScript import errors
Make sure `tsx` is installed:
```bash
npm install -D tsx
```

### Backend won't start
1. Check if all dependencies are installed: `npm install`
2. Check for errors in the terminal
3. Verify Node.js version (should be 18+)

## Next Steps

1. Start the backend: `npm run server`
2. Start the frontend: `npm run dev` (in another terminal)
3. Open `http://localhost:5173`
4. Go to Secrets Vault (🔐 button in toolbar)
5. Connect your providers!

