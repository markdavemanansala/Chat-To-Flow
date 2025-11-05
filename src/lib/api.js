import { IS_MOCK } from './config'

/**
 * Mock implementations
 */

// Simulate network delay
const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms))

/**
 * Mock: Create workflow from template
 */
async function mockCreateWorkflowFromTemplate(templateId) {
  await delay(1000)
  
  return {
    id: `wf_${Date.now()}`,
    templateId,
    name: `Workflow from template ${templateId}`,
    steps: ['Initialize', 'Configure', 'Execute'],
    status: 'draft',
    createdAt: new Date().toISOString(),
  }
}

/**
 * Mock: Create workflow from intent text
 */
async function mockCreateWorkflowFromIntent(intentText) {
  await delay(1200)
  
  const lowerIntent = intentText.toLowerCase()
  let trigger = "Manual trigger"
  let steps = []
  let integrations = []

  // Parse intent (simple rule-based for mock)
  if (lowerIntent.includes("comment") || lowerIntent.includes("facebook")) {
    trigger = "facebook.comment"
    steps.push("facebook.reply")
    integrations.push("Facebook")
  }

  if (lowerIntent.includes("sheet") || lowerIntent.includes("google")) {
    steps.push("sheets.appendRow")
    integrations.push("Google Sheets")
  }

  steps.push("http.request (placeholder)")

  if (integrations.length === 0) {
    integrations.push("Generic")
  }

  return {
    id: `wf_${Date.now()}`,
    intent: intentText,
    trigger,
    steps,
    integrations,
    status: 'draft',
    createdAt: new Date().toISOString(),
  }
}

/**
 * Mock: Get templates
 */
async function mockGetTemplates() {
  await delay(500)
  
  return [
    { id: '1', name: 'Template 1', industry: 'Generic' },
    { id: '2', name: 'Template 2', industry: 'F&B' },
    { id: '3', name: 'Template 3', industry: 'Retail' },
  ]
}

/**
 * Real API implementations (to be implemented later)
 */

async function realCreateWorkflowFromTemplate(templateId) {
  // TODO: Implement real API call
  throw new Error('Real API not implemented yet')
}

async function realCreateWorkflowFromIntent(intentText) {
  // TODO: Implement real API call
  throw new Error('Real API not implemented yet')
}

async function realGetTemplates() {
  // TODO: Implement real API call
  throw new Error('Real API not implemented yet')
}

/**
 * Public API functions
 */

/**
 * Create a workflow from a template
 * @param {string} templateId - The ID of the template to use
 * @returns {Promise<Object>} Created workflow object
 */
export async function createWorkflowFromTemplate(templateId) {
  if (IS_MOCK) {
    return mockCreateWorkflowFromTemplate(templateId)
  }
  return realCreateWorkflowFromTemplate(templateId)
}

/**
 * Create a workflow from natural language intent
 * @param {string} intentText - Natural language description of the workflow
 * @returns {Promise<Object>} Created workflow object
 */
export async function createWorkflowFromIntent(intentText) {
  if (IS_MOCK) {
    return mockCreateWorkflowFromIntent(intentText)
  }
  return realCreateWorkflowFromIntent(intentText)
}

/**
 * Get all available templates
 * @returns {Promise<Array>} Array of template objects
 */
export async function getTemplates() {
  if (IS_MOCK) {
    return mockGetTemplates()
  }
  return realGetTemplates()
}

/**
 * Save a workflow draft to localStorage
 * @param {Object} summary - WorkflowSummary object
 * @returns {Promise<{id: string}>} Promise that resolves with the saved draft ID
 */
export async function saveWorkflowDraft(summary) {
  // Always use localStorage for drafts (even in real mode)
  await delay(800)

  try {
    // Get existing drafts from localStorage
    const existingDrafts = JSON.parse(localStorage.getItem("draftWorkflows") || "[]")
    
    // Add timestamp and ID to workflow
    const draftWorkflow = {
      ...summary,
      savedAt: new Date().toISOString(),
      id: Date.now().toString()
    }

    // Add to drafts array
    existingDrafts.push(draftWorkflow)
    
    // Save back to localStorage
    localStorage.setItem("draftWorkflows", JSON.stringify(existingDrafts))

    return { id: draftWorkflow.id }
  } catch (error) {
    console.error("Error saving draft:", error)
    throw new Error("Failed to save draft")
  }
}

/**
 * Get all saved workflow drafts
 * @returns {Promise<Object[]>} Promise that resolves with array of drafts
 */
export async function getWorkflowDrafts() {
  await delay(300)

  try {
    const drafts = JSON.parse(localStorage.getItem("draftWorkflows") || "[]")
    return drafts
  } catch (error) {
    console.error("Error loading drafts:", error)
    return []
  }
}

/**
 * Delete a workflow draft by ID
 * @param {string} id - Draft ID
 * @returns {Promise<void>} Promise that resolves when draft is deleted
 */
export async function deleteWorkflowDraft(id) {
  await delay(300)

  try {
    const drafts = JSON.parse(localStorage.getItem("draftWorkflows") || "[]")
    const filteredDrafts = drafts.filter(draft => draft.id !== id)
    localStorage.setItem("draftWorkflows", JSON.stringify(filteredDrafts))
  } catch (error) {
    console.error("Error deleting draft:", error)
    throw new Error("Failed to delete draft")
  }
}

/**
 * Modify an existing workflow by removing, updating, or adding steps
 * @param {Object} existingWorkflow - Current workflow summary
 * @param {Object} existingNodes - Current nodes array
 * @param {Object} existingEdges - Current edges array
 * @param {string} modificationType - "remove", "update", "add", or "change"
 * @param {string} targetStep - Step name to modify
 * @param {string} userMessage - Full user message for context
 * @returns {Object} Modified workflow and nodes/edges
 */
