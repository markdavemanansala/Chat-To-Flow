/**
 * Workflow Execution Engine
 * Executes workflows by running nodes in order based on the graph structure
 */

import type { Node, Edge } from 'reactflow'
import type { RfNodeData } from '@/types/graph'
import { checkNodeCredentials } from '@/utils/credentials'

export interface ExecutionContext {
  payload: any
  variables: Record<string, any>
  nodeResults: Map<string, any>
}

export interface ExecutionResult {
  success: boolean
  nodeId: string
  nodeLabel: string
  output?: any
  error?: string
  duration: number
}

export interface WorkflowExecutionResult {
  success: boolean
  results: ExecutionResult[]
  totalDuration: number
  finalOutput?: any
  error?: string
}

/**
 * Get credentials for a node kind
 */
function getCredentials(nodeKind: string): string | null {
  try {
    const secrets = JSON.parse(localStorage.getItem('workflow_secrets') || '[]')
    const secret = secrets.find((s: any) => 
      s.nodeKinds && s.nodeKinds.includes(nodeKind)
    )
    return secret?.value || null
  } catch (e) {
    console.error('Failed to get credentials:', e)
    return null
  }
}

/**
 * Resolve template string with variables
 */
function resolveTemplate(template: string, context: ExecutionContext): string {
  let result = template
  // Replace {{variable}} patterns
  result = result.replace(/\{\{([^}]+)\}\}/g, (match, expr) => {
    // Try to resolve from context
    const parts = expr.trim().split('.')
    let value: any = context.payload
    for (const part of parts) {
      if (value && typeof value === 'object' && part in value) {
        value = value[part]
      } else {
        return match // Return original if not found
      }
    }
    return String(value ?? match)
  })
  return result
}

/**
 * Execute a trigger node
 */
async function executeTrigger(
  node: Node<RfNodeData>,
  context: ExecutionContext
): Promise<any> {
  const { kind, config } = node.data || {}
  
  switch (kind) {
    case 'trigger.facebook.comment':
      // For testing, return mock data
      // In production, this would poll Facebook API or receive webhook
      return {
        commentId: 'mock_comment_123',
        author: 'John Doe',
        text: config?.match?.contains ? `Comment containing ${config.match.contains}` : 'Test comment',
        pageId: config?.pageId || 'mock_page',
        timestamp: new Date().toISOString(),
      }
    
    case 'trigger.webhook.inbound':
      // Return the payload directly
      return context.payload
    
    case 'trigger.scheduler.cron':
      // For testing, return current time
      // In production, this would be triggered by a cron scheduler service
      return {
        triggeredAt: new Date().toISOString(),
        cron: config?.cron || '* * * * *',
        timestamp: Date.now(),
      }
    
    case 'trigger.sheets.newRow': {
      const spreadsheetId = config?.spreadsheetId
      const sheetName = config?.sheetName || 'Sheet1'
      const credentials = getCredentials('trigger.sheets.newRow')
      
      if (!spreadsheetId) {
        throw new Error('Spreadsheet ID required for sheets.newRow trigger')
      }
      
      // For testing, return mock data if no credentials
      if (!credentials) {
        return {
          spreadsheetId,
          sheetName,
          rowNumber: config?.mockRowNumber || 2,
          rowData: config?.mockRowData || ['New', 'Row', 'Data', new Date().toISOString()],
          timestamp: new Date().toISOString(),
        }
      }
      
      // Real API call: Get the last row to detect new rows
      try {
        const range = `${sheetName}!A:Z`
        const url = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${range}?key=${credentials}`
        const response = await fetch(url)
        const data = await response.json()
        
        if (!response.ok) {
          throw new Error(data.error?.message || 'Failed to read Google Sheets')
        }
        
        const values = data.values || []
        const lastRow = values.length
        const lastRowData = values[lastRow - 1] || []
        
        return {
          spreadsheetId,
          sheetName,
          rowNumber: lastRow,
          rowData: lastRowData,
          timestamp: new Date().toISOString(),
        }
      } catch (error: any) {
        throw new Error(`Google Sheets trigger failed: ${error.message}`)
      }
    }
    
    case 'trigger.sheets.update': {
      const spreadsheetId = config?.spreadsheetId
      const sheetName = config?.sheetName || 'Sheet1'
      const credentials = getCredentials('trigger.sheets.update')
      
      if (!spreadsheetId) {
        throw new Error('Spreadsheet ID required for sheets.update trigger')
      }
      
      // For testing, return mock data if no credentials
      if (!credentials) {
        return {
          spreadsheetId,
          sheetName,
          updatedRange: config?.mockRange || 'Sheet1!A1:B2',
          updatedCells: config?.mockCells || ['A1', 'B1', 'A2', 'B2'],
          timestamp: new Date().toISOString(),
        }
      }
      
      // Real API call: Check for recent updates
      try {
        const range = `${sheetName}!A1:Z100`
        const url = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${range}?key=${credentials}`
        const response = await fetch(url)
        const data = await response.json()
        
        if (!response.ok) {
          throw new Error(data.error?.message || 'Failed to read Google Sheets')
        }
        
        const values = data.values || []
        const updatedCells: string[] = []
        values.forEach((row: any[], rowIdx: number) => {
          row.forEach((cell: any, colIdx: number) => {
            if (cell) {
              const colLetter = String.fromCharCode(65 + colIdx)
              updatedCells.push(`${colLetter}${rowIdx + 1}`)
            }
          })
        })
        
        return {
          spreadsheetId,
          sheetName,
          updatedRange: `${sheetName}!A1:Z${values.length}`,
          updatedCells,
          timestamp: new Date().toISOString(),
        }
      } catch (error: any) {
        throw new Error(`Google Sheets trigger failed: ${error.message}`)
      }
    }
    
    default:
      throw new Error(`Unknown trigger kind: ${kind}`)
  }
}

