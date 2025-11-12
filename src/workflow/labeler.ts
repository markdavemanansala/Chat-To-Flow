/**
 * @fileoverview Centralized node labeling with per-kind rules
 * Max 24 chars, includes key config values
 */

import type { NodeKind, NodeConfig } from '../types/graph';

/**
 * Generate a human-friendly label for a node based on kind and config
 * @param kind - Node kind
 * @param config - Node configuration
 * @returns Label string (max 24 chars)
 */
export function generateNodeLabel(kind: NodeKind, config: NodeConfig = {}): string {
  let base = '';
  let suffix = '';

  // Base labels per kind
  switch (kind) {
    case 'trigger.facebook.comment':
      base = 'Facebook Comment';
      if (config.match?.contains) {
        const match = String(config.match.contains);
        suffix = ` – "${truncate(match, 10)}"`;
      } else {
        suffix = ' – Monitor';
      }
      break;

    case 'trigger.webhook.inbound':
      base = 'Webhook';
      break;

    case 'trigger.scheduler.cron':
      base = 'Scheduled Trigger';
      if (config.schedule) {
        // Try to make schedule readable
        const schedule = String(config.schedule);
        if (schedule.includes('0 0 * * *')) {
          suffix = ' – Daily';
        } else if (schedule.includes('0 0 * * 0')) {
          suffix = ' – Weekly';
        } else if (schedule.includes('0 * * * *')) {
          suffix = ' – Hourly';
        } else {
          suffix = ' – Custom';
        }
      } else {
        suffix = ' – Daily';
      }
      break;

    case 'logic.filter':
      base = 'Filter Data';
      if (config.expression) {
        const expr = String(config.expression);
        suffix = ` – ${truncate(expr, 10)}`;
      } else {
        suffix = ' – Condition';
      }
      break;

    case 'ai.guard':
      base = 'AI Guard';
      if (config.prompt?.includes('classify')) {
        suffix = ' – Classify';
      } else if (config.prompt) {
        suffix = ' – Check';
      }
      break;

    case 'ai.generate':
      base = 'AI Generate';
      if (config.prompt) {
        const prompt = String(config.prompt);
        suffix = ` – ${truncate(prompt, 10)}`;
      } else {
        suffix = ' – Content';
      }
      break;

    case 'action.facebook.reply':
      base = 'Reply to Comment';
      if (config.replyTemplate) {
        const template = String(config.replyTemplate);
        suffix = ` – ${truncate(template, 10)}`;
      } else {
        suffix = ' – Auto Reply';
      }
      break;

    case 'action.facebook.dm':
      base = 'Send Facebook DM';
      if (config.message) {
        const msg = String(config.message);
        suffix = ` – ${truncate(msg, 10)}`;
      } else {
        suffix = ' – Message';
      }
      break;

    case 'trigger.sheets.newRow':
      base = 'Sheets: New Row';
      if (config.sheetName) {
        suffix = ` – ${truncate(String(config.sheetName), 10)}`;
      }
      break;

    case 'trigger.sheets.update':
      base = 'Sheets: Update';
      if (config.sheetName) {
        suffix = ` – ${truncate(String(config.sheetName), 10)}`;
      }
      break;

    case 'action.telegram.sendMessage':
      base = 'Send Telegram';
      if (config.message) {
        const msg = String(config.message);
        suffix = ` – ${truncate(msg, 10)}`;
      } else {
        suffix = ' – Message';
      }
      break;

    case 'action.telegram.sendPhoto':
      base = 'Telegram Photo';
      if (config.caption) {
        suffix = ` – ${truncate(String(config.caption), 10)}`;
      }
      break;

    case 'action.telegram.sendVideo':
      base = 'Telegram Video';
      if (config.caption) {
        suffix = ` – ${truncate(String(config.caption), 10)}`;
      }
      break;

    case 'action.telegram.sendAudio':
      base = 'Telegram Audio';
      if (config.title) {
        suffix = ` – ${truncate(String(config.title), 10)}`;
      }
      break;

    case 'action.telegram.sendDocument':
      base = 'Telegram Document';
      break;

    case 'action.telegram.sendLocation':
      base = 'Telegram Location';
      break;

    case 'action.telegram.sendVenue':
      base = 'Telegram Venue';
      if (config.title) {
        suffix = ` – ${truncate(String(config.title), 10)}`;
      }
      break;

    case 'action.telegram.sendContact':
      base = 'Telegram Contact';
      if (config.firstName) {
        suffix = ` – ${truncate(String(config.firstName), 10)}`;
      }
      break;

    case 'action.telegram.sendPoll':
      base = 'Telegram Poll';
      if (config.question) {
        suffix = ` – ${truncate(String(config.question), 10)}`;
      }
      break;

    case 'action.telegram.sendSticker':
      base = 'Telegram Sticker';
      break;

    case 'action.telegram.editMessage':
      base = 'Edit Telegram';
      break;

    case 'action.telegram.deleteMessage':
      base = 'Delete Telegram';
      break;

    case 'action.telegram.getUpdates':
      base = 'Get Telegram Updates';
      break;

    case 'action.email.send':
      base = 'Send Email';
      if (config.subjectTpl) {
        const subject = String(config.subjectTpl);
        suffix = ` – ${truncate(subject, 12)}`;
      } else if (config.toExpr) {
        suffix = ' – Notification';
      }
      break;

    case 'action.sheets.appendRow':
      base = 'Save to Sheets';
      if (config.range) {
        const range = String(config.range);
        // Extract sheet name (e.g., "Leads!A:E" -> "Leads")
        const sheetName = range.split('!')[0];
        suffix = ` – ${sheetName}`;
      } else {
        suffix = ' – Log Data';
      }
      break;

    case 'action.sheets.readRows':
      base = 'Read Sheets';
      if (config.range) {
        const range = String(config.range);
        const sheetName = range.split('!')[0];
        suffix = ` – ${sheetName}`;
      }
      break;

    case 'action.sheets.updateCell':
      base = 'Update Cell';
      if (config.range) {
        suffix = ` – ${truncate(String(config.range), 10)}`;
      }
      break;

    case 'action.sheets.clearRange':
      base = 'Clear Sheets';
      if (config.range) {
        const range = String(config.range);
        const sheetName = range.split('!')[0];
        suffix = ` – ${sheetName}`;
      }
      break;

    case 'action.http.request':
      const method = (config.method || 'POST').toUpperCase();
      
      // Try to detect platform/service from URL or config
      let platform = '';
      let task = '';
      
      if (config.url) {
        try {
          const url = new URL(String(config.url));
          const host = url.hostname.toLowerCase().replace('www.', '');
          
          // Detect platforms from URL
          if (host.includes('facebook') || host.includes('fb') || host.includes('graph.facebook.com')) {
            platform = 'FB';
            task = method === 'POST' ? 'Post' : method === 'GET' ? 'Fetch' : method;
          } else if (host.includes('instagram') || host.includes('graph.instagram.com')) {
            platform = 'Instagram';
            task = method === 'POST' ? 'Post' : method === 'GET' ? 'Fetch' : method;
          } else if (host.includes('twitter') || host.includes('api.twitter.com') || host.includes('x.com')) {
            platform = 'Twitter';
            task = method === 'POST' ? 'Tweet' : method === 'GET' ? 'Fetch' : method;
          } else if (host.includes('linkedin') || host.includes('api.linkedin.com')) {
            platform = 'LinkedIn';
            task = method === 'POST' ? 'Post' : method === 'GET' ? 'Fetch' : method;
          } else if (host.includes('sheets') || host.includes('spreadsheets.google.com')) {
            platform = 'Sheets';
            task = method === 'POST' ? 'Update' : method === 'GET' ? 'Read' : method;
          } else if (host.includes('slack') || host.includes('api.slack.com')) {
            platform = 'Slack';
            task = method === 'POST' ? 'Send' : method === 'GET' ? 'Fetch' : method;
          } else {
            // Generic - use hostname
            platform = truncate(host.split('.')[0], 8);
            task = method;
          }
        } catch {
          // Invalid URL, check config for hints
          if (config.platform || config.service) {
            platform = String(config.platform || config.service);
            task = method;
          } else {
            platform = method;
            task = 'Request';
          }
        }
      } else if (config.platform || config.service) {
        // Use platform from config if URL not available
        platform = String(config.platform || config.service);
        task = method === 'POST' ? 'Post' : method === 'GET' ? 'Fetch' : method;
      } else {
        // Fallback
        platform = method;
        task = 'Request';
      }
      
      // Build label
      if (platform && task) {
        base = `${platform} ${task}`;
      } else {
        base = `${method} Request`;
      }
      
      // Add URL hostname as suffix if not already included in platform
      if (config.url && !platform.includes('FB') && !platform.includes('Instagram') && !platform.includes('Twitter') && !platform.includes('LinkedIn')) {
        try {
          const url = new URL(String(config.url));
          const host = url.hostname.replace('www.', '');
          suffix = ` – ${truncate(host, 10)}`;
        } catch {
          suffix = ' – API';
        }
      } else if (!config.url) {
        suffix = ' – API Call';
      }
      break;

    default:
      // Fallback: format kind nicely
      const parts = kind.split('.');
      base = parts[parts.length - 1]
        .split(/(?=[A-Z])/)
        .map(p => p.charAt(0).toUpperCase() + p.slice(1))
        .join(' ');
  }

  const full = base + suffix;
  return truncate(full, 24);
}

/**
 * Truncate string to max length with ellipsis
 */
function truncate(str: string, maxLen: number): string {
  if (str.length <= maxLen) return str;
  return str.substring(0, maxLen - 1) + '…';
}