export function modifyWorkflow(existingWorkflow, existingNodes, existingEdges, modificationType, targetStep, userMessage = "") {
  if (!existingWorkflow || !existingWorkflow.steps) {
    console.warn("Cannot modify workflow: no existing workflow or steps")
    return { workflow: existingWorkflow, nodes: existingNodes, edges: existingEdges }
  }

  const workflow = { ...existingWorkflow }
  let nodes = [...existingNodes]
  let edges = [...existingEdges]
  let steps = [...workflow.steps]

  // Find the step to modify (fuzzy match)
  let stepIndex = -1
  if (targetStep) {
    stepIndex = steps.findIndex(step => 
      step.toLowerCase().includes(targetStep.toLowerCase()) || 
      targetStep.toLowerCase().includes(step.toLowerCase()) ||
      step.toLowerCase().replace(/\s+/g, ' ') === targetStep.toLowerCase().trim()
    )
    
    // If exact match not found, try partial matching
    if (stepIndex === -1) {
      const targetWords = targetStep.toLowerCase().split(/\s+/).filter(w => w.length > 3)
      stepIndex = steps.findIndex(step => {
        const stepLower = step.toLowerCase()
        return targetWords.some(word => stepLower.includes(word))
      })
    }
  }

  if (modificationType === 'remove' && stepIndex >= 0) {
    // Remove the step
    const removedStep = steps[stepIndex]
    steps.splice(stepIndex, 1)
    workflow.steps = steps

    // Remove corresponding node
    const nodeToRemove = nodes.find(node => {
      const nodeLabel = node.data?.label || node.label || ''
      return nodeLabel === removedStep || 
             nodeLabel.toLowerCase().includes(removedStep.toLowerCase()) ||
             removedStep.toLowerCase().includes(nodeLabel.toLowerCase())
    })

    if (nodeToRemove) {
      // Find edges before removing the node
      const incomingEdge = edges.find(e => e.target === nodeToRemove.id)
      const outgoingEdge = edges.find(e => e.source === nodeToRemove.id)
      
      // Remove the node
      nodes = nodes.filter(node => node.id !== nodeToRemove.id)
      
      // Remove edges connected to this node
      edges = edges.filter(edge => 
        edge.source !== nodeToRemove.id && edge.target !== nodeToRemove.id
      )

      // Reconnect edges if needed
      if (incomingEdge && outgoingEdge && incomingEdge.source !== outgoingEdge.target) {
        // Create new edge connecting the nodes before and after
        edges.push({
          id: `edge_${incomingEdge.source}_${outgoingEdge.target}_${Date.now()}`,
          source: incomingEdge.source,
          target: outgoingEdge.target,
          type: 'default',
          animated: false
        })
      }
    }

    // Update integrations if needed
    if (nodeToRemove) {
      const kind = nodeToRemove.data?.kind || ''
      if (kind.includes('sheets')) {
        workflow.integrations = workflow.integrations.filter(i => i !== 'Google Sheets')
      } else if (kind.includes('facebook')) {
        // Only remove Facebook if no other Facebook nodes exist
        const hasOtherFacebook = nodes.some(n => (n.data?.kind || '').includes('facebook'))
        if (!hasOtherFacebook) {
          workflow.integrations = workflow.integrations.filter(i => i !== 'Facebook')
        }
      } else if (kind.includes('email')) {
        workflow.integrations = workflow.integrations.filter(i => i !== 'Email')
      }
    }
  } else if (modificationType === 'update' || modificationType === 'change') {
    // Update the step (for now, just acknowledge - could be enhanced to update step details)
    // This would require more AI processing to understand what the user wants to change it to
    console.log("Update/change modification requested for step:", targetStep)
  } else if (modificationType === 'add') {
    // Add a new step (would need AI to determine what to add)
    console.log("Add modification requested")
  }

  return {
    workflow,
    nodes,
    edges
  }
}