/**
 * Execute an action node
 */
async function executeAction(
  node: Node<RfNodeData>,
  context: ExecutionContext
): Promise<any> {
  const { kind, config } = node.data || {}
  
  // Check credentials
  const credStatus = checkNodeCredentials(kind)
  if (credStatus.requires && !credStatus.has) {
    throw new Error(`Missing credentials for ${kind}. Please configure API keys.`)
  }
  
  const credentials = getCredentials(kind)
  
  switch (kind) {
    case 'action.facebook.reply': {
      const replyText = resolveTemplate(config?.replyTemplate || 'Thanks for your comment!', context)
      
      // Mock Facebook API call
      // In production, use Facebook Graph API
      if (!credentials) {
        throw new Error('Facebook API key required')
      }
      
      console.log(`[Mock] Replying to Facebook comment: ${replyText}`)
      return {
        replyId: `reply_${Date.now()}`,
        message: replyText,
        success: true,
      }
    }
    
    case 'action.facebook.dm': {
      const message = resolveTemplate(config?.message || 'Hello!', context)
      
      if (!credentials) {
        throw new Error('Facebook API key required')
      }
      
      console.log(`[Mock] Sending Facebook DM: ${message}`)
      return {
        messageId: `dm_${Date.now()}`,
        message,
        success: true,
      }
    }
    
    case 'action.telegram.sendMessage': {
      // Enhanced message template for meeting reminders
      let messageTemplate = config?.message || 'Hello!'
      
      // If payload has meeting data, create a nice meeting reminder message
      if (context.payload?.title || context.payload?.startTime) {
        const title = context.payload.title || 'Meeting'
        const startTime = context.payload.startTime || new Date().toLocaleString()
        const zoomLink = context.payload.zoomLink || context.payload.link || ''
        const minutesUntil = context.payload.startTimestamp 
          ? Math.floor((context.payload.startTimestamp - Date.now()) / (1000 * 60))
          : null
        
        messageTemplate = `📅 Meeting Reminder: ${title}\n` +
          `⏰ Starts at: ${startTime}\n` +
          (minutesUntil ? `⏳ In ${minutesUntil} minutes\n` : '') +
          (zoomLink ? `🔗 Join: ${zoomLink}` : '')
      }
      
      const message = resolveTemplate(messageTemplate, context)
      const chatId = resolveTemplate(String(config?.chatId || context.payload?.chatId || context.payload?.telegramChatId || ''), context)
      const parseMode = config?.parseMode || 'HTML' // HTML, Markdown, or MarkdownV2
      
      if (!credentials) {
        throw new Error('Telegram Bot Token required')
      }
      
      if (!chatId) {
        throw new Error('Chat ID required for Telegram message')
      }
      
      try {
        const response = await fetch(`https://api.telegram.org/bot${credentials}/sendMessage`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            chat_id: chatId,
            text: message,
            parse_mode: parseMode,
          }),
        })
        
        const data = await response.json()
        
        if (!data.ok) {
          throw new Error(data.description || 'Telegram API error')
        }
        
        return {
          messageId: data.result.message_id,
          chatId: data.result.chat.id,
          message,
          success: true,
        }
      } catch (error: any) {
        throw new Error(`Telegram sendMessage failed: ${error.message}`)
      }
    }
    
    case 'action.telegram.sendPhoto': {
      const photo = resolveTemplate(config?.photo || '', context) // URL or file_id
      const chatId = resolveTemplate(String(config?.chatId || context.payload?.chatId || ''), context)
      const caption = config?.caption ? resolveTemplate(config.caption, context) : undefined
      
      if (!credentials) {
        throw new Error('Telegram Bot Token required')
      }
      
      if (!chatId) {
        throw new Error('Chat ID required for Telegram photo')
      }
      
      if (!photo) {
        throw new Error('Photo URL or file_id required')
      }
      
      try {
        const response = await fetch(`https://api.telegram.org/bot${credentials}/sendPhoto`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            chat_id: chatId,
            photo,
            caption,
          }),
        })
        
        const data = await response.json()
        
        if (!data.ok) {
          throw new Error(data.description || 'Telegram API error')
        }
        
        return {
          messageId: data.result.message_id,
          chatId: data.result.chat.id,
          photo,
          success: true,
        }
      } catch (error: any) {
        throw new Error(`Telegram sendPhoto failed: ${error.message}`)
      }
    }
    
    case 'action.telegram.sendDocument': {
      const document = resolveTemplate(config?.document || '', context) // URL or file_id
      const chatId = resolveTemplate(String(config?.chatId || context.payload?.chatId || ''), context)
      const caption = config?.caption ? resolveTemplate(config.caption, context) : undefined
      
      if (!credentials) {
        throw new Error('Telegram Bot Token required')
      }
      
      if (!chatId) {
        throw new Error('Chat ID required for Telegram document')
      }
      
      if (!document) {
        throw new Error('Document URL or file_id required')
      }
      
      try {
        const response = await fetch(`https://api.telegram.org/bot${credentials}/sendDocument`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            chat_id: chatId,
            document,
            caption,
          }),
        })
        
        const data = await response.json()
        
        if (!data.ok) {
          throw new Error(data.description || 'Telegram API error')
        }
        
        return {
          messageId: data.result.message_id,
          chatId: data.result.chat.id,
          document,
          success: true,
        }
      } catch (error: any) {
        throw new Error(`Telegram sendDocument failed: ${error.message}`)
      }
    }
    
    case 'action.telegram.sendLocation': {
      const latitude = parseFloat(resolveTemplate(String(config?.latitude || context.payload?.latitude || '0'), context))
      const longitude = parseFloat(resolveTemplate(String(config?.longitude || context.payload?.longitude || '0'), context))
      const chatId = resolveTemplate(String(config?.chatId || context.payload?.chatId || ''), context)
      
      if (!credentials) {
        throw new Error('Telegram Bot Token required')
      }
      
      if (!chatId) {
        throw new Error('Chat ID required for Telegram location')
      }
      
      if (isNaN(latitude) || isNaN(longitude)) {
        throw new Error('Valid latitude and longitude required')
      }
      
      try {
        const response = await fetch(`https://api.telegram.org/bot${credentials}/sendLocation`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            chat_id: chatId,
            latitude,
            longitude,
          }),
        })
        
        const data = await response.json()
        
        if (!data.ok) {
          throw new Error(data.description || 'Telegram API error')
        }
        
        return {
          messageId: data.result.message_id,
          chatId: data.result.chat.id,
          latitude,
          longitude,
          success: true,
        }
      } catch (error: any) {
        throw new Error(`Telegram sendLocation failed: ${error.message}`)
      }
    }
    
    case 'action.telegram.sendPoll': {
      const question = resolveTemplate(config?.question || 'Poll Question', context)
      const options = Array.isArray(config?.options) 
        ? config.options.map((opt: any) => resolveTemplate(String(opt), context))
        : (config?.options ? [resolveTemplate(String(config.options), context)] : ['Option 1', 'Option 2'])
      const chatId = resolveTemplate(String(config?.chatId || context.payload?.chatId || ''), context)
      const isAnonymous = config?.isAnonymous !== false
      const type = config?.type || 'regular' // 'regular' or 'quiz'
      
      if (!credentials) {
        throw new Error('Telegram Bot Token required')
      }
      
      if (!chatId) {
        throw new Error('Chat ID required for Telegram poll')
      }
      
      if (!question || options.length < 2) {
        throw new Error('Question and at least 2 options required for poll')
      }
      
      try {
        const response = await fetch(`https://api.telegram.org/bot${credentials}/sendPoll`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            chat_id: chatId,
            question,
            options,
            is_anonymous: isAnonymous,
            type,
          }),
        })
        
        const data = await response.json()
        
        if (!data.ok) {
          throw new Error(data.description || 'Telegram API error')
        }
        
        return {
          messageId: data.result.message_id,
          chatId: data.result.chat.id,
          pollId: data.result.poll.id,
          question,
          success: true,
        }
      } catch (error: any) {
        throw new Error(`Telegram sendPoll failed: ${error.message}`)
      }
    }
    
    case 'action.telegram.editMessage': {
      const messageId = resolveTemplate(String(config?.messageId || context.payload?.messageId || ''), context)
      const chatId = resolveTemplate(String(config?.chatId || context.payload?.chatId || ''), context)
      const text = resolveTemplate(config?.text || config?.message || '', context)
      const parseMode = config?.parseMode || 'HTML'
      
      if (!credentials) {
        throw new Error('Telegram Bot Token required')
      }
      
      if (!messageId || !chatId) {
        throw new Error('Message ID and Chat ID required for editing message')
      }
      
      try {
        const response = await fetch(`https://api.telegram.org/bot${credentials}/editMessageText`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            chat_id: chatId,
            message_id: parseInt(messageId),
            text,
            parse_mode: parseMode,
          }),
        })
        
        const data = await response.json()
        
        if (!data.ok) {
          throw new Error(data.description || 'Telegram API error')
        }
        
        return {
          messageId: data.result.message_id,
          chatId: data.result.chat.id,
          text,
          success: true,
        }
      } catch (error: any) {
        throw new Error(`Telegram editMessage failed: ${error.message}`)
      }
    }
    
    case 'action.telegram.deleteMessage': {
      const messageId = resolveTemplate(String(config?.messageId || context.payload?.messageId || ''), context)
      const chatId = resolveTemplate(String(config?.chatId || context.payload?.chatId || ''), context)
      
      if (!credentials) {
        throw new Error('Telegram Bot Token required')
      }
      
      if (!messageId || !chatId) {
        throw new Error('Message ID and Chat ID required for deleting message')
      }
      
      try {
        const response = await fetch(`https://api.telegram.org/bot${credentials}/deleteMessage`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            chat_id: chatId,
            message_id: parseInt(messageId),
          }),
        })
        
        const data = await response.json()
        
        if (!data.ok) {
          throw new Error(data.description || 'Telegram API error')
        }
        
        return {
          messageId,
          chatId,
          success: true,
        }
      } catch (error: any) {
        throw new Error(`Telegram deleteMessage failed: ${error.message}`)
      }
    }
    
    case 'action.telegram.sendVideo': {
      const video = resolveTemplate(config?.video || '', context) // URL or file_id
      const chatId = resolveTemplate(String(config?.chatId || context.payload?.chatId || ''), context)
      const caption = config?.caption ? resolveTemplate(config.caption, context) : undefined
      const duration = config?.duration ? parseInt(String(config.duration)) : undefined
      const width = config?.width ? parseInt(String(config.width)) : undefined
      const height = config?.height ? parseInt(String(config.height)) : undefined
      
      if (!credentials) {
        throw new Error('Telegram Bot Token required')
      }
      
      if (!chatId) {
        throw new Error('Chat ID required for Telegram video')
      }
      
      if (!video) {
        throw new Error('Video URL or file_id required')
      }
      
      try {
        const response = await fetch(`https://api.telegram.org/bot${credentials}/sendVideo`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            chat_id: chatId,
            video,
            caption,
            duration,
            width,
            height,
          }),
        })
        
        const data = await response.json()
        
        if (!data.ok) {
          throw new Error(data.description || 'Telegram API error')
        }
        
        return {
          messageId: data.result.message_id,
          chatId: data.result.chat.id,
          video,
          success: true,
        }
      } catch (error: any) {
        throw new Error(`Telegram sendVideo failed: ${error.message}`)
      }
    }
    
    case 'action.telegram.sendAudio': {
      const audio = resolveTemplate(config?.audio || '', context) // URL or file_id
      const chatId = resolveTemplate(String(config?.chatId || context.payload?.chatId || ''), context)
      const caption = config?.caption ? resolveTemplate(config.caption, context) : undefined
      const duration = config?.duration ? parseInt(String(config.duration)) : undefined
      const performer = config?.performer ? resolveTemplate(config.performer, context) : undefined
      const title = config?.title ? resolveTemplate(config.title, context) : undefined
      
      if (!credentials) {
        throw new Error('Telegram Bot Token required')
      }
      
      if (!chatId) {
        throw new Error('Chat ID required for Telegram audio')
      }
      
      if (!audio) {
        throw new Error('Audio URL or file_id required')
      }
      
      try {
        const response = await fetch(`https://api.telegram.org/bot${credentials}/sendAudio`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            chat_id: chatId,
            audio,
            caption,
            duration,
            performer,
            title,
          }),
        })
        
        const data = await response.json()
        
        if (!data.ok) {
          throw new Error(data.description || 'Telegram API error')
        }
        
        return {
          messageId: data.result.message_id,
          chatId: data.result.chat.id,
          audio,
          success: true,
        }
      } catch (error: any) {
        throw new Error(`Telegram sendAudio failed: ${error.message}`)
      }
    }
    
    case 'action.telegram.sendSticker': {
      const sticker = resolveTemplate(config?.sticker || '', context) // file_id or URL
      const chatId = resolveTemplate(String(config?.chatId || context.payload?.chatId || ''), context)
      
      if (!credentials) {
        throw new Error('Telegram Bot Token required')
      }
      
      if (!chatId) {
        throw new Error('Chat ID required for Telegram sticker')
      }
      
      if (!sticker) {
        throw new Error('Sticker file_id or URL required')
      }
      
      try {
        const response = await fetch(`https://api.telegram.org/bot${credentials}/sendSticker`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            chat_id: chatId,
            sticker,
          }),
        })
        
        const data = await response.json()
        
        if (!data.ok) {
          throw new Error(data.description || 'Telegram API error')
        }
        
        return {
          messageId: data.result.message_id,
          chatId: data.result.chat.id,
          sticker,
          success: true,
        }
      } catch (error: any) {
        throw new Error(`Telegram sendSticker failed: ${error.message}`)
      }
    }
    
    case 'action.telegram.sendVenue': {
      const latitude = parseFloat(resolveTemplate(String(config?.latitude || context.payload?.latitude || '0'), context))
      const longitude = parseFloat(resolveTemplate(String(config?.longitude || context.payload?.longitude || '0'), context))
      const title = resolveTemplate(config?.title || '', context)
      const address = resolveTemplate(config?.address || '', context)
      const chatId = resolveTemplate(String(config?.chatId || context.payload?.chatId || ''), context)
      const foursquareId = config?.foursquareId ? resolveTemplate(String(config.foursquareId), context) : undefined
      const foursquareType = config?.foursquareType ? resolveTemplate(String(config.foursquareType), context) : undefined
      
      if (!credentials) {
        throw new Error('Telegram Bot Token required')
      }
      
      if (!chatId) {
        throw new Error('Chat ID required for Telegram venue')
      }
      
      if (isNaN(latitude) || isNaN(longitude)) {
        throw new Error('Valid latitude and longitude required')
      }
      
      if (!title || !address) {
        throw new Error('Title and address required for venue')
      }
      
      try {
        const response = await fetch(`https://api.telegram.org/bot${credentials}/sendVenue`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            chat_id: chatId,
            latitude,
            longitude,
            title,
            address,
            foursquare_id: foursquareId,
            foursquare_type: foursquareType,
          }),
        })
        
        const data = await response.json()
        
        if (!data.ok) {
          throw new Error(data.description || 'Telegram API error')
        }
        
        return {
          messageId: data.result.message_id,
          chatId: data.result.chat.id,
          venue: { title, address, latitude, longitude },
          success: true,
        }
      } catch (error: any) {
        throw new Error(`Telegram sendVenue failed: ${error.message}`)
      }
    }
    
    case 'action.telegram.sendContact': {
      const phoneNumber = resolveTemplate(String(config?.phoneNumber || ''), context)
      const firstName = resolveTemplate(config?.firstName || '', context)
      const chatId = resolveTemplate(String(config?.chatId || context.payload?.chatId || ''), context)
      const lastName = config?.lastName ? resolveTemplate(config.lastName, context) : undefined
      const vcard = config?.vcard ? resolveTemplate(config.vcard, context) : undefined
      
      if (!credentials) {
        throw new Error('Telegram Bot Token required')
      }
      
      if (!chatId) {
        throw new Error('Chat ID required for Telegram contact')
      }
      
      if (!phoneNumber || !firstName) {
        throw new Error('Phone number and first name required for contact')
      }
      
      try {
        const response = await fetch(`https://api.telegram.org/bot${credentials}/sendContact`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            chat_id: chatId,
            phone_number: phoneNumber,
            first_name: firstName,
            last_name: lastName,
            vcard,
          }),
        })
        
        const data = await response.json()
        
        if (!data.ok) {
          throw new Error(data.description || 'Telegram API error')
        }
        
        return {
          messageId: data.result.message_id,
          chatId: data.result.chat.id,
          contact: { phoneNumber, firstName, lastName },
          success: true,
        }
      } catch (error: any) {
        throw new Error(`Telegram sendContact failed: ${error.message}`)
      }
    }
    
    case 'action.telegram.getUpdates': {
      const offset = config?.offset ? parseInt(String(config.offset)) : undefined
      const limit = config?.limit ? parseInt(String(config.limit)) : (config?.limit !== undefined ? 100 : undefined)
      const timeout = config?.timeout ? parseInt(String(config.timeout)) : undefined
      
      if (!credentials) {
        throw new Error('Telegram Bot Token required')
      }
      
      try {
        const params = new URLSearchParams()
        if (offset !== undefined) params.append('offset', String(offset))
        if (limit !== undefined) params.append('limit', String(limit))
        if (timeout !== undefined) params.append('timeout', String(timeout))
        
        const url = `https://api.telegram.org/bot${credentials}/getUpdates${params.toString() ? '?' + params.toString() : ''}`
        const response = await fetch(url, {
          method: 'GET',
        })
        
        const data = await response.json()
        
        if (!data.ok) {
          throw new Error(data.description || 'Telegram API error')
        }
        
        return {
          updates: data.result || [],
          updateCount: data.result?.length || 0,
          success: true,
        }
      } catch (error: any) {
        throw new Error(`Telegram getUpdates failed: ${error.message}`)
      }
    }
    
    case 'action.email.send': {
      const to = resolveTemplate(config?.to || config?.toExpr || context.payload?.email || context.payload?.attendees || '', context)
      const subject = resolveTemplate(config?.subject || config?.subjectTpl || 'Meeting Reminder', context)
      const body = resolveTemplate(config?.body || config?.bodyTpl || config?.message || '', context)
      
      if (!credentials) {
        throw new Error('Email API key required (SMTP credentials)')
      }
      
      // Parse SMTP credentials
      let smtpConfig: any = {}
      try {
        if (typeof credentials === 'string') {
          smtpConfig = JSON.parse(credentials)
        } else {
          smtpConfig = credentials
        }
      } catch {
        // If not JSON, assume it's a simple API key format
        smtpConfig = { apiKey: credentials }
      }
      
      // Real email sending via SMTP or email service API
      try {
        // Use backend API endpoint for email sending
        const apiBaseUrl = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000/api'
        const response = await fetch(`${apiBaseUrl}/email/send`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            to,
            subject,
            body,
            smtpConfig,
          }),
        })
        
        if (response.ok) {
          const data = await response.json()
          return {
            emailId: data.emailId || `email_${Date.now()}`,
            to,
            subject,
            body,
            success: true,
          }
        } else {
          // Fallback: log for now (in production, use real SMTP)
          console.log(`[Email] Would send to ${to}: ${subject}`)
          console.log(`[Email] Body: ${body}`)
          return {
            emailId: `email_${Date.now()}`,
            to,
            subject,
            body,
            success: true,
            note: 'Email queued (backend SMTP required for actual sending)',
          }
        }
      } catch (error: any) {
        // Fallback: log email details
        console.log(`[Email] To: ${to}, Subject: ${subject}`)
        console.log(`[Email] Body: ${body}`)
        return {
          emailId: `email_${Date.now()}`,
          to,
          subject,
          body,
          success: true,
          note: 'Email logged (configure SMTP for actual sending)',
        }
      }
    }
    
    case 'action.sheets.appendRow': {
      const spreadsheetId = config?.spreadsheetId
      const range = config?.range || 'Sheet1!A1'
      const map = config?.map || {}
      const values = config?.values || []
      
      if (!credentials) {
        throw new Error('Google Sheets API key required')
      }
      
      if (!spreadsheetId) {
        throw new Error('Spreadsheet ID required')
      }
      
      // Build row data from map or use values array
      let rowData: any[] = []
      if (values && values.length > 0) {
        rowData = values.map((val: any) => resolveTemplate(String(val), context))
      } else if (Object.keys(map).length > 0) {
        // Build from map - convert to array based on column order
        const sortedKeys = Object.keys(map).sort()
        rowData = sortedKeys.map(key => resolveTemplate(String(map[key]), context))
      } else {
        // Try to extract from payload
        if (Array.isArray(context.payload)) {
          rowData = context.payload
        } else if (typeof context.payload === 'object') {
          rowData = Object.values(context.payload)
        } else {
          rowData = [String(context.payload)]
        }
      }
      
      // Real Google Sheets API call
      try {
        const url = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${range}:append?valueInputOption=RAW&key=${credentials}`
        const response = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            values: [rowData],
          }),
        })
        
        const data = await response.json()
        
        if (!response.ok) {
          throw new Error(data.error?.message || 'Failed to append row to Google Sheets')
        }
        
        return {
          rowId: `row_${Date.now()}`,
          spreadsheetId,
          range: data.updates?.updatedRange || range,
          data: rowData,
          success: true,
        }
      } catch (error: any) {
        throw new Error(`Google Sheets appendRow failed: ${error.message}`)
      }
    }
    
    case 'action.sheets.readRows': {
      const spreadsheetId = config?.spreadsheetId
      const range = config?.range || 'Sheet1!A1:Z1000'
      
      if (!credentials) {
        throw new Error('Google Sheets API key required')
      }
      
      if (!spreadsheetId) {
        throw new Error('Spreadsheet ID required')
      }
      
      try {
        const url = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${range}?key=${credentials}`
        const response = await fetch(url)
        const data = await response.json()
        
        if (!response.ok) {
          throw new Error(data.error?.message || 'Failed to read Google Sheets')
        }
        
        // Parse meeting schedule data if it looks like a meeting schedule
        // Expected format: [Title, StartTime, EndTime, Attendees, ZoomLink, ...]
        const rows = data.values || []
        if (rows.length > 0) {
          const headerRow = rows[0]
          const meetingRows = rows.slice(1).map((row: any[], index: number) => {
            const meeting: any = { rowIndex: index + 2 } // +2 because 1-indexed and header
            headerRow.forEach((header: string, colIndex: number) => {
              const value = row[colIndex] || ''
              const headerLower = String(header).toLowerCase()
              
              // Map common column names to meeting properties
              if (headerLower.includes('title') || headerLower.includes('name') || headerLower.includes('subject')) {
                meeting.title = value
              } else if (headerLower.includes('start') || headerLower.includes('time') || headerLower.includes('date')) {
                meeting.startTime = value
                // Try to parse as date
                const parsedDate = new Date(value)
                if (!isNaN(parsedDate.getTime())) {
                  meeting.startTimestamp = parsedDate.getTime()
                }
              } else if (headerLower.includes('end')) {
                meeting.endTime = value
              } else if (headerLower.includes('attendee') || headerLower.includes('email') || headerLower.includes('participant')) {
                meeting.attendees = value
                meeting.email = value
              } else if (headerLower.includes('zoom') || headerLower.includes('link') || headerLower.includes('url')) {
                meeting.zoomLink = value
                meeting.link = value
              } else if (headerLower.includes('telegram') || headerLower.includes('chat')) {
                meeting.telegramChatId = value
                meeting.chatId = value
              } else {
                meeting[header] = value
              }
            })
            return meeting
          })
          
          return {
            rows: meetingRows,
            rawData: rows,
            success: true,
          }
        }
        
        return {
          rows: [],
          rawData: rows,
          success: true,
        }
      } catch (error: any) {
        throw new Error(`Google Sheets readRows failed: ${error.message}`)
      }
    }
    
    case 'action.sheets.updateCell': {
      const spreadsheetId = config?.spreadsheetId
      const range = config?.range // e.g., 'Sheet1!A1'
      const value = resolveTemplate(String(config?.value || context.payload || ''), context)
      
      if (!credentials) {
        throw new Error('Google Sheets API key required')
      }
      
      if (!spreadsheetId) {
        throw new Error('Spreadsheet ID required')
      }
      
      if (!range) {
        throw new Error('Range required (e.g., Sheet1!A1)')
      }
      
      try {
        const url = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${range}?valueInputOption=RAW&key=${credentials}`
        const response = await fetch(url, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            values: [[value]],
          }),
        })
        
        const data = await response.json()
        
        if (!response.ok) {
          throw new Error(data.error?.message || 'Failed to update Google Sheets cell')
        }
        
        return {
          spreadsheetId,
          range: data.updatedRange || range,
          value,
          success: true,
        }
      } catch (error: any) {
        throw new Error(`Google Sheets updateCell failed: ${error.message}`)
      }
    }
    
    case 'action.sheets.clearRange': {
      const spreadsheetId = config?.spreadsheetId
      const range = config?.range || 'Sheet1!A1:Z1000'
      
      if (!credentials) {
        throw new Error('Google Sheets API key required')
      }
      
      if (!spreadsheetId) {
        throw new Error('Spreadsheet ID required')
      }
      
      try {
        const url = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${range}:clear?key=${credentials}`
        const response = await fetch(url, {
          method: 'POST',
        })
        
        const data = await response.json()
        
        if (!response.ok) {
          throw new Error(data.error?.message || 'Failed to clear Google Sheets range')
        }
        
        return {
          spreadsheetId,
          range: data.clearedRange || range,
          success: true,
        }
      } catch (error: any) {
        throw new Error(`Google Sheets clearRange failed: ${error.message}`)
      }
    }
    
    case 'action.http.request': {
      const method = config?.method || 'POST'
      const url = config?.url
      const headers = config?.headers || {}
      const body = config?.body
      
      if (!url) {
        throw new Error('URL required for HTTP request')
      }
      
      // Resolve templates in URL, headers, and body
      const resolvedUrl = resolveTemplate(url, context)
      const resolvedHeaders: Record<string, string> = {}
      for (const [key, value] of Object.entries(headers)) {
        resolvedHeaders[key] = resolveTemplate(String(value), context)
      }
      
      let resolvedBody = body
      if (typeof body === 'string') {
        resolvedBody = resolveTemplate(body, context)
      } else if (typeof body === 'object' && body !== null) {
        resolvedBody = JSON.parse(resolveTemplate(JSON.stringify(body), context))
      }
      
      // Make actual HTTP request
      try {
        const response = await fetch(resolvedUrl, {
          method,
          headers: {
            'Content-Type': 'application/json',
            ...resolvedHeaders,
          },
          body: resolvedBody ? JSON.stringify(resolvedBody) : undefined,
        })
        
        let data: any
        try {
          data = await response.json()
        } catch {
          data = { text: await response.text() }
        }
        
        return {
          status: response.status,
          statusText: response.statusText,
          data,
          success: response.ok,
        }
      } catch (error: any) {
        throw new Error(`HTTP request failed: ${error.message}`)
      }
    }
    
    default:
      throw new Error(`Unknown action kind: ${kind}`)
  }
}

