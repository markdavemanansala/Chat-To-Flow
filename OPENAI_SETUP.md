# OpenAI Integration Setup

This app now supports AI-powered workflow generation using OpenAI.

## Setup Instructions

### 1. Get an OpenAI API Key

1. Go to https://platform.openai.com/api-keys
2. Sign up or log in to your OpenAI account
3. Create a new API key
4. Copy the key

### 2. Add the API Key to Your Project

Create a `.env` file in the root directory and add:

```env
VITE_OPENAI_API_KEY=your_api_key_here
```

### 3. Restart the Dev Server

```bash
npm run dev
```

## How It Works

### With API Key (AI-Powered)
- Uses GPT-4o-mini to generate workflows based on natural language descriptions
- Provides intelligent, context-aware workflow suggestions
- Creates more detailed and specific workflow steps

### Without API Key (Mock Mode)
- Falls back to keyword-based workflow generation
- Still functional but less intelligent
- Uses predefined templates and patterns

## Example Prompts

Try these in the chat:

1. "Create a workflow that checks my inventory every day and alerts me when items are low"
2. "I want to automatically reply to Facebook comments that mention our prices"
3. "Set up an automation to send appointment reminders to patients 24 hours before"

## Security Note

⚠️ **Important**: In production, API calls should go through your backend server, not directly from the browser. The current implementation uses `dangerouslyAllowBrowser: true` for development convenience only.