// Helper function to extract step name from user message
function extractStepName(userMessage, workflow) {
  if (!workflow || !workflow.steps) return null
  
  const lowerMessage = userMessage.toLowerCase()
  const steps = workflow.steps || []
  
  // Try to find a step that matches keywords in the user message
  for (const step of steps) {
    const stepLower = step.toLowerCase()
    const stepWords = stepLower.split(/\s+/).filter(w => w.length > 3)
    
    // Check if any significant words from the step appear in the user message
    for (const word of stepWords) {
      if (lowerMessage.includes(word)) {
        return step
      }
    }
  }
  
  // Try to extract step name from common patterns
  const patterns = [
    /(?:remove|delete|change|update|modify|add|insert)\s+(?:the\s+)?(?:step\s+)?["']?([^"']+?)["']?(?:\s+step)?/i,
    /(?:remove|delete|change|update|modify|add|insert)\s+(?:the\s+)?([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)/,
  ]
  
  for (const pattern of patterns) {
    const match = userMessage.match(pattern)
    if (match && match[1]) {
      const extracted = match[1].trim()
      // Try to match against actual steps
      for (const step of steps) {
        if (step.toLowerCase().includes(extracted.toLowerCase()) || extracted.toLowerCase().includes(step.toLowerCase().split(' ')[0])) {
          return step
        }
      }
      return extracted
    }
  }
  
  return null
}

export async function getConversationalResponse(userMessage, conversationHistory = [], context = {}) {
  const { OPENAI_API_KEY } = await import('./config')
  
  // Always try to use OpenAI, but handle missing key gracefully with context-aware fallback
  if (!OPENAI_API_KEY || !OPENAI_API_KEY.trim()) {
    await delay(500)
    const lower = userMessage.toLowerCase()
    
    // Check if message has automation intent - basic heuristic
    const hasAutomationIntent = /\b(automate|automation|workflow|create|make|build|setup|send|post|save|store|track|facebook|sheet|email)\b/i.test(userMessage)
    const isDescriptive = userMessage.split(' ').length >= 5 && (
      (lower.includes('facebook') && lower.includes('save')) ||
      (lower.includes('sheet') && lower.includes('save')) ||
      (lower.includes('email') && lower.includes('send'))
    )
    
    // Context-aware fallback responses
    let responseText = ""
    if (lower.includes('hello') || lower.includes('hi') || lower.includes('hey') || lower === 'test') {
      responseText = "Hi there! 👋 I'm here to help you build automation workflows. What would you like to automate? For example: 'I want to save Facebook comments to Google Sheets' or 'Automate email replies'."
    } else if (lower.includes('fb') || lower.includes('facebook')) {
      if (lower.includes('comment') || lower.includes('reply')) {
        responseText = "Great! I can help you automate Facebook comments. Are you looking to reply to comments automatically, save them to a spreadsheet, or both?"
      } else if (lower.includes('dm') || lower.includes('direct message')) {
        responseText = "Facebook direct messages! I can help you automate those. What should happen when you receive a DM? Should they be saved somewhere or trigger an action?"
      } else {
        responseText = "Facebook automation sounds great! What specifically would you like to automate with Facebook? Comments, messages, posts?"
      }
    } else if (lower.includes('sheet') || lower.includes('google')) {
      responseText = "Google Sheets automation! I can help you save data to spreadsheets. What data would you like to save and what should trigger it?"
    } else if (lower.includes('email')) {
      responseText = "Email automation is very useful! What should trigger the emails, and what should they contain?"
    } else {
      responseText = "I'm ready to help you build automation workflows! Describe what you'd like to automate - for example: 'Save Facebook comments to Google Sheets' or 'Send email when I get a new lead'. I'll help you build it!"
    }
    
    // Return object format for consistency
    // Check if this is a modification request
    const isModificationRequest = /\b(remove|delete|change|update|modify|add|insert)\b/i.test(userMessage) && 
                          (context.workflow || (context.nodes && context.nodes.length > 0))
    
    return {
      text: responseText,
      shouldGenerateWorkflow: isDescriptive && hasAutomationIntent && context.collectingInfo && !isModificationRequest,
      shouldModifyWorkflow: isModificationRequest,
      modificationType: isModificationRequest ? (lower.includes('remove') || lower.includes('delete') ? 'remove' : 
                                          lower.includes('add') || lower.includes('insert') ? 'add' : 'update') : null,
      targetStep: isModificationRequest ? extractStepName(userMessage, context.workflow) : null
    }
  }

  try {
    const OpenAI = (await import('openai')).default
    const openai = new OpenAI({
      apiKey: OPENAI_API_KEY,
      dangerouslyAllowBrowser: true
    })

    // Build workflow context string
    let workflowContext = ""
    if (context.workflow || (context.nodes && context.nodes.length > 0)) {
      const wf = context.workflow || {}
      const nodes = context.nodes || []
      
      // Build description from workflow summary if available
      if (wf.name || wf.trigger || wf.steps || wf.notes) {
        workflowContext = `\n\n=== CURRENT WORKFLOW INFORMATION ===
WORKFLOW NAME: "${wf.name || 'Unnamed workflow'}"
TRIGGER: ${wf.trigger || 'Not set'}
STEPS IN ORDER: ${wf.steps && wf.steps.length > 0 ? wf.steps.join(' → ') : 'No steps yet'}
INTEGRATIONS USED: ${wf.integrations && wf.integrations.length > 0 ? wf.integrations.join(', ') : 'None'}
${wf.notes ? `FULL DESCRIPTION/NOTES: ${wf.notes}` : ''}
SOURCE: ${wf.source || 'unknown'}

IMPORTANT: Use the information above to answer questions about what the workflow does. The "FULL DESCRIPTION/NOTES" field contains the most detailed explanation of what this workflow is designed to do. If it mentions a template (like "F&B Menu Daily Update"), that's what the workflow is about.`
      }
      
      // Also include node information if available
      if (nodes.length > 0) {
        const nodeDescriptions = nodes.map((node, idx) => {
          const label = node.data?.label || node.label || 'Untitled'
          const kind = node.data?.kind || node.type || 'unknown'
          return `  ${idx + 1}. ${label} (type: ${kind})`
        }).join('\n')
        
        workflowContext += `\n\nCURRENT WORKFLOW NODES (${nodes.length} total nodes):\n${nodeDescriptions}`
      }
      
      workflowContext += `\n\n=== INSTRUCTIONS ===
When users ask about their workflow (e.g., "What does my workflow do?", "Check my workflow", "What is this workflow for?"), you MUST:
1. Read the WORKFLOW NAME and FULL DESCRIPTION/NOTES fields carefully
2. Describe what the workflow actually does based on that information
3. Explain the trigger and steps based on what's listed above
4. DO NOT make up or guess what the workflow does - use ONLY the information provided
5. If the description mentions updating menus and posting to social media, that's what it does. If it mentions something else, describe that.

When users want to MODIFY their workflow (e.g., "remove [step name]", "delete [step name]", "change [step name]", "update [step name]"):
1. Set "shouldModifyWorkflow": true
2. Set "modificationType": "remove", "update", "add", or "change"
3. Set "targetStep": the exact step name from the STEPS IN ORDER list (or close match)
4. Keep the workflow structure intact - only modify the specific requested step
5. DO NOT generate a completely new workflow - modify the existing one`
    }

    // Build conversation history for context
    const messages = [
      {
        role: "system",
        content: `You are the AI assistant for a workflow automation platform. You ARE the automation tool itself - you build workflows directly in this application.

Your job is to:
1. Have natural, conversational interactions with users
2. Help users describe what they want to automate
3. Ask clarifying questions to gather requirements for building workflows HERE in this platform
4. Guide users to describe their automation needs - YOU are an intelligent agent that decides when enough information has been gathered
5. Answer questions about existing workflows - you can SEE what they've built!
6. Be enthusiastic, helpful, and concise

CRITICAL CONTEXT:
- You ARE the automation platform - users are using YOU to build automations
- DO NOT mention other automation tools like Zapier, Integromat, Make, n8n, or any other platforms
- DO NOT ask which tool they want to use - they are already using this platform
- When users describe automations, you BUILD them directly in this application
- Focus on understanding WHAT they want to automate (triggers, actions, platforms like Facebook, Google Sheets, etc.)
- After gathering details, workflows are automatically generated and displayed in the interface${workflowContext}

WORKFLOW GENERATION DECISION:
- YOU decide when enough information has been gathered to generate a workflow
- Set "shouldGenerateWorkflow": true when:
  * User has provided a clear automation intent with sufficient detail (e.g., "save Facebook comments to Google Sheets", "automate email replies when someone mentions price")
  * You've asked clarifying questions and received answers
  * The user's message clearly describes what they want to automate with trigger + action
- Set "shouldGenerateWorkflow": false when:
  * User is just chatting or asking questions
  * More information is needed to build the workflow
  * User is asking about existing workflows
  * The message is too vague or incomplete

${context.collectingInfo ? "Note: The user has mentioned automation needs. Ask clarifying questions if needed, but once you have enough information (trigger + action + platform), set shouldGenerateWorkflow to true." : "Note: The user is chatting with you. If they ask about their workflow, use the workflow information provided above to answer. If they're describing new automation needs, help guide them and decide when enough info is gathered."}

IMPORTANT: 
- Always guide users toward describing automations to build HERE in this platform
- Never mention or recommend other automation tools
- If users ask about their existing workflow (e.g., "What does my workflow do?", "Check my workflow"), you can see it in the context above - describe it to them!
- If they just say "Hi" or "Test", respond warmly and ask what automation they'd like to build
- If they mention Facebook, Sheets, emails, etc., help them describe the workflow so you can build it

RESPONSE FORMAT:
You MUST respond with valid JSON in this format:
{
  "text": "Your conversational response to the user",
  "shouldGenerateWorkflow": true or false (your decision based on whether enough info was gathered),
  "shouldModifyWorkflow": true or false (set to true if user wants to modify existing workflow),
  "modificationType": "remove" | "update" | "add" | "change" | null (only if shouldModifyWorkflow is true),
  "targetStep": "step name to modify" | null (only if shouldModifyWorkflow is true)
}

Keep your text response conversational, friendly, and under 3-4 sentences. Don't be overly formal.`
      },
      ...conversationHistory.slice(-6).map(msg => ({
        role: msg.role === 'user' ? 'user' : 'assistant',
        content: msg.text
      })),
      {
        role: "user",
        content: userMessage
      }
    ]

    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: messages,
      temperature: 0.8,
      max_tokens: 300,
      response_format: { type: "json_object" }
    })

    try {
      const response = JSON.parse(completion.choices[0].message.content)
      
      // Check if this is a modification request
      const isModificationRequest = response.shouldModifyWorkflow === true || 
                            /\b(remove|delete|change|update|modify|add|insert)\b/i.test(userMessage) && 
                            (context.workflow || (context.nodes && context.nodes.length > 0))
      
      return {
        text: response.text || response.message || response.response || "I'm here to help you build automation workflows!",
        shouldGenerateWorkflow: (response.shouldGenerateWorkflow === true || response.generateWorkflow === true) && !isModificationRequest,
        shouldModifyWorkflow: isModificationRequest,
        modificationType: response.modificationType || (isModificationRequest ? 
          (userMessage.toLowerCase().includes('remove') || userMessage.toLowerCase().includes('delete') ? 'remove' :
           userMessage.toLowerCase().includes('add') || userMessage.toLowerCase().includes('insert') ? 'add' : 'update') : null),
        targetStep: response.targetStep || (isModificationRequest ? extractStepName(userMessage, context.workflow) : null)
      }
    } catch (e) {
      // Fallback if response isn't valid JSON
      const text = completion.choices[0].message.content.trim()
      // Analyze if we should generate - if response is short acknowledgment after collecting info, likely should generate
      const shouldGenerate = context.collectingInfo && text.length < 150 && (
        text.toLowerCase().includes("all set") || 
        text.toLowerCase().includes("got it") ||
        text.toLowerCase().includes("perfect") ||
        text.toLowerCase().includes("great")
      )
      
      // Check if this is a modification request
      const isModificationRequest = /\b(remove|delete|change|update|modify|add|insert)\b/i.test(userMessage) && 
                            (context.workflow || (context.nodes && context.nodes.length > 0))
      
      return { 
        text, 
        shouldGenerateWorkflow: shouldGenerate && !isModificationRequest,
        shouldModifyWorkflow: isModificationRequest,
        modificationType: isModificationRequest ? 
          (userMessage.toLowerCase().includes('remove') || userMessage.toLowerCase().includes('delete') ? 'remove' :
           userMessage.toLowerCase().includes('add') || userMessage.toLowerCase().includes('insert') ? 'add' : 'update') : null,
        targetStep: isModificationRequest ? extractStepName(userMessage, context.workflow) : null
      }
    }
  } catch (error) {
    console.error("OpenAI conversational error:", error)
    // If API call fails, provide a helpful error message
    if (error.message?.includes('401') || error.message?.includes('Unauthorized')) {
      return {
        text: "I'm having trouble connecting to OpenAI. Please check that your API key is valid. You can still create workflows by describing what you'd like to automate - I'll use the basic mode to help you!",
        shouldGenerateWorkflow: false
      }
    }
    if (error.message?.includes('429') || error.message?.includes('rate limit')) {
      return {
        text: "OpenAI API rate limit reached. Please try again in a moment. You can still describe your automation needs and I'll help you build workflows!",
        shouldGenerateWorkflow: false
      }
    }
    // Generic error - still try to be helpful
    return {
      text: "I encountered an issue connecting to OpenAI, but I'm still here to help! Can you tell me more about the automation workflow you'd like to create?",
      shouldGenerateWorkflow: false
    }
  }
}