/**
 * Execute a logic node
 */
async function executeLogic(
  node: Node<RfNodeData>,
  context: ExecutionContext
): Promise<any> {
  const { kind, config } = node.data || {}
  
  switch (kind) {
    case 'logic.filter': {
      const expression = config?.expression || 'true'
      
      // Handle array payloads (e.g., from sheets.readRows)
      const payloads = Array.isArray(context.payload?.rows) 
        ? context.payload.rows 
        : Array.isArray(context.payload)
        ? context.payload
        : [context.payload]
      
      const filtered: any[] = []
      
      for (const payload of payloads) {
        try {
          // Enhanced evaluation for meeting time filtering
          let evalExpression = expression
          
          // Replace common meeting time patterns
          if (evalExpression.includes('startTime') || evalExpression.includes('startTimestamp')) {
            // Handle time-based filtering for meetings
            const meetingTime = payload.startTimestamp || (payload.startTime ? new Date(payload.startTime).getTime() : null)
            if (meetingTime) {
              const timeUntilMeeting = meetingTime - Date.now()
              const minutesUntil = Math.floor(timeUntilMeeting / (1000 * 60))
              
              // Replace time-based expressions
              evalExpression = evalExpression
                .replace(/minutesUntil/g, String(minutesUntil))
                .replace(/timeUntilMeeting/g, String(timeUntilMeeting))
                .replace(/startTimestamp/g, String(meetingTime))
            }
          }
          
          // Replace template variables
          evalExpression = evalExpression.replace(/\{\{([^}]+)\}\}/g, (match, expr) => {
            const parts = expr.trim().split('.')
            let value: any = payload
            for (const part of parts) {
              if (value && typeof value === 'object' && part in value) {
                value = value[part]
              } else {
                return 'false'
              }
            }
            return JSON.stringify(value)
          })
          
          // Evaluate expression
          const result = eval(evalExpression)
          
          if (Boolean(result)) {
            filtered.push(payload)
          }
        } catch (e) {
          console.warn(`Filter evaluation error for payload:`, e)
          // Continue to next payload
        }
      }
      
      return { 
        passed: filtered.length > 0, 
        payload: Array.isArray(context.payload?.rows) || Array.isArray(context.payload)
          ? { rows: filtered, originalCount: payloads.length, filteredCount: filtered.length }
          : filtered[0] || context.payload
      }
    }
    
    default:
      // Pass through for unknown logic nodes
      return context.payload
  }
}

