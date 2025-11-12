/**
 * @fileoverview Direct template-to-nodes mapping for reliable template node creation
 */

import { createNode, connect } from './utils.js';

/**
 * Create nodes directly from template intent without AI
 * This ensures templates always create the correct nodes
 */
export function createNodesFromTemplateIntent(intent) {
  const lower = intent.toLowerCase();
  const nodes = [];
  const edges = [];
  
  let cursorX = 100;
  const y = 100;
  let lastNodeId = null;
  
  // Determine trigger based on intent
  if (lower.includes('facebook') && (lower.includes('comment') || lower.includes('reply'))) {
    const triggerNode = createNode('trigger.facebook.comment', {
      position: { x: cursorX, y },
      data: {
        label: 'Facebook Comment Trigger',
        config: { match: 'price|menu' },
      },
    });
    nodes.push(triggerNode);
    lastNodeId = triggerNode.id;
    cursorX += 250;
  } else if (lower.includes('schedule') || lower.includes('daily') || lower.includes('weekly') || 
             lower.includes('every') || lower.includes('hour') || lower.includes('monday') ||
             lower.includes('9 am') || lower.includes('9am') || lower.includes('15 minutes') ||
             lower.includes('15 min')) {
    let schedule = '0 0 * * *'; // Default: daily
    if (lower.includes('15 minutes') || lower.includes('15 min')) {
      schedule = '*/15 * * * *'; // Every 15 minutes
    } else if (lower.includes('hourly') || lower.includes('hour')) {
      schedule = '0 * * * *';
    } else if (lower.includes('daily') || lower.includes('day')) {
      schedule = '0 0 * * *';
    } else if (lower.includes('weekly') || lower.includes('monday')) {
      schedule = '0 0 * * 0';
    } else if (lower.includes('9 am') || lower.includes('9am')) {
      schedule = '0 9 * * *';
    }
    
    const triggerNode = createNode('trigger.scheduler.cron', {
      position: { x: cursorX, y },
      data: {
        label: `Schedule: ${schedule}`,
        config: { cron: schedule },
      },
    });
    nodes.push(triggerNode);
    lastNodeId = triggerNode.id;
    cursorX += 250;
  } else if (lower.includes('webhook') || lower.includes('form') || lower.includes('submit') ||
             lower.includes('lead') || lower.includes('contact form')) {
    const triggerNode = createNode('trigger.webhook.inbound', {
      position: { x: cursorX, y },
      data: {
        label: 'Webhook Trigger',
        config: { path: '/webhook', secret: '' },
      },
    });
    nodes.push(triggerNode);
    lastNodeId = triggerNode.id;
    cursorX += 250;
  }
  
  // Determine actions based on intent
  if (lower.includes('facebook') && (lower.includes('reply') || lower.includes('comment'))) {
    const actionNode = createNode('action.facebook.reply', {
      position: { x: cursorX, y },
      data: {
        label: 'Reply to Facebook Comment',
        config: { replyTemplate: 'Thanks for your comment!' },
      },
    });
    nodes.push(actionNode);
    if (lastNodeId) {
      edges.push(connect(lastNodeId, actionNode.id));
    }
    lastNodeId = actionNode.id;
    cursorX += 250;
  }
  
  if (lower.includes('facebook') && (lower.includes('dm') || lower.includes('direct message'))) {
    const actionNode = createNode('action.facebook.dm', {
      position: { x: cursorX, y },
      data: {
        label: 'Send Facebook DM',
        config: { message: 'Hello! How can we help?' },
      },
    });
    nodes.push(actionNode);
    if (lastNodeId) {
      edges.push(connect(lastNodeId, actionNode.id));
    }
    lastNodeId = actionNode.id;
    cursorX += 250;
  }
  
  if (lower.includes('sheet') || lower.includes('google') || lower.includes('save') || 
      lower.includes('log') || lower.includes('crm') || lower.includes('spreadsheet')) {
    const actionNode = createNode('action.sheets.appendRow', {
      position: { x: cursorX, y },
      data: {
        label: 'Save to Google Sheets',
        config: { spreadsheetId: '', range: 'Sheet1!A1', values: [] },
      },
    });
    nodes.push(actionNode);
    if (lastNodeId) {
      edges.push(connect(lastNodeId, actionNode.id));
    }
    lastNodeId = actionNode.id;
    cursorX += 250;
  }
  
  if (lower.includes('email') || lower.includes('send') || lower.includes('remind') || 
      lower.includes('alert') || lower.includes('notify') || lower.includes('digest')) {
    const actionNode = createNode('action.email.send', {
      position: { x: cursorX, y },
      data: {
        label: 'Send Email',
        config: { to: '', subject: 'Notification', body: 'Message' },
      },
    });
    nodes.push(actionNode);
    if (lastNodeId) {
      edges.push(connect(lastNodeId, actionNode.id));
    }
    lastNodeId = actionNode.id;
    cursorX += 250;
  }
  
  if (lower.includes('telegram') || lower.includes('sms') || lower.includes('message') || lower.includes('ping')) {
    const actionNode = createNode('action.telegram.sendMessage', {
      position: { x: cursorX, y },
      data: {
        label: 'Send Telegram Message',
        config: { chatId: '', message: 'Hello from workflow' },
      },
    });
    nodes.push(actionNode);
    if (lastNodeId) {
      edges.push(connect(lastNodeId, actionNode.id));
    }
    lastNodeId = actionNode.id;
    cursorX += 250;
  }
  
  // Meeting reminder specific logic
  if (lower.includes('meeting') || lower.includes('appointment') || lower.includes('reminder')) {
    // Add Google Sheets read action to get meeting schedule
    if (lower.includes('check') || lower.includes('schedule') || lower.includes('sheets')) {
      const sheetsNode = createNode('action.sheets.readRows', {
        position: { x: cursorX, y },
        data: {
          label: 'Read Meeting Schedule',
          config: { 
            spreadsheetId: '',
            range: 'Sheet1!A1:Z1000'
          },
        },
      });
      nodes.push(sheetsNode);
      if (lastNodeId) {
        edges.push(connect(lastNodeId, sheetsNode.id));
      }
      lastNodeId = sheetsNode.id;
      cursorX += 250;
    }
    
    // Add filter for time-based checking
    if (lower.includes('filter') || lower.includes('next') || lower.includes('near') || lower.includes('15 minutes') || lower.includes('starting')) {
      const reminderMinutes = lower.match(/(\d+)\s*min/i)?.[1] || '15';
      const filterNode = createNode('logic.filter', {
        position: { x: cursorX, y },
        data: {
          label: `Filter: Meetings in ${reminderMinutes} min`,
          config: { 
            expression: `startTimestamp && (startTimestamp - Date.now()) <= ${reminderMinutes} * 60 * 1000 && (startTimestamp - Date.now()) > 0`
          },
        },
      });
      nodes.push(filterNode);
      if (lastNodeId) {
        edges.push(connect(lastNodeId, filterNode.id));
      }
      lastNodeId = filterNode.id;
      cursorX += 250;
    }
  }
  
  // If no nodes were created, create a default trigger
  if (nodes.length === 0) {
    const triggerNode = createNode('trigger.webhook.inbound', {
      position: { x: cursorX, y },
      data: {
        label: 'Webhook Trigger',
        config: { path: '/webhook', secret: '' },
      },
    });
    nodes.push(triggerNode);
  }
  
  return { nodes, edges };
}