/**
 * Generate workflow from user intent using OpenAI
 * @param {string} userIntent - User's description of the workflow
 * @returns {Promise<import('../types').WorkflowSummary>} Generated workflow summary
 */
export async function generateWorkflowFromIntent(userIntent) {
  const { OPENAI_API_KEY } = await import('./config')
  
  // If no API key, use mock implementation
  if (!OPENAI_API_KEY || !OPENAI_API_KEY.trim()) {
    await delay(1000)
    return generateMockWorkflow(userIntent)
  }

  try {
    const OpenAI = (await import('openai')).default
    const openai = new OpenAI({
      apiKey: OPENAI_API_KEY,
      dangerouslyAllowBrowser: true // Note: In production, calls should go through your backend
    })

    // Check if intent matches any template
    const templates = (await import('../data/templates')).templates
    const matchedTemplate = templates.find(t => {
      const templateLower = t.sampleIntent.toLowerCase()
      const intentLower = userIntent.toLowerCase()
      const templateNameLower = t.name.toLowerCase()
      const templateDescLower = t.description.toLowerCase()
      
      // Check multiple matching strategies
      // 1. Direct name match
      if (intentLower.includes(templateNameLower)) return true
      
      // 2. Key phrase matching from sample intent (look for significant words)
      const keyPhrases = templateLower.split(' ').filter(word => word.length > 3)
      const matchingPhrases = keyPhrases.filter(phrase => intentLower.includes(phrase))
      if (matchingPhrases.length >= 2) return true // At least 2 key phrases match
      
      // 3. Description-based matching (for industry-specific terms)
      const industryKeywords = {
        "fb-menu-daily-update": ["menu", "daily", "update", "special", "post", "social"],
        "retail-inventory-alert": ["inventory", "stock", "alert", "drop", "below", "threshold"],
        "re-estate-lead-nurture": ["lead", "form", "submit", "crm", "nurture", "welcome"],
        "education-homework-reminder": ["homework", "assignment", "remind", "due", "student", "parent"],
        "healthcare-appointment-reminder": ["appointment", "patient", "remind", "24 hour", "clinic"],
        "va-social-scheduler": ["schedule", "social", "post", "9 am", "1 pm", "5 pm", "platform"],
        "generic-email-digest": ["weekly", "summary", "email", "digest", "monday", "metric"],
        "generic-expense-tracker": ["expense", "track", "report", "monthly", "1st", "categorize"]
      }
      
      const keywords = industryKeywords[t.id] || []
      if (keywords.some(keyword => intentLower.includes(keyword))) {
        // Verify it's not a false positive by checking if it matches other templates better
        const keywordMatches = keywords.filter(kw => intentLower.includes(kw)).length
        if (keywordMatches >= 2) return true
      }
      
      return false
    })

    // Generate template-specific instructions
    const getTemplateSpecificRules = (template) => {
      const rules = {
        "fb-menu-daily-update": `- Trigger: "Schedule (daily at 9 AM)"
- Steps: ["Load Menu Data", "Process Daily Updates", "Post to Social Media", "Send Confirmation"]
- Integrations: ["F&B", "Facebook", "Instagram"]`,
        "retail-inventory-alert": `- Trigger: "Schedule (check hourly)" or "Schedule (daily)"
- Steps: ["Check Inventory Levels", "Compare Against Threshold", "Send Alert Notification", "Log Alert"]
- Integrations: ["Inventory System", "Email", "SMS"]`,
        "re-estate-lead-nurture": `- Trigger: "Webhook (form submission)" or "Manual trigger"
- Steps: ["Capture Lead Data", "Validate Information", "Add to CRM", "Send Welcome Email"]
- Integrations: ["CRM", "Email", "Webhook"]`,
        "education-homework-reminder": `- Trigger: "Schedule (daily check)" or "Schedule (specific times)"
- Steps: ["Check Assignment Due Dates", "Filter Upcoming Assignments", "Send Reminder to Students", "Send Reminder to Parents", "Log Sent Reminders"]
- Integrations: ["Education System", "Email", "SMS"]`,
        "healthcare-appointment-reminder": `- Trigger: "Schedule (daily check)" or "Schedule (hourly)"
- Steps: ["Check Upcoming Appointments", "Filter 24-Hour Appointments", "Send SMS Reminder", "Send Email Reminder", "Log Sent Reminders"]
- Integrations: ["Healthcare System", "SMS", "Email"]`,
        "va-social-scheduler": `- Trigger: "Schedule (daily at 9 AM, 1 PM, 5 PM)" or "Schedule (custom times)"
- Steps: ["Load Scheduled Posts", "Format Content for Platform", "Post to Facebook", "Post to Instagram", "Post to Twitter", "Post to LinkedIn", "Log Results"]
- Integrations: ["Social Media", "Facebook", "Instagram", "Twitter", "LinkedIn"]`,
        "generic-email-digest": `- Trigger: "Schedule (weekly on Monday)" or "Schedule (daily)"
- Steps: ["Collect Data from Sources", "Aggregate Metrics", "Format Email Content", "Send Weekly Digest", "Log Sent Email"]
- Integrations: ["Analytics", "CRM", "Email"]`,
        "generic-expense-tracker": `- Trigger: "Schedule (monthly on 1st)" or "Schedule (daily)"
- Steps: ["Collect Expense Data", "Categorize Expenses", "Calculate Totals", "Generate Report", "Send Monthly Report", "Save to Spreadsheet"]
- Integrations: ["Banking", "Google Sheets", "Email"]`
      }
      return rules[template.id] || ""
    }

    const systemPrompt = matchedTemplate 
      ? `You are a workflow automation assistant. Generate a comprehensive, multi-step workflow based on user descriptions.

TEMPLATE CONTEXT: The user's intent matches the "${matchedTemplate.name}" template which: ${matchedTemplate.description}

${getTemplateSpecificRules(matchedTemplate)}

IMPORTANT CONTEXT:
- "fb" or "facebook" refers to Facebook
- "dm" or "direct message" in context of Facebook means Facebook Messenger
- "send direct messages" about Facebook = Facebook DM action
- "save to google sheets" or "google sheets" = Google Sheets appendRow action
- "reply to comments" about Facebook = Facebook comment reply action
- "fb comments to reply" = Facebook comment trigger + reply action
- "menu update" or "daily menu" = Load Menu Data → Process Updates → Post to Social Media
- "post to social media" = Post to Facebook/Instagram/LinkedIn
- "schedule" or "scheduled" = Use scheduler/cron trigger
- Complex workflows should have MULTIPLE steps (at least 3-4 steps for automation workflows)

Return ONLY a valid JSON object with this structure:
{
  "name": "Descriptive workflow name",
  "trigger": "Trigger description (e.g., 'Facebook Comment', 'Schedule (daily at 9 AM)', 'Manual trigger', 'Webhook')",
  "steps": ["Step 1", "Step 2", "Step 3", "Step 4"],
  "integrations": ["Integration1", "Integration2"],
  "source": "chat"
}

Rules:
- Generate COMPREHENSIVE workflows with multiple steps (3-5 steps typical, up to 7 for complex workflows)
- Follow the template-specific structure above for the matched template
- Make steps specific and actionable
- NEVER create workflows with only 1 step - always create meaningful multi-step workflows
- Return ONLY the JSON, no markdown or explanations.`
      : `You are a workflow automation assistant. Generate a comprehensive, multi-step workflow based on user descriptions. 

IMPORTANT CONTEXT:
- "fb" or "facebook" refers to Facebook
- "dm" or "direct message" in context of Facebook means Facebook Messenger
- "send direct messages" about Facebook = Facebook DM action
- "save to google sheets" or "google sheets" = Google Sheets appendRow action
- "reply to comments" about Facebook = Facebook comment reply action
- "fb comments to reply" = Facebook comment trigger + reply action
- "menu update" or "daily menu" = Load Menu Data → Process Updates → Post to Social Media
- "post to social media" = Post to Facebook/Instagram/LinkedIn
- "schedule" or "scheduled" = Use scheduler/cron trigger
- Complex workflows should have MULTIPLE steps (at least 3-4 steps for automation workflows)

Return ONLY a valid JSON object with this structure:
{
  "name": "Descriptive workflow name",
  "trigger": "Trigger description (e.g., 'Facebook Comment', 'Schedule (daily at 9 AM)', 'Manual trigger', 'Webhook')",
  "steps": ["Step 1", "Step 2", "Step 3", "Step 4"],
  "integrations": ["Integration1", "Integration2"],
  "source": "chat"
}

Rules:
- Generate COMPREHENSIVE workflows with multiple steps (3-5 steps typical)
- For menu/food updates: ["Load Menu Data", "Process Daily Updates", "Post to Social Media", "Send Confirmation"]
- For social media scheduling: ["Load Scheduled Posts", "Format Content", "Post to Multiple Platforms", "Log Results"]
- For lead management: ["Capture Lead Data", "Validate Information", "Add to CRM", "Send Welcome Email"]
- If user mentions Facebook comments, trigger should be "Facebook Comment"
- If user mentions replying to Facebook comments, include "Facebook Reply" in steps
- If user mentions sending direct messages (DMs) on Facebook, include "Facebook DM" in steps
- If user mentions saving to Google Sheets, include "Add to Google Sheets" in steps
- If user mentions posting/scheduling, include social media posting steps
- Make steps specific and actionable (e.g., "Load Menu Data", "Process Daily Updates", "Post to Facebook", "Send Confirmation Email")
- NEVER create workflows with only 1 step - always create meaningful multi-step workflows
- Return ONLY the JSON, no markdown or explanations.`

    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: systemPrompt
        },
        {
          role: "user",
          content: userIntent
        }
      ],
      temperature: 0.7,
      response_format: { type: "json_object" }
    })

    const responseText = completion.choices[0].message.content
    // Parse JSON response
    let workflow
    try {
      workflow = JSON.parse(responseText)
    } catch (e) {
      // Fallback: try to extract JSON from markdown code blocks
      const jsonMatch = responseText.match(/\{[\s\S]*\}/)
      workflow = jsonMatch ? JSON.parse(jsonMatch[0]) : { name: "New Workflow", trigger: "Manual trigger", steps: [], integrations: [] }
    }
    
    // Ensure steps is an array with at least 2 items (unless it's a very simple workflow)
    if (!workflow.steps || workflow.steps.length === 0) {
      workflow.steps = ["Process Data", "Execute Action"]
    } else if (workflow.steps.length === 1 && !userIntent.toLowerCase().includes('simple') && !userIntent.toLowerCase().includes('basic')) {
      // If only 1 step, expand it based on the workflow name/intent or matched template
      const step = workflow.steps[0]
      const lowerIntent = userIntent.toLowerCase()
      const lowerName = workflow.name.toLowerCase()
      
      if (matchedTemplate) {
        // Use template-specific expansion
        const templateExpansions = {
          "fb-menu-daily-update": ["Load Menu Data", "Process Daily Updates", "Post to Social Media", "Send Confirmation"],
          "retail-inventory-alert": ["Check Inventory Levels", "Compare Against Threshold", "Send Alert Notification", "Log Alert"],
          "re-estate-lead-nurture": ["Capture Lead Data", "Validate Information", "Add to CRM", "Send Welcome Email"],
          "education-homework-reminder": ["Check Assignment Due Dates", "Filter Upcoming Assignments", "Send Reminder to Students", "Send Reminder to Parents", "Log Sent Reminders"],
          "healthcare-appointment-reminder": ["Check Upcoming Appointments", "Filter 24-Hour Appointments", "Send SMS Reminder", "Send Email Reminder", "Log Sent Reminders"],
          "va-social-scheduler": ["Load Scheduled Posts", "Format Content for Platform", "Post to Facebook", "Post to Instagram", "Post to Twitter", "Post to LinkedIn", "Log Results"],
          "generic-email-digest": ["Collect Data from Sources", "Aggregate Metrics", "Format Email Content", "Send Weekly Digest", "Log Sent Email"],
          "generic-expense-tracker": ["Collect Expense Data", "Categorize Expenses", "Calculate Totals", "Generate Report", "Send Monthly Report", "Save to Spreadsheet"]
        }
        workflow.steps = templateExpansions[matchedTemplate.id] || workflow.steps
      } else if (lowerName.includes('menu') || lowerIntent.includes('menu')) {
        workflow.steps = ["Load Menu Data", "Process Daily Updates", "Post to Social Media", "Send Confirmation"]
      } else if (lowerName.includes('inventory') || lowerIntent.includes('stock') || lowerIntent.includes('inventory')) {
        workflow.steps = ["Check Inventory Levels", "Compare Against Threshold", "Send Alert Notification", "Log Alert"]
      } else if (lowerName.includes('lead') || lowerIntent.includes('lead')) {
        workflow.steps = ["Capture Lead Data", "Validate Information", "Add to CRM", "Send Welcome Email"]
      } else if (lowerName.includes('homework') || lowerName.includes('assignment') || lowerIntent.includes('homework') || lowerIntent.includes('assignment')) {
        workflow.steps = ["Check Assignment Due Dates", "Filter Upcoming Assignments", "Send Reminder to Students", "Send Reminder to Parents", "Log Sent Reminders"]
      } else if (lowerName.includes('appointment') || lowerName.includes('patient') || lowerIntent.includes('appointment') || lowerIntent.includes('patient')) {
        workflow.steps = ["Check Upcoming Appointments", "Filter 24-Hour Appointments", "Send SMS Reminder", "Send Email Reminder", "Log Sent Reminders"]
      } else if (lowerName.includes('social') || lowerIntent.includes('post') || lowerIntent.includes('social') || lowerIntent.includes('schedule')) {
        workflow.steps = ["Load Scheduled Posts", "Format Content for Platform", "Post to Social Media", "Log Results"]
      } else if (lowerName.includes('digest') || lowerName.includes('summary') || lowerIntent.includes('weekly') || lowerIntent.includes('digest')) {
        workflow.steps = ["Collect Data from Sources", "Aggregate Metrics", "Format Email Content", "Send Weekly Digest", "Log Sent Email"]
      } else if (lowerName.includes('expense') || lowerIntent.includes('expense') || lowerIntent.includes('track')) {
        workflow.steps = ["Collect Expense Data", "Categorize Expenses", "Calculate Totals", "Generate Report", "Send Monthly Report"]
      } else {
        workflow.steps = [step, "Process Information", "Execute Action", "Send Notification"]
      }
    }
    
    return {
      ...workflow,
      notes: `Generated from: "${userIntent}"`,
    }
  } catch (error) {
    console.error("OpenAI error:", error)
    // Fallback to mock
    return generateMockWorkflow(userIntent)
  }
}