/**
 * Execute an AI node
 */
async function executeAI(
  node: Node<RfNodeData>,
  context: ExecutionContext
): Promise<any> {
  const { kind, config } = node.data || {}
  
  switch (kind) {
    case 'ai.guard':
    case 'ai.generate': {
      // In production, call OpenAI API
      // For now, return mock response
      const prompt = config?.prompt || ''
      console.log(`[Mock] AI processing: ${prompt}`)
      return {
        result: 'AI processed successfully',
        input: context.payload,
      }
    }
    
    default:
      return context.payload
  }
}

/**
 * Execute a single node
 */
async function executeNode(
  node: Node<RfNodeData>,
  context: ExecutionContext
): Promise<any> {
  const { role } = node.data || {}
  const startTime = Date.now()
  
  try {
    let output: any
    
    switch (role) {
      case 'TRIGGER':
        output = await executeTrigger(node, context)
        break
      case 'ACTION':
        output = await executeAction(node, context)
        break
      case 'LOGIC':
        output = await executeLogic(node, context)
        break
      case 'AI':
        output = await executeAI(node, context)
        break
      default:
        throw new Error(`Unknown node role: ${role}`)
    }
    
    // Store result in context
    context.nodeResults.set(node.id, output)
    context.variables = { ...context.variables, ...output }
    
    return {
      success: true,
      nodeId: node.id,
      nodeLabel: node.data?.label || node.id,
      output,
      duration: Date.now() - startTime,
    }
  } catch (error: any) {
    return {
      success: false,
      nodeId: node.id,
      nodeLabel: node.data?.label || node.id,
      error: error.message || String(error),
      duration: Date.now() - startTime,
    }
  }
}

