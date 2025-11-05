import { useState, useEffect, useRef } from "react"
import { useNavigate } from "react-router-dom"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { useSetWorkflow, useSetFlow, useNodes, useEdges, useWorkflowSummary } from "@/store/app"
import { WorkflowPreview } from "@/components/WorkflowPreview"
import { convertWorkflowToFlow } from "@/components/WorkflowBuilder"
import { generateWorkflowFromIntent, getConversationalResponse, modifyWorkflow } from "@/lib/api"
import { isOpenAIAvailable } from "@/lib/config"

// Helper function to append new nodes to existing workflow
function chainAppend(existingNodes, existingEdges, newNodes, newEdges) {
  if (existingNodes.length === 0) {
    return { nodes: newNodes, edges: newEdges }
  }
  const lastExisting = existingNodes[existingNodes.length - 1]
  // Offset new nodes to the right of the last existing
  const baseX = (lastExisting?.position?.x ?? 100) + 300
  const baseY = lastExisting?.position?.y ?? 100
  const adjusted = newNodes.map((n, i) => ({
    ...n,
    position: { x: baseX + i * 250, y: baseY },
  }))

  const link = {
    id: `edge_${lastExisting.id}_${adjusted[0].id}_${Date.now()}`,
    source: lastExisting.id,
    target: adjusted[0].id,
    type: 'default',
    animated: false,
    data: { label: '' },
  }

  return {
    nodes: [...existingNodes, ...adjusted],
    edges: [...existingEdges, link, ...newEdges],
  }
}

