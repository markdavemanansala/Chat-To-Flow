// @ts-nocheck
import { useState, useEffect, useRef } from 'react'
import { Panel, PanelGroup, PanelResizeHandle } from 'react-resizable-panels'
import WorkflowCanvas from '@/components/workflow/WorkflowCanvas'
import NodeCatalog from '@/components/workflow/NodeCatalog'
import NodeInspector from '@/components/workflow/NodeInspector'
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { useNodes, useEdges, useSetFlow, useSetEdges, useSetWorkflow, useWorkflowSummary, useAiContext, useApplyPatch } from '@/store/app'
import { planFromIntent } from '@/workflow/planner'
import { TestConsole } from '@/components/test/TestConsole'
import { ValidationHealthBar } from '@/components/validation/ValidationHealthBar'
import { IntegrationsDrawer } from '@/components/integrations/IntegrationsDrawer'
import { SecretsManager } from '@/components/secrets/SecretsManager'
import { ShortcutsHelp } from '@/components/keyboard/ShortcutsHelp'
import { isOpenAIAvailable } from '@/lib/config'
import { getConversationalResponse } from '@/lib/api'
import type { Node } from 'reactflow'

function chainAppend(existingNodes: any[], existingEdges: any[], newNodes: any[], newEdges: any[]) {
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

interface BuilderProps {
  initialTab?: 'chat' | 'catalog'
}

export default function Builder(props: BuilderProps = {}) {
  const { initialTab = 'chat' } = props
  const [messages, setMessages] = useState([])
  const [input, setInput] = useState('')
  const [activeTab, setActiveTab] = useState<'chat' | 'catalog'>(initialTab)
  const [testConsoleOpen, setTestConsoleOpen] = useState(false)
  const [integrationsOpen, setIntegrationsOpen] = useState(false)
  const [secretsOpen, setSecretsOpen] = useState(false)
  const [shortcutsOpen, setShortcutsOpen] = useState(false)
  const [selectedNode, setSelectedNode] = useState<Node | null>(null)
  const pendingResponseRef = useRef(false)
  const [openAIConnected, setOpenAIConnected] = useState(false)
  const nodes = useNodes()
  const edges = useEdges()
  const setFlow = useSetFlow()
  const setEdges = useSetEdges()
  const setWorkflow = useSetWorkflow()
  const workflowSummary = useWorkflowSummary()
  const aiContext = useAiContext()
  const applyPatch = useApplyPatch()

  // Check OpenAI connection status
  useEffect(() => {
    setOpenAIConnected(isOpenAIAvailable())
  }, [])

  // Keyboard shortcut for ? key
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === '?' && !(e.target instanceof HTMLInputElement) && !(e.target instanceof HTMLTextAreaElement)) {
        e.preventDefault()
        setShortcutsOpen(true)
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [])

  const handleSend = async (e) => {
    e.preventDefault()
    if (!input.trim() || pendingResponseRef.current) return
    
    const userMessage = input.trim()
    setMessages((prev) => [...prev, { id: Date.now(), role: 'user', text: userMessage }])
    setInput('')
    pendingResponseRef.current = true
    
    // Use AI to provide conversational response
    // AI will decide if workflow should be generated
    setTimeout(async () => {
      setMessages(currentMessages => {
        getConversationalResponse(userMessage, currentMessages, {
          workflow: workflowSummary,
          nodes: nodes,
          edges: edges,
          collectingInfo: false
        }).then(aiResponse => {
          setMessages((prev) => {
            if (!pendingResponseRef.current) return prev
            pendingResponseRef.current = false
            
            // Handle both string (fallback) and object (new format) responses
            const responseText = typeof aiResponse === 'string' ? aiResponse : aiResponse.text
            const shouldGenerate = typeof aiResponse === 'object' ? aiResponse.shouldGenerateWorkflow : false
            
            const aiMessage = {
              id: Date.now() + 1,
              role: 'assistant',
              text: responseText
            }
            
            // If AI decided we should generate workflow, trigger it
            if (shouldGenerate) {
              console.log('🤖 AI decided to generate workflow in Builder')
              // Add AI response first
              const updatedMessages = [...prev, aiMessage]
              setMessages(updatedMessages)
              
              // Use patch-based system
              setTimeout(async () => {
                const patch = await planFromIntent(userMessage, aiContext.currentSummary, nodes)
                const result = applyPatch(patch)
                
                if (result.ok) {
                  setMessages((prev) => [
                    ...prev,
                    { id: Date.now() + 1, role: 'assistant', text: result.nodes.length > nodes.length ? 'Added nodes to your workflow.' : 'Updated your workflow.' },
                  ])
                } else {
                  setMessages((prev) => [
                    ...prev,
                    { id: Date.now() + 1, role: 'assistant', text: `Failed to update workflow: ${result.issues?.join(', ')}` },
                  ])
                }
              }, 1000)
              
              return prev
            } else {
              return [...prev, aiMessage]
            }
          })
        })
        return currentMessages
      })
    }, 300)
  }

  const handleGenerate = () => {
    const text = input.trim()
    if (!text) {
      // If no text in input, check last user message
      const lastUserMessage = messages.filter(m => m.role === 'user').pop()
      if (!lastUserMessage) return
      
      const { nodes: newNodes, edges: newEdges, summary } = compileIntentToFlow(lastUserMessage.text)
      
      // If existing nodes exist, append instead of replace
      if (nodes.length > 0) {
        const merged = chainAppend(nodes, edges, newNodes, newEdges)
        setFlow(merged.nodes, merged.edges)
        setWorkflow((prev: any) => {
          const prevSummary = prev || { name: summary.name, trigger: summary.trigger, steps: [], integrations: [], source: 'chat' }
          const mergedSteps = [...(prevSummary.steps || []), ...summary.steps]
          const mergedIntegrations = Array.from(new Set([...(prevSummary.integrations || []), ...summary.integrations]))
          return { ...prevSummary, steps: mergedSteps, integrations: mergedIntegrations }
        })
        setMessages((prev) => [
          ...prev,
          { id: Date.now() + 1, role: 'assistant', text: 'Added nodes to your existing workflow.' },
        ])
      } else {
        setFlow(newNodes, newEdges)
        setWorkflow(summary)
        setMessages((prev) => [
          ...prev,
          { id: Date.now() + 1, role: 'assistant', text: 'Generated flow from your message.' },
        ])
      }
      return
    }
    
    const { nodes: newNodes, edges: newEdges, summary } = compileIntentToFlow(text)
    
    // If existing nodes exist, append instead of replace
    if (nodes.length > 0) {
      const merged = chainAppend(nodes, edges, newNodes, newEdges)
      setFlow(merged.nodes, merged.edges)
      setWorkflow((prev: any) => {
        const prevSummary = prev || { name: summary.name, trigger: summary.trigger, steps: [], integrations: [], source: 'chat' }
        const mergedSteps = [...(prevSummary.steps || []), ...summary.steps]
        const mergedIntegrations = Array.from(new Set([...(prevSummary.integrations || []), ...summary.integrations]))
        return { ...prevSummary, steps: mergedSteps, integrations: mergedIntegrations }
      })
      setMessages((prev) => [
        ...prev,
        { id: Date.now(), role: 'user', text },
        { id: Date.now() + 1, role: 'assistant', text: 'Added nodes to your existing workflow.' },
      ])
    } else {
      setFlow(newNodes, newEdges)
      setWorkflow(summary)
      setMessages((prev) => [
        ...prev,
        { id: Date.now(), role: 'user', text },
        { id: Date.now() + 1, role: 'assistant', text: 'Generated flow from your message.' },
      ])
    }
    setInput('')
  }

  const handleAppend = () => {
    const text = input.trim()
    if (!text) {
      // If no text in input, check last user message
      const lastUserMessage = messages.filter(m => m.role === 'user').pop()
      if (!lastUserMessage) return
      const { nodes: newNodes, edges: newEdges, summary } = compileIntentToFlow(lastUserMessage.text)
      const merged = chainAppend(nodes, edges, newNodes, newEdges)
      setFlow(merged.nodes, merged.edges)
      setWorkflow((prev: any) => {
        const prevSummary = prev || { name: summary.name, trigger: summary.trigger, steps: [], integrations: [], source: 'chat' }
        const mergedSteps = [...(prevSummary.steps || []), ...summary.steps]
        const mergedIntegrations = Array.from(new Set([...(prevSummary.integrations || []), ...summary.integrations]))
        return { ...prevSummary, steps: mergedSteps, integrations: mergedIntegrations }
      })
      setMessages((prev) => [
        ...prev,
        { id: Date.now() + 1, role: 'assistant', text: 'Appended nodes to the current flow.' },
      ])
      return
    }
    
    const { nodes: newNodes, edges: newEdges, summary } = compileIntentToFlow(text)
    const merged = chainAppend(nodes, edges, newNodes, newEdges)
    setFlow(merged.nodes, merged.edges)
    // Merge summary by concatenating steps and unions of integrations; keep existing name
    setWorkflow((prev: any) => {
      const prevSummary = prev || { name: summary.name, trigger: summary.trigger, steps: [], integrations: [], source: 'chat' }
      const mergedSteps = [...(prevSummary.steps || []), ...summary.steps]
      const mergedIntegrations = Array.from(new Set([...(prevSummary.integrations || []), ...summary.integrations]))
      return { ...prevSummary, steps: mergedSteps, integrations: mergedIntegrations }
    })
    setMessages((prev) => [
      ...prev,
      { id: Date.now(), role: 'user', text },
      { id: Date.now() + 1, role: 'assistant', text: 'Appended nodes to the current flow.' },
    ])
    setInput('')
  }

  return (
    <div className="h-[calc(100vh-120px)] relative">
      {/* Top Toolbar */}
      <div className="flex items-center gap-2 p-2 border-b bg-background flex-wrap">
        <Button size="sm" variant="outline" onClick={() => setIntegrationsOpen(true)} className="hidden sm:inline-flex">
          Connect Accounts
        </Button>
        <Button size="sm" variant="outline" onClick={() => setIntegrationsOpen(true)} className="sm:hidden">
          Accounts
        </Button>
        <Button size="sm" variant="outline" onClick={() => setSecretsOpen(true)}>
          Secrets
        </Button>
        <Button size="sm" variant="outline" onClick={() => setTestConsoleOpen(!testConsoleOpen)}>
          {testConsoleOpen ? 'Hide' : 'Show'} Test
        </Button>
        <Button size="sm" variant="outline" onClick={() => setShortcutsOpen(true)} className="hidden sm:inline-flex">
          Shortcuts (?)
        </Button>
        <Button size="sm" variant="outline" onClick={() => setShortcutsOpen(true)} className="sm:hidden">
          ?
        </Button>
      </div>

      <PanelGroup direction="horizontal" className="hidden md:flex">
        {/* Left: Chat */}
        <Panel defaultSize={40} minSize={25} className="overflow-hidden">
          <Card className="h-full flex flex-col">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div className="flex-1">
                  <CardTitle className="flex items-center gap-2">
                    Builder Panel
                    {activeTab === 'chat' && (
                      <Badge 
                        variant={openAIConnected ? "default" : "outline"} 
                        className={openAIConnected ? "bg-green-500 hover:bg-green-600 text-xs" : "text-xs"}
                        title={openAIConnected ? "OpenAI connected" : "OpenAI not connected"}
                      >
                        {openAIConnected ? (
                          <>
                            <span className="w-1.5 h-1.5 rounded-full bg-white mr-1 inline-block animate-pulse"></span>
                            AI
                          </>
                        ) : (
                          <>
                            <span className="w-1.5 h-1.5 rounded-full bg-yellow-500 mr-1 inline-block"></span>
                            Basic
                          </>
                        )}
                      </Badge>
                    )}
                  </CardTitle>
                  <CardDescription>Chat or drag nodes from Catalog</CardDescription>
                </div>
                <div className="flex gap-2 flex-wrap">
                  <Button size="sm" variant={activeTab==='chat'?'default':'outline'} onClick={()=>setActiveTab('chat')}>Chat</Button>
                  <Button size="sm" variant={activeTab==='catalog'?'default':'outline'} onClick={()=>setActiveTab('catalog')}>Catalog</Button>
                </div>
              </div>
            </CardHeader>
            {activeTab === 'chat' ? (
              <>
                <CardContent className="flex-1 overflow-y-auto space-y-3">
                  {messages.length === 0 && (
                    <div className="text-sm text-muted-foreground">Start by describing your workflow...</div>
                  )}
                  {messages.map((m) => (
                    <div key={m.id} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                      <div className={`max-w-[85%] rounded-md p-2 ${m.role === 'user' ? 'bg-primary text-primary-foreground' : 'bg-secondary'}`}>
                        <p className="text-sm whitespace-pre-line">{m.text}</p>
                      </div>
                    </div>
                  ))}
                </CardContent>
                <div className="border-t p-3">
                  <form onSubmit={handleSend} className="flex gap-2">
                    <Input
                      value={input}
                      onChange={(e) => setInput(e.target.value)}
                      placeholder="Describe your automation... (workflow updates automatically)"
                      className="flex-1"
                    />
                    <Button type="submit">Send</Button>
                  </form>
                </div>
              </>
            ) : (
              <div className="flex-1 overflow-hidden">
                <NodeCatalog />
              </div>
            )}
          </Card>
        </Panel>

        <PanelResizeHandle className="w-1 bg-border cursor-col-resize" />

        {/* Right: Canvas */}
        <Panel defaultSize={selectedNode ? 45 : 60} minSize={35} className="overflow-hidden">
          <div className="h-full flex flex-col">
            <ValidationHealthBar />
            <div className="flex-1">
              <WorkflowCanvas onNodeSelect={setSelectedNode} />
            </div>
          </div>
        </Panel>

        {/* Right Sidebar: Node Inspector (when node selected) */}
        {selectedNode && (
          <>
            <PanelResizeHandle className="w-1 bg-border cursor-col-resize" />
            <Panel defaultSize={15} minSize={15} maxSize={30} className="overflow-hidden border-l">
              <div className="h-full overflow-y-auto">
                <NodeInspector 
                  selectedNode={selectedNode} 
                  onOpenSecrets={() => setSecretsOpen(true)} 
                />
              </div>
            </Panel>
          </>
        )}
      </PanelGroup>

      {/* Mobile Layout - Tabs instead of panels */}
      <div className="md:hidden h-[calc(100vh-160px)] space-y-4 overflow-y-auto">
        {activeTab === 'chat' ? (
          <Card className="h-full flex flex-col">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                Builder Panel
                <Badge 
                    variant={openAIConnected ? "default" : "outline"} 
                    className={openAIConnected ? "bg-green-500 hover:bg-green-600 text-xs" : "text-xs"}
                    title={openAIConnected ? "OpenAI connected" : "OpenAI not connected"}
                  >
                    {openAIConnected ? (
                      <>
                        <span className="w-1.5 h-1.5 rounded-full bg-white mr-1 inline-block animate-pulse"></span>
                        AI
                      </>
                    ) : (
                      <>
                        <span className="w-1.5 h-1.5 rounded-full bg-yellow-500 mr-1 inline-block"></span>
                        Basic
                      </>
                    )}
                  </Badge>
              </CardTitle>
              <CardDescription>Chat or drag nodes from Catalog</CardDescription>
            </CardHeader>
            <CardContent className="flex-1 overflow-y-auto space-y-3">
              {messages.length === 0 && (
                <div className="text-sm text-muted-foreground">Start by describing your workflow...</div>
              )}
              {messages.map((m) => (
                <div key={m.id} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                  <div className={`max-w-[85%] rounded-md p-2 ${m.role === 'user' ? 'bg-primary text-primary-foreground' : 'bg-secondary'}`}>
                    <p className="text-sm whitespace-pre-line">{m.text}</p>
                  </div>
                </div>
              ))}
            </CardContent>
            <div className="border-t p-3">
              <form onSubmit={handleSend} className="flex gap-2">
                <Input
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  placeholder="Describe your automation... (workflow updates automatically)"
                  className="flex-1"
                />
                <Button type="submit">Send</Button>
              </form>
            </div>
          </Card>
        ) : (
          <div className="h-full">
            <NodeCatalog />
          </div>
        )}
        <div className="mt-4">
          <ValidationHealthBar />
          <div className="h-[400px] border rounded">
            <WorkflowCanvas />
          </div>
        </div>
      </div>

      {/* Floating Components */}
      <TestConsole open={testConsoleOpen} onToggle={() => setTestConsoleOpen(!testConsoleOpen)} />
      <IntegrationsDrawer open={integrationsOpen} onOpenChange={setIntegrationsOpen} />
      <SecretsManager open={secretsOpen} onOpenChange={setSecretsOpen} />
      <ShortcutsHelp open={shortcutsOpen} onOpenChange={setShortcutsOpen} />
    </div>
  )
}