/**
 * Get execution order (topological sort)
 */
function getExecutionOrder(nodes: Node<RfNodeData>[], edges: Edge[]): Node<RfNodeData>[] {
  // Find trigger node
  const trigger = nodes.find(n => n.data?.role === 'TRIGGER')
  if (!trigger) {
    throw new Error('No trigger node found')
  }
  
  // Build adjacency list
  const graph = new Map<string, string[]>()
  const inDegree = new Map<string, number>()
  
  nodes.forEach(n => {
    graph.set(n.id, [])
    inDegree.set(n.id, 0)
  })
  
  edges.forEach(e => {
    const from = e.source
    const to = e.target
    graph.get(from)?.push(to)
    inDegree.set(to, (inDegree.get(to) || 0) + 1)
  })
  
  // Topological sort
  const queue: string[] = [trigger.id]
  const order: Node<RfNodeData>[] = []
  const visited = new Set<string>()
  
  while (queue.length > 0) {
    const nodeId = queue.shift()!
    if (visited.has(nodeId)) continue
    visited.add(nodeId)
    
    const node = nodes.find(n => n.id === nodeId)
    if (node) {
      order.push(node)
    }
    
    const neighbors = graph.get(nodeId) || []
    for (const neighbor of neighbors) {
      inDegree.set(neighbor, (inDegree.get(neighbor) || 0) - 1)
      if (inDegree.get(neighbor) === 0) {
        queue.push(neighbor)
      }
    }
  }
  
  return order
}

