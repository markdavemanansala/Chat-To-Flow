# Backend Setup Guide

## Quick Start

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Configure environment:**
   ```bash
   cp .env.example .env
   # Edit .env with your SMTP settings
   ```

3. **Start the server:**
   ```bash
   npm run server
   ```

4. **Or run both frontend and backend:**
   ```bash
   npm run dev:all
   ```

## What's Included

### ✅ Backend Server (`server/`)
- Express.js REST API
- Cron scheduler for periodic workflow execution
- SMTP email service
- Workflow execution service
- Execution history tracking
- JSON file-based database

### ✅ API Endpoints

**Email:**
- `POST /api/email/send` - Send email
- `POST /api/email/test` - Test email config

**Workflows:**
- `GET /api/workflows` - List workflows
- `GET /api/workflows/:id` - Get workflow
- `POST /api/workflows` - Create/update workflow
- `POST /api/workflows/:id/execute` - Execute workflow
- `GET /api/workflows/:id/executions` - Execution history
- `GET /api/workflows/scheduler/status` - Scheduler status

### ✅ Features

1. **Cron Scheduler**
   - Automatically schedules workflows with cron triggers
   - Reloads workflows every 5 minutes
   - Supports standard cron expressions

2. **Email Service**
   - SMTP support via Nodemailer
   - Configurable via environment variables
   - Test endpoint for configuration

3. **Workflow Execution**
   - Uses the same executor as frontend
   - Tracks execution history
   - Handles errors gracefully

## Configuration

### SMTP Setup (Gmail Example)

1. Enable 2-Factor Authentication on your Google account
2. Generate an App Password:
   - Google Account → Security → 2-Step Verification → App passwords
   - Select "Mail" and generate password
3. Add to `.env`:
   ```env
   SMTP_HOST=smtp.gmail.com
   SMTP_PORT=587
   SMTP_USER=your-email@gmail.com
   SMTP_PASS=your-app-password
   SMTP_FROM=your-email@gmail.com
   ```

### Other SMTP Providers

Update `.env` with your provider's settings. Common providers:

**SendGrid:**
```env
SMTP_HOST=smtp.sendgrid.net
SMTP_PORT=587
SMTP_USER=apikey
SMTP_PASS=your-sendgrid-api-key
```

**Mailgun:**
```env
SMTP_HOST=smtp.mailgun.org
SMTP_PORT=587
SMTP_USER=your-mailgun-username
SMTP_PASS=your-mailgun-password
```

## Testing

### Test Email Service

```bash
curl -X POST http://localhost:3000/api/email/test \
  -H "Content-Type: application/json" \
  -d '{
    "smtpConfig": {
      "host": "smtp.gmail.com",
      "port": 587,
      "user": "your-email@gmail.com",
      "pass": "your-app-password"
    }
  }'
```

### Test Workflow Execution

```bash
curl -X POST http://localhost:3000/api/workflows/YOUR_WORKFLOW_ID/execute
```

### Check Scheduler Status

```bash
curl http://localhost:3000/api/workflows/scheduler/status
```

## Meeting Reminder Workflow

The meeting reminder workflow will:

1. **Trigger every 15 minutes** (configurable via cron)
2. **Read meeting schedule** from Google Sheets
3. **Filter meetings** starting in next 15 minutes
4. **Send notifications** via:
   - Email (using SMTP)
   - Telegram (using Bot API)
   - Zoom (via HTTP request)

### Setup Steps

1. Create a Google Sheet with columns:
   - Title/Name
   - StartTime
   - Email
   - ZoomLink (optional)
   - TelegramChatId (optional)

2. Configure credentials in frontend Secrets Vault:
   - Google Sheets API key
   - Telegram Bot Token
   - Email/SMTP credentials

3. Create workflow using the template:
   - Go to Templates
   - Select "AI Meeting & Appointment Reminder"
   - Configure Google Sheets ID and range
   - Save workflow

4. The backend will automatically:
   - Schedule the workflow based on cron expression
   - Execute it every 15 minutes
   - Send reminders for upcoming meetings

## Troubleshooting

### "Cannot find module 'tsx'"
```bash
npm install -D tsx
```

### "SMTP connection failed"
- Check SMTP credentials in `.env`
- Verify port (587 for TLS, 465 for SSL)
- Check firewall settings
- Test with `/api/email/test` endpoint

### "Workflows not executing"
- Check scheduler status: `GET /api/workflows/scheduler/status`
- Verify cron expressions are valid
- Check workflow has `active: true`
- Check server logs

### "TypeScript import errors"
- Make sure `tsx` is installed: `npm install -D tsx`
- Run server with: `npm run server` (uses tsx)
- Or compile TypeScript first: `npx tsc`

## Next Steps

1. **Production Deployment:**
   - Use PM2 or systemd for process management
   - Set up proper logging
   - Use a real database (MongoDB/PostgreSQL)
   - Configure reverse proxy (nginx)
   - Set up SSL/TLS

2. **Database Migration:**
   - Currently uses JSON files
   - Easy to replace with MongoDB/PostgreSQL
   - Update `server/db/` files

3. **Monitoring:**
   - Add logging service (Winston, Pino)
   - Set up error tracking (Sentry)
   - Add metrics collection

## Files Created

```
server/
├── index.js                    # Main server
├── routes/
│   ├── email.js               # Email API routes
│   └── workflows.js           # Workflow API routes
├── services/
│   ├── email.js               # Email service (SMTP)
│   ├── scheduler.js           # Cron scheduler
│   └── workflowExecutor.js    # Workflow execution
├── db/
│   ├── index.js               # Database init
│   ├── workflows.js           # Workflow operations
│   └── executions.js          # Execution history
├── utils/
│   └── cron.js                # Cron utilities
└── data/                      # JSON database files
    ├── workflows.json
    └── executions.json
```

## Support

For issues or questions, check:
- `server/README.md` - Detailed documentation
- Server logs for error messages
- API endpoint responses for error details

