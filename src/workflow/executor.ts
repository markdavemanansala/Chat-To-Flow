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
      return {
        triggeredAt: new Date().toISOString(),
        cron: config?.cron || '* * * * *',
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
      const message = resolveTemplate(config?.message || 'Hello!', context)
      const chatId = config?.chatId || context.payload?.chatId
      
      if (!credentials) {
        throw new Error('Telegram Bot Token required')
      }
      
      // Mock Telegram API call
      console.log(`[Mock] Sending Telegram message to ${chatId}: ${message}`)
      return {
        messageId: `tg_${Date.now()}`,
        chatId,
        message,
        success: true,
      }
    }
    
    case 'action.email.send': {
      const to = resolveTemplate(config?.toExpr || context.payload?.email || '', context)
      const subject = resolveTemplate(config?.subjectTpl || 'Notification', context)
      const body = resolveTemplate(config?.bodyTpl || '', context)
      
      if (!credentials) {
        throw new Error('Email API key required')
      }
      
      // Mock email sending
      console.log(`[Mock] Sending email to ${to}: ${subject}`)
      return {
        emailId: `email_${Date.now()}`,
        to,
        subject,
        body,
        success: true,
      }
    }
    
    case 'action.sheets.appendRow': {
      const spreadsheetId = config?.spreadsheetId
      const range = config?.range || 'Sheet1!A1'
      const map = config?.map || {}
      
      if (!credentials) {
        throw new Error('Google Sheets API key required')
      }
      
      if (!spreadsheetId) {
        throw new Error('Spreadsheet ID required')
      }
      
      // Build row data from map
      const rowData: Record<string, any> = {}
      for (const [key, expr] of Object.entries(map)) {
        if (key && expr) {
          rowData[key] = resolveTemplate(String(expr), context)
        }
      }
      
      // Mock Google Sheets API call
      console.log(`[Mock] Appending row to ${spreadsheetId} at ${range}:`, rowData)
      return {
        rowId: `row_${Date.now()}`,
        spreadsheetId,
        range,
        data: rowData,
        success: true,
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
      // Simple evaluation - in production, use a proper expression evaluator
      try {
        // Very basic evaluation - be careful with eval in production!
        const result = eval(expression.replace(/\{\{([^}]+)\}\}/g, (match, expr) => {
          const parts = expr.trim().split('.')
          let value: any = context.payload
          for (const part of parts) {
            if (value && typeof value === 'object' && part in value) {
              value = value[part]
            } else {
              return 'false'
            }
          }
          return JSON.stringify(value)
        }))
        return { passed: Boolean(result), payload: context.payload }
      } catch (e) {
        throw new Error(`Filter expression error: ${e}`)
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
    for (const node of executionOrder) {
      const result = await executeNode(node, context)
      results.push(result)
      
      // Update context payload for next node
      if (result.success && result.output) {
        context.payload = result.output
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