/**
 * Generate a mock workflow (fallback when OpenAI is not available)
 * @param {string} intent - User intent
 * @returns {import('../types').WorkflowSummary} Mock workflow
 */
function generateMockWorkflow(intent) {
  const lowerIntent = intent.toLowerCase()
  
  let trigger = "Manual Trigger"
  let steps = []
  let integrations = []

  // Template 1: F&B Menu Daily Update
  const hasMenu = lowerIntent.includes("menu") || lowerIntent.includes("daily update")
  const hasUpdate = lowerIntent.includes("update") || lowerIntent.includes("special")
  const hasPost = lowerIntent.includes("post") || lowerIntent.includes("social") || lowerIntent.includes("instagram") || lowerIntent.includes("facebook")
  
  if (hasMenu && (hasUpdate || hasPost)) {
    trigger = "Schedule (daily at 9 AM)"
    steps = ["Load Menu Data", "Process Daily Updates", "Post to Social Media", "Send Confirmation"]
    integrations.push("F&B")
    if (lowerIntent.includes("facebook") || lowerIntent.includes("instagram")) {
      integrations.push("Facebook")
    }
    if (lowerIntent.includes("sheet") || lowerIntent.includes("google")) {
      steps.splice(2, 0, "Save to Google Sheets")
      integrations.push("Google Sheets")
    }
  }
  // Template 2: Retail Inventory Low Stock Alert
  else if (lowerIntent.includes("inventory") || (lowerIntent.includes("stock") && lowerIntent.includes("alert")) || (lowerIntent.includes("stock") && lowerIntent.includes("drop"))) {
    trigger = "Schedule (check hourly)"
    steps = ["Check Inventory Levels", "Compare Against Threshold", "Send Alert Notification", "Log Alert"]
    integrations.push("Inventory System")
    if (lowerIntent.includes("email")) integrations.push("Email")
    if (lowerIntent.includes("sms")) integrations.push("SMS")
    if (!integrations.includes("Email") && !integrations.includes("SMS")) {
      integrations.push("Email", "SMS")
    }
  }
  // Template 3: Real Estate Lead Nurturing
  else if (lowerIntent.includes("lead") || (lowerIntent.includes("capture") && lowerIntent.includes("form")) || (lowerIntent.includes("form") && lowerIntent.includes("submit"))) {
    trigger = "Webhook (form submission)"
    steps = ["Capture Lead Data", "Validate Information", "Add to CRM", "Send Welcome Email"]
    integrations.push("CRM")
    integrations.push("Email")
  }
  // Template 4: Education Homework Reminder
  else if ((lowerIntent.includes("homework") || lowerIntent.includes("assignment")) && (lowerIntent.includes("remind") || lowerIntent.includes("due"))) {
    trigger = "Schedule (daily check)"
    steps = ["Check Assignment Due Dates", "Filter Upcoming Assignments", "Send Reminder to Students", "Send Reminder to Parents", "Log Sent Reminders"]
    integrations.push("Education System")
    integrations.push("Email")
    if (lowerIntent.includes("sms")) integrations.push("SMS")
  }
  // Template 5: Healthcare Appointment Reminder
  else if ((lowerIntent.includes("appointment") || lowerIntent.includes("patient")) && (lowerIntent.includes("remind") || lowerIntent.includes("24 hour"))) {
    trigger = "Schedule (daily check)"
    steps = ["Check Upcoming Appointments", "Filter 24-Hour Appointments", "Send SMS Reminder", "Send Email Reminder", "Log Sent Reminders"]
    integrations.push("Healthcare System")
    integrations.push("SMS")
    integrations.push("Email")
  }
  // Template 6: VA Social Media Scheduler
  else if (lowerIntent.includes("schedule") && (lowerIntent.includes("social") || lowerIntent.includes("post")) && (lowerIntent.includes("9 am") || lowerIntent.includes("1 pm") || lowerIntent.includes("5 pm") || lowerIntent.includes("platform"))) {
    trigger = "Schedule (daily at 9 AM, 1 PM, 5 PM)"
    steps = ["Load Scheduled Posts", "Format Content for Platform", "Post to Facebook", "Post to Instagram", "Post to Twitter", "Post to LinkedIn", "Log Results"]
    integrations.push("Social Media")
    integrations.push("Facebook")
    integrations.push("Instagram")
    if (lowerIntent.includes("twitter")) integrations.push("Twitter")
    if (lowerIntent.includes("linkedin")) integrations.push("LinkedIn")
  }
  // Template 7: Weekly Email Digest
  else if ((lowerIntent.includes("weekly") || lowerIntent.includes("summary")) && (lowerIntent.includes("email") || lowerIntent.includes("digest") || lowerIntent.includes("monday"))) {
    trigger = "Schedule (weekly on Monday)"
    steps = ["Collect Data from Sources", "Aggregate Metrics", "Format Email Content", "Send Weekly Digest", "Log Sent Email"]
    integrations.push("Analytics")
    integrations.push("CRM")
    integrations.push("Email")
  }
  // Template 8: Expense Report Tracker
  else if ((lowerIntent.includes("expense") || lowerIntent.includes("track")) && (lowerIntent.includes("report") || lowerIntent.includes("monthly") || lowerIntent.includes("1st"))) {
    trigger = "Schedule (monthly on 1st)"
    steps = ["Collect Expense Data", "Categorize Expenses", "Calculate Totals", "Generate Report", "Send Monthly Report", "Save to Spreadsheet"]
    integrations.push("Banking")
    integrations.push("Google Sheets")
    integrations.push("Email")
  }
  // If no template pattern matched, try generic patterns
  if (steps.length === 0) {
    // Parse Facebook context - improved detection
    const hasFacebook = lowerIntent.includes("fb") || lowerIntent.includes("facebook")
    const hasComment = lowerIntent.includes("comment") || lowerIntent.includes("reply")
    const hasDM = lowerIntent.includes("dm") || lowerIntent.includes("direct message")
    const hasSheets = lowerIntent.includes("sheet") || lowerIntent.includes("google")
    const hasSave = lowerIntent.includes("save") || lowerIntent.includes("store") || lowerIntent.includes("track")

    // Facebook comment + save to sheets (e.g., "save fb comments to sheets")
    if (hasFacebook && hasComment && hasSheets && hasSave) {
      trigger = "Facebook Comment (with keyword)"
      steps = ["Facebook Reply to Comment", "Add Row to Google Sheets", "Send Confirmation"]
      integrations.push("Facebook")
      integrations.push("Google Sheets")
    }
    // Facebook comment + reply workflow
    else if (hasFacebook && hasComment) {
      trigger = "Facebook Comment (with keyword)"
      steps = ["Facebook Reply to Comment", "Log Response"]
      integrations.push("Facebook")
      
      if (hasSheets || hasSave) {
        steps.splice(1, 0, "Add Row to Google Sheets")
        integrations.push("Google Sheets")
      }
    }
    // Facebook DM + save to sheets
    else if (hasFacebook && hasDM && hasSheets && hasSave) {
      trigger = "Manual Trigger"
      steps = ["Capture Facebook DM", "Add Row to Google Sheets", "Send Confirmation"]
      integrations.push("Facebook")
      integrations.push("Google Sheets")
    }
    // Facebook DM workflow
    else if (hasFacebook && hasDM) {
      trigger = "Manual Trigger"
      steps = ["Send Facebook DM", "Log Message"]
      integrations.push("Facebook")
      
      if (hasSheets || hasSave) {
        steps.splice(1, 0, "Add Row to Google Sheets")
        integrations.push("Google Sheets")
      }
    }
    // Just sheets with save
    else if (hasSheets && hasSave) {
      steps = ["Process Data", "Add Row to Google Sheets", "Send Confirmation"]
      integrations.push("Google Sheets")
    }
    // Just sheets
    else if (hasSheets) {
      steps = ["Load Data", "Add Row to Google Sheets"]
      integrations.push("Google Sheets")
    }
    // Parse email context
    else if (lowerIntent.includes("email")) {
      trigger = "Manual Trigger or Schedule"
      steps = ["Prepare Email Content", "Send Email", "Log Sent Email"]
      integrations.push("Email")
    }
    // Default workflow - ensure multiple steps
    else {
      steps = ["Process Information", "Execute Action", "Log Results", "Send Notification"]
    }
  }

  // Set default integration if none
  if (integrations.length === 0) {
    integrations.push("Generic")
  }

  // Generate name from intent
  const words = intent.split(" ").slice(0, 6)
  const name = words
    .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(" ")
    .trim()

  return {
    name: name || "New Workflow",
    trigger: trigger,
    steps: steps,
    integrations: integrations,
    notes: `Generated from: "${intent}"`,
    source: "chat"
  }
}
