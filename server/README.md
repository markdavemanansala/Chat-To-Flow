# Backend Server

Backend server for AI Agent Workflow Automation with cron scheduling and email notifications.

## Features

- ✅ Express.js REST API
- ✅ Cron scheduler for periodic workflow execution
- ✅ SMTP email service using Nodemailer
- ✅ Workflow execution service
- ✅ Execution history tracking
- ✅ JSON file-based database (easily replaceable with MongoDB/PostgreSQL)

## Setup

### 1. Install Dependencies

```bash
npm install
```

### 2. Configure Environment Variables

Copy `.env.example` to `.env` and configure:

```bash
cp .env.example .env
```

Edit `.env` with your settings:

```env
PORT=3000
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-app-password
SMTP_FROM=your-email@gmail.com
```

### 3. Run the Server

```bash
# Development mode (with auto-reload)
npm run dev:server

# Production mode
npm run server

# Run both frontend and backend
npm run dev:all
```

## API Endpoints

### Email

- `POST /api/email/send` - Send an email
  ```json
  {
    "to": "recipient@example.com",
    "subject": "Subject",
    "body": "Email body",
    "smtpConfig": { ... } // Optional, uses env vars if not provided
  }
  ```

- `POST /api/email/test` - Test email configuration

### Workflows

- `GET /api/workflows` - Get all active workflows
- `GET /api/workflows/:id` - Get workflow by ID
- `POST /api/workflows` - Create or update workflow
- `PUT /api/workflows/:id` - Update workflow
- `DELETE /api/workflows/:id` - Delete workflow
- `POST /api/workflows/:id/execute` - Manually execute workflow
- `GET /api/workflows/:id/executions` - Get execution history
- `GET /api/workflows/scheduler/status` - Get scheduler status

### Health

- `GET /health` - Health check

## Cron Scheduler

The scheduler automatically:
- Loads all active workflows with cron triggers
- Schedules them based on their cron expressions
- Executes workflows at the specified times
- Reloads workflows every 5 minutes to pick up changes

### Cron Expression Format

Standard cron format: `minute hour day month weekday`

Examples:
- `*/15 * * * *` - Every 15 minutes
- `0 * * * *` - Every hour
- `0 0 * * *` - Daily at midnight
- `0 9 * * *` - Daily at 9 AM
- `0 0 * * 0` - Weekly on Sunday

## Email Configuration

### Gmail Setup

1. Enable 2-Factor Authentication
2. Generate an App Password:
   - Go to Google Account settings
   - Security → 2-Step Verification → App passwords
   - Generate password for "Mail"
3. Use the app password in `SMTP_PASS`

### Other SMTP Providers

Update `.env` with your provider's settings:

```env
SMTP_HOST=smtp.your-provider.com
SMTP_PORT=587
SMTP_USER=your-email@provider.com
SMTP_PASS=your-password
```

## Workflow Execution

Workflows are executed using the frontend executor. To enable full TypeScript support:

1. Install tsx:
   ```bash
   npm install -D tsx
   ```

2. Update `package.json` scripts:
   ```json
   "server": "tsx server/index.js"
   ```

Or compile TypeScript first:
```bash
npx tsc
```

## Database

Currently uses JSON files in `server/data/`:
- `workflows.json` - Stored workflows
- `executions.json` - Execution history

To use a real database:
1. Update `server/db/index.js` and database files
2. Replace JSON file operations with database queries
3. Update environment variables

## Development

### File Structure

```
server/
├── index.js              # Main server file
├── routes/               # API routes
│   ├── email.js
│   └── workflows.js
├── services/             # Business logic
│   ├── email.js          # Email service
│   ├── scheduler.js      # Cron scheduler
│   └── workflowExecutor.js # Workflow execution
├── db/                   # Database operations
│   ├── index.js
│   ├── workflows.js
│   └── executions.js
└── utils/                # Utilities
    └── cron.js
```

## Troubleshooting

### Email not sending
- Check SMTP credentials in `.env`
- Verify SMTP port (587 for TLS, 465 for SSL)
- Check firewall/network settings
- Test with `/api/email/test` endpoint

### Workflows not executing
- Check scheduler status: `GET /api/workflows/scheduler/status`
- Verify cron expressions are valid
- Check workflow has `active: true`
- Check server logs for errors

### TypeScript import errors
- Install `tsx`: `npm install -D tsx`
- Or compile TypeScript first: `npx tsc`
- Or update imports to use compiled `.js` files

## Production Deployment

1. Set `NODE_ENV=production`
2. Use a process manager (PM2, systemd, etc.)
3. Set up proper logging
4. Use a real database (MongoDB, PostgreSQL)
5. Configure reverse proxy (nginx)
6. Set up SSL/TLS
7. Configure monitoring and alerts