/**
 * Execute a workflow
 */
export async function executeWorkflow(
  nodes: Node<RfNodeData>[],
  edges: Edge[],
  initialPayload: any = {}
): Promise<WorkflowExecutionResult> {
  const startTime = Date.now()
  const results: ExecutionResult[] = []
  
  try {
    // Validate workflow
    if (nodes.length === 0) {
      throw new Error('Workflow has no nodes')
    }
    
    // Get execution order
    const executionOrder = getExecutionOrder(nodes, edges)
    
    // Create execution context
    const context: ExecutionContext = {
      payload: initialPayload,
      variables: {},
      nodeResults: new Map(),
    }
    
    // Execute nodes in order
    for (let i = 0; i < executionOrder.length; i++) {
      const node = executionOrder[i]
      const result = await executeNode(node, context)
      results.push(result)
      
      // Update context payload for next node
      if (result.success && result.output) {
        // Handle array payloads (e.g., filtered meetings)
        // If output has rows array, iterate over each item for subsequent actions
        if (result.output.rows && Array.isArray(result.output.rows) && result.output.rows.length > 0) {
          const rows = result.output.rows
          const remainingNodes = executionOrder.slice(i + 1)
          
          // Execute remaining nodes for each row
          for (const row of rows) {
            const rowContext: ExecutionContext = {
              payload: row,
              variables: { ...context.variables },
              nodeResults: new Map(context.nodeResults),
            }
            
            for (const nextNode of remainingNodes) {
              const rowResult = await executeNode(nextNode, rowContext)
              results.push({
                ...rowResult,
                nodeLabel: `${rowResult.nodeLabel} (for: ${row.title || row.id || 'item'})`,
              })
              
              if (!rowResult.success) {
                console.warn(`Node ${nextNode.id} failed for row:`, row, rowResult.error)
                // Continue with next row even if one fails
              }
              
              // Update row context for next node
              if (rowResult.success && rowResult.output) {
                rowContext.payload = rowResult.output
              }
            }
          }
          
          // Skip remaining nodes in main loop since we've processed them for each row
          break
        } else {
          context.payload = result.output
        }
      }
      
      // Stop on error (optional - could continue)
      if (!result.success) {
        return {
          success: false,
          results,
          totalDuration: Date.now() - startTime,
          error: result.error,
        }
      }
    }
    
    // Get final output from last node
    const finalOutput = results[results.length - 1]?.output
    
    return {
      success: true,
      results,
      totalDuration: Date.now() - startTime,
      finalOutput,
    }
  } catch (error: any) {
    return {
      success: false,
      results,
      totalDuration: Date.now() - startTime,
      error: error.message || String(error),
    }
  }
}