export function Chat() {
  const navigate = useNavigate()
  const setWorkflow = useSetWorkflow()
  const setFlow = useSetFlow()
  const existingNodes = useNodes()
  const existingEdges = useEdges()
  const workflowSummary = useWorkflowSummary()

  const [messages, setMessages] = useState([
    {
      id: 1,
      text: "Hello! I'm your AI workflow automation assistant. I'll help you build custom automation workflows. What would you like to automate?",
      role: "assistant",
      timestamp: new Date(),
    }
  ])
  const [input, setInput] = useState("")
  const [workflow, setLocalWorkflow] = useState(null)
  const [isGenerating, setIsGenerating] = useState(false)
  const [conversationContext, setConversationContext] = useState({
    collectingInfo: false,
    intent: "",
    details: []
  })
  const [openAIConnected, setOpenAIConnected] = useState(false)
  const pendingResponseRef = useRef(false)

  // Check OpenAI connection status
  useEffect(() => {
    setOpenAIConnected(isOpenAIAvailable())
  }, [])

  const handleSend = async (e) => {
    e.preventDefault()
    if (!input.trim() || isGenerating || pendingResponseRef.current) return

    const userMessage = input.trim()

    // Add user message
    const newUserMessage = {
      id: Date.now(),
      text: userMessage,
      role: "user",
      timestamp: new Date(),
    } 

    setMessages(prev => [...prev, newUserMessage])
    setInput("")
    pendingResponseRef.current = true

    // Check if we already have a workflow - if so, handle conversation differently
    setConversationContext(prevContext => {
      // CRITICAL: Check if we're collecting info FIRST, before checking for workflow
      // This ensures follow-up messages are treated as details, not new intents
      if (prevContext.collectingInfo) {
        const updatedDetails = [...prevContext.details, userMessage]
        
        // After 1 detail, generate workflow immediately
        // Generate workflow asynchronously
        setTimeout(async () => {
          const combinedIntent = prevContext.intent + " " + updatedDetails.join(" ")
          await generateAndShowWorkflow(combinedIntent)
          // Reset context after generation
          setConversationContext({
            collectingInfo: false,
            intent: "",
            details: []
          })
        }, 300)
        
        // Return current context, will be reset after generation
        return prevContext
      }

      // If a workflow already exists, handle post-generation conversation with AI
      const currentWorkflow = workflow || workflowSummary
      if (currentWorkflow || existingNodes.length > 0) {
        const lowerMessage = userMessage.toLowerCase()
        const wantsNewWorkflow = /\b(new|another|different|create|build|make|start over|reset|clear)\b/i.test(userMessage)
        
        if (wantsNewWorkflow) {
          // User wants to create a new workflow
          setLocalWorkflow(null)
          setTimeout(async () => {
            setMessages(currentMessages => {
              getConversationalResponse(userMessage, currentMessages, { workflow: null, nodes: [], edges: [] }).then(aiText => {
                setMessages(prev => {
                  if (!pendingResponseRef.current) return prev
                  pendingResponseRef.current = false
                  return [...prev, {
                    id: Date.now() + 1,
                    text: aiText,
                    role: "assistant",
                    timestamp: new Date(),
                  }]
                })
              })
              return currentMessages
            })
          }, 300)
          return { collectingInfo: false, intent: "", details: [] }
        } else {
          // Continue conversation about existing workflow with AI
          setTimeout(async () => {
            setMessages(currentMessages => {
              getConversationalResponse(userMessage, currentMessages, { 
                workflow: currentWorkflow, 
                nodes: existingNodes,
                edges: existingEdges
              }).then(aiResponse => {
                setMessages(prev => {
                  if (!pendingResponseRef.current) return prev
                  pendingResponseRef.current = false
                  
                  const responseText = typeof aiResponse === 'string' ? aiResponse : aiResponse.text
                  const shouldModify = typeof aiResponse === 'object' ? aiResponse.shouldModifyWorkflow : false
                  
                  const aiMessage = {
                    id: Date.now() + 1,
                    text: responseText,
                    role: "assistant",
                    timestamp: new Date(),
                  }
                  
                  // Handle workflow modification
                  if (shouldModify && currentWorkflow && existingNodes.length > 0) {
                    const modificationType = aiResponse.modificationType
                    const targetStep = aiResponse.targetStep
                    
                    if (modificationType && targetStep) {
                      const modified = modifyWorkflow(
                        currentWorkflow, 
                        existingNodes, 
                        existingEdges, 
                        modificationType, 
                        targetStep, 
                        userMessage
                      )
                      
                      setFlow(modified.nodes, modified.edges)
                      setWorkflow(modified.workflow)
                      
                      console.log('✅ Workflow modified:', modificationType, targetStep)
                    }
                  }
                  
                  return [...prev, aiMessage]
                })
              })
              return currentMessages
            })
          }, 300)
          return prevContext
        }
      }

      // Check for automation intent - be very lenient
      const lowerMessage = userMessage.toLowerCase()
      const hasAutomationIntent = /\b(automate|automation|workflow|create|make|build|setup|set up|generate|send|post|update|alert|remind|scheduled|daily|weekly|when|if|reply|comment|fb|facebook|dm|direct message|sheet|google|email|telegram|want|need|save|store|track)\b/i.test(userMessage)
      
      // Also check for common automation patterns
      const hasAutomationPattern = 
        lowerMessage.includes('reply') || 
        lowerMessage.includes('comment') || 
        lowerMessage.includes('fb') ||
        lowerMessage.includes('facebook') ||
        lowerMessage.includes('dm') ||
        lowerMessage.includes('direct message') ||
        lowerMessage.includes('save') ||
        lowerMessage.includes('store') ||
        lowerMessage.includes('track') ||
        lowerMessage.includes('sheet') ||
        lowerMessage.includes('google') ||
        (lowerMessage.includes('want') && (lowerMessage.includes('to') || lowerMessage.includes('my'))) ||
        (lowerMessage.includes('need') && (lowerMessage.includes('to') || lowerMessage.includes('my')))

      // Check if message is descriptive enough to generate workflow immediately
      const isDescriptiveEnough = (
        // Facebook + Sheets + Save combination (e.g., "save fb comments to sheets", "save my fb comments to google sheets")
        ((lowerMessage.includes('facebook') || lowerMessage.includes('fb')) && 
         (lowerMessage.includes('sheet') || lowerMessage.includes('google')) &&
         (lowerMessage.includes('save') || lowerMessage.includes('store') || lowerMessage.includes('track')))
      ) || (
        // Facebook comment/reply with explicit action
        (lowerMessage.includes('facebook') || lowerMessage.includes('fb')) &&
        (lowerMessage.includes('comment') || lowerMessage.includes('reply')) &&
        (lowerMessage.includes('reply') || lowerMessage.includes('save') || lowerMessage.includes('store') || lowerMessage.includes('track'))
      ) || (
        // Facebook + DM + action
        (lowerMessage.includes('facebook') || lowerMessage.includes('fb')) &&
        (lowerMessage.includes('dm') || lowerMessage.includes('direct message')) &&
        (lowerMessage.includes('send') || lowerMessage.includes('save') || lowerMessage.includes('store'))
      ) || (
        // Sheets workflows with action verb and source
        (lowerMessage.includes('sheet') || lowerMessage.includes('google')) && 
        (lowerMessage.includes('save') || lowerMessage.includes('store') || lowerMessage.includes('track') || lowerMessage.includes('add') || lowerMessage.includes('update')) &&
        userMessage.split(' ').length >= 4
      ) || (
        // General automation with enough detail (6+ words with automation keywords)
        hasAutomationPattern && userMessage.split(' ').length >= 6
      )

      // If descriptive enough, generate workflow immediately
      if (isDescriptiveEnough && (hasAutomationIntent || hasAutomationPattern)) {
        // Generate workflow immediately - don't show AI response first
        setTimeout(async () => {
          await generateAndShowWorkflow(userMessage)
          setConversationContext({
            collectingInfo: false,
            intent: "",
            details: []
          })
        }, 300)
        // Return immediately without adding AI response
        return prevContext
      }

      // If has automation intent/pattern, automatically generate workflow if descriptive enough
      // Otherwise, use AI to gather more info
      if (hasAutomationIntent || hasAutomationPattern) {
        setTimeout(async () => {
          setMessages(currentMessages => {
            const currentWorkflow = workflow || workflowSummary
            getConversationalResponse(userMessage, currentMessages, { 
              collectingInfo: true,
              workflow: currentWorkflow,
              nodes: existingNodes,
              edges: existingEdges
            }).then(aiResponse => {
              setMessages(prev => {
                if (!pendingResponseRef.current) return prev
                pendingResponseRef.current = false
                
                // Handle both string (fallback) and object (new format) responses
                const responseText = typeof aiResponse === 'string' ? aiResponse : aiResponse.text
                const shouldGenerate = typeof aiResponse === 'object' ? aiResponse.shouldGenerateWorkflow : false
                const shouldModify = typeof aiResponse === 'object' ? aiResponse.shouldModifyWorkflow : false
                
                const aiMessage = {
                  id: Date.now() + 1,
                  text: responseText,
                  role: "assistant",
                  timestamp: new Date(),
                }
                
                // Handle workflow modification first
                const currentWorkflowForModify = workflow || workflowSummary
                if (shouldModify && currentWorkflowForModify && existingNodes.length > 0) {
                  const modificationType = aiResponse.modificationType
                  const targetStep = aiResponse.targetStep
                  
                  if (modificationType && targetStep) {
                    const modified = modifyWorkflow(
                      currentWorkflowForModify, 
                      existingNodes, 
                      existingEdges, 
                      modificationType, 
                      targetStep, 
                      userMessage
                    )
                    
                    setFlow(modified.nodes, modified.edges)
                    setWorkflow(modified.workflow)
                    
                    console.log('✅ Workflow modified:', modificationType, targetStep)
                  }
                  
                  return [...prev, aiMessage]
                }
              
              // If AI decided we should generate workflow, trigger it
              if (shouldGenerate) {
                  console.log('🤖 AI decided to generate workflow')
                  // First add the AI response
                  const updatedMessages = [...prev, aiMessage]
                  setMessages(updatedMessages)
                  
                  // Then build the workflow using the conversation history
                  setTimeout(async () => {
                    // Combine the conversation context to create the workflow intent
                    const conversationText = currentMessages
                      .filter(m => m.role === 'user')
                      .slice(-5) // Last 5 user messages for better context
                      .map(m => m.text || m.content || '')
                      .join(' ')
                    
                    const combinedIntent = conversationText || userMessage
                    console.log('📝 Generating workflow with intent:', combinedIntent)
                    try {
                      await generateAndShowWorkflow(combinedIntent)
                      console.log('✅ Workflow generation completed')
                      
                      // Reset context after generation
                      setConversationContext({
                        collectingInfo: false,
                        intent: "",
                        details: []
                      })
                    } catch (error) {
                      console.error('❌ Error generating workflow:', error)
                    }
                  }, 1000)
                  
                  // Return early to prevent adding the message twice
                  return prev
                } else {
                  // Normal response, just add it
                  return [...prev, aiMessage]
                }
              })
            })
            return currentMessages
          })
        }, 300)

        return {
          collectingInfo: true,
          intent: userMessage,
          details: []
        }
      }

      // For all other messages (greetings, casual chat), use AI to guide toward automation
      // AI will decide if workflow should be generated
      setTimeout(async () => {
        setMessages(currentMessages => {
          getConversationalResponse(userMessage, currentMessages, { 
            workflow: currentWorkflow || workflowSummary,
            nodes: existingNodes,
            edges: existingEdges
          }).then(aiResponse => {
            setMessages(prev => {
              if (!pendingResponseRef.current) return prev
              pendingResponseRef.current = false
              
              // Handle both string (fallback) and object (new format) responses
              const responseText = typeof aiResponse === 'string' ? aiResponse : aiResponse.text
              const shouldGenerate = typeof aiResponse === 'object' ? aiResponse.shouldGenerateWorkflow : false
              const shouldModify = typeof aiResponse === 'object' ? aiResponse.shouldModifyWorkflow : false
              
              const aiMessage = {
                id: Date.now() + 1,
                text: responseText,
                role: "assistant",
                timestamp: new Date(),
              }
              
              // Handle workflow modification first
              const currentWorkflowForModify = workflow || workflowSummary
              if (shouldModify && currentWorkflowForModify && existingNodes.length > 0) {
                const modificationType = aiResponse.modificationType
                const targetStep = aiResponse.targetStep
                
                if (modificationType && targetStep) {
                  const modified = modifyWorkflow(
                    currentWorkflowForModify, 
                    existingNodes, 
                    existingEdges, 
                    modificationType, 
                    targetStep, 
                    userMessage
                  )
                  
                  setFlow(modified.nodes, modified.edges)
                  setWorkflow(modified.workflow)
                  
                  console.log('✅ Workflow modified:', modificationType, targetStep)
                }
                
                return [...prev, aiMessage]
              }
              
              // If AI decided we should generate workflow, trigger it
              if (shouldGenerate && existingNodes.length === 0) {
                console.log('🤖 AI decided to generate workflow')
                // First add the AI response
                const updatedMessages = [...prev, aiMessage]
                setMessages(updatedMessages)
                
                // Then build the workflow using the conversation history
                setTimeout(async () => {
                  // Combine the conversation context to create the workflow intent
                  const conversationText = currentMessages
                    .filter(m => m.role === 'user')
                    .slice(-5) // Last 5 user messages for better context
                    .map(m => m.text || m.content || '')
                    .join(' ')
                  
                  const combinedIntent = conversationText || userMessage
                  console.log('📝 Generating workflow with intent:', combinedIntent)
                  try {
                    await generateAndShowWorkflow(combinedIntent)
                    console.log('✅ Workflow generation completed')
                  } catch (error) {
                    console.error('❌ Error generating workflow:', error)
                  }
                }, 1000)
                
                // Return early to prevent adding the message twice
                return prev
              } else {
                // Normal response, just add it
                return [...prev, aiMessage]
              }
            })
          })
          return currentMessages
        })
      }, 300)
      return prevContext
    })
  }

  const generateAndShowWorkflow = async (combinedIntent) => {
    setIsGenerating(true)

    // Check if loading message already exists (might have been added by AI response)
    setMessages((prev) => {
      const hasLoading = prev.some(m => 
        m.text.includes("🔄 Building") || 
        m.text.includes("Building your workflow") ||
        m.text.includes("building that") ||
        m.text.includes("one moment")
      )
      if (hasLoading) return prev
      
      // Add loading message
      const loadingMessage = {
        id: Date.now() + 0.5,
        text: "🔄 Building your workflow... This may take a few moments.",
        role: "assistant",
        timestamp: new Date(),
      }
      return [...prev, loadingMessage]
    })

    try {
      console.log('🚀 Starting workflow generation with intent:', combinedIntent)
      // Generate workflow using OpenAI (or mock fallback)
      const updatedWorkflow = await generateWorkflowFromIntent(combinedIntent)
      console.log('✅ Generated workflow:', updatedWorkflow)
      
      if (!updatedWorkflow) {
        throw new Error('Workflow generation returned null or undefined')
      }
      
      setLocalWorkflow(updatedWorkflow)
      
      // Convert and set flow state
      const { nodes, edges } = convertWorkflowToFlow(updatedWorkflow)
      console.log('🔄 Converted nodes:', nodes, 'edges:', edges)
      
      if (!nodes || nodes.length === 0) {
        console.warn('⚠️ No nodes generated from workflow')
      }
      
      // Check if we should append or create new
      const shouldAppend = existingNodes.length > 0
      
      if (shouldAppend) {
        console.log('📌 Appending to existing workflow with', existingNodes.length, 'nodes')
        const merged = chainAppend(existingNodes, existingEdges, nodes, edges)
        setFlow(merged.nodes, merged.edges)
        
        // Merge workflow summaries
        setWorkflow((prev) => {
          if (!prev) return updatedWorkflow
          const mergedSteps = [...(prev.steps || []), ...updatedWorkflow.steps]
          const mergedIntegrations = Array.from(new Set([...(prev.integrations || []), ...updatedWorkflow.integrations]))
          return { 
            ...prev, 
            steps: mergedSteps, 
            integrations: mergedIntegrations,
            // Keep original name and trigger
            name: prev.name || updatedWorkflow.name,
            trigger: prev.trigger || updatedWorkflow.trigger
          }
        })
      } else {
        console.log('🆕 Creating new workflow (no existing nodes)')
        setFlow(nodes, edges)
        setWorkflow(updatedWorkflow)
      }
      
      console.log('💾 Workflow state updated in store')

      // Update with final AI response - remove loading messages if they exist
      setMessages((prev) => {
        const filtered = prev.filter(m => 
          !m.text.includes("Building your workflow") && 
          !m.text.includes("🔄 Building") &&
          !m.text.includes("Building the workflow") &&
          !m.text.includes("I understand what you want to automate") &&
          !m.text.includes("building that") &&
          !m.text.includes("one moment") &&
          !m.text.includes("just a moment") &&
          !m.text.includes("I'll go ahead") &&
          !m.text.includes("I'll get")
        )
        
        const successMessage = shouldAppend
          ? `Perfect! ✅ I've added new steps to your existing workflow! 🎉\n\nNew steps added: ${updatedWorkflow.steps.join(' → ')}\n\nYou can continue chatting to refine it or click 'Edit in Builder' to make manual changes.`
          : `Perfect! ✅ I've created your workflow: "${updatedWorkflow.name}". Check it out on the right side! 🎉\n\nTrigger: ${updatedWorkflow.trigger}\nSteps: ${updatedWorkflow.steps.join(' → ')}\n\nYou can continue chatting to refine it or click 'Edit in Builder' to make manual changes.`
        
        return [...filtered, {
          id: Date.now() + 1,
          text: successMessage,
          role: "assistant",
          timestamp: new Date(),
        }]
      })
    } catch (error) {
      console.error("Error generating workflow:", error)
      setMessages((prev) => {
        const filtered = prev.filter(m => 
          !m.text.includes("Building your workflow") && 
          !m.text.includes("🔄 Building") &&
          !m.text.includes("I understand what you want to automate") &&
          !m.text.includes("building that") &&
          !m.text.includes("one moment")
        )
        return [...filtered, {
          id: Date.now() + 1,
          text: "Sorry, there was an error generating your workflow. Could you try describing it differently? For example: 'Save Facebook comments to Google Sheets' or 'Automate email replies'.",
          role: "assistant",
          timestamp: new Date(),
        }]
      })
    } finally {
      setIsGenerating(false)
      pendingResponseRef.current = false
    }
  }

  const handlePreview = () => {
    if (workflow) {
      setWorkflow(workflow)
      navigate("/preview")
    }
  }

  const handleOpenBuilder = () => {
    if (workflow) {
      setWorkflow(workflow)
      navigate("/builder")
    }
  }

  const { nodes, edges } = workflow ? convertWorkflowToFlow(workflow) : { nodes: [], edges: [] }

  return (
    <div className="max-w-[1800px] mx-auto">
      <div className="mb-6">
        <h1 className="text-4xl font-bold mb-2">Chat to Automation</h1>
        <p className="text-muted-foreground">
          Describe your workflow and watch it build live
        </p>
      </div>

      <div className="grid grid-cols-2 gap-6" style={{ height: 'calc(100vh - 200px)' }}>
        {/* Left: Chat */}
        <div className="flex flex-col">
          <Card className="flex-1 flex flex-col h-full">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    AI Assistant
                    <Badge 
                      variant={openAIConnected ? "default" : "outline"} 
                      className={openAIConnected ? "bg-green-500 hover:bg-green-600" : ""}
                      title={openAIConnected ? "OpenAI connected - AI-powered responses enabled" : "OpenAI not connected - Using basic responses"}
                    >
                      {openAIConnected ? (
                        <>
                          <span className="w-2 h-2 rounded-full bg-white mr-1.5 inline-block animate-pulse"></span>
                          AI Powered
                        </>
                      ) : (
                        <>
                          <span className="w-2 h-2 rounded-full bg-yellow-500 mr-1.5 inline-block"></span>
                          Basic Mode
                        </>
                      )}
                    </Badge>
                  </CardTitle>
                  <CardDescription>
                    {openAIConnected 
                      ? "Let's build your automation workflow together with AI assistance"
                      : "Set VITE_OPENAI_API_KEY in .env to enable AI-powered responses"}
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="flex-1 overflow-y-auto space-y-4">
              {messages.map((message) => (
                <div
                  key={message.id}
                  className={`flex ${message.role === "user" ? "justify-end" : "justify-start"}`}
                >
                  <div
                    className={`max-w-[85%] rounded-lg p-3 whitespace-pre-line ${
                      message.role === "user"
                        ? "bg-primary text-primary-foreground"
                        : "bg-secondary"
                    }`}
                  >
                    <p className="text-sm">{message.text}</p>
                  </div>
                </div>
              ))}
            </CardContent>
            <div className="border-t p-4">
              <form onSubmit={handleSend} className="flex gap-2 mb-3">
                <Input
                  type="text"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  placeholder={messages.length > 1 ? "Continue the conversation..." : "What would you like to automate?"}
                  className="flex-1"
                  disabled={isGenerating}
                />
                <Button type="submit" disabled={isGenerating}>
                  {isGenerating ? "..." : "Send"}
                </Button>
              </form>
              {workflow && (
                <div className="flex gap-2">
                  <Button onClick={handleOpenBuilder} className="flex-1" variant="outline">
                    Edit in Builder
                  </Button>
                  <Button onClick={handlePreview} className="flex-1">
                    View Summary
                  </Button>
                </div>
              )}
            </div>
          </Card>
        </div>

        {/* Right: Workflow Preview */}
        <div className="flex flex-col">
          <Card className="flex-1 h-full">
            <CardHeader>
              <CardTitle>Workflow Preview</CardTitle>
              <CardDescription>Live visualization of your automation</CardDescription>
            </CardHeader>
            <CardContent className="h-full p-0">
              <div className="h-full">
                <WorkflowPreview
                  workflow={workflow}
                  nodes={nodes}
                  edges={edges}
                  onOpenBuilder={handleOpenBuilder}
                />
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
