import { useCallback, useState, useEffect } from 'react'
import ReactFlow, {
  Background,
  Controls,
  MiniMap,
  addEdge,
  useNodesState,
  useEdgesState,
  ConnectionMode,
} from 'reactflow'
import 'reactflow/dist/style.css'
import './WorkflowBuilder.css'

import { useNodes, useEdges, useSetFlow, useWorkflowSummary, useSetWorkflow } from '@/store/app'
import { Button } from './ui/button'
import { Card } from './ui/card'

const initialNodes = []
const initialEdges = []

export function WorkflowBuilder({ onClose }) {
  const storeNodes = useNodes()
  const storeEdges = useEdges()
  const setFlow = useSetFlow()
  const workflowSummary = useWorkflowSummary()
  const setWorkflow = useSetWorkflow()

  const [rfNodes, setNodes, onNodesChange] = useNodesState(initialNodes)
  const [rfEdges, setEdges, onEdgesChange] = useEdgesState(initialEdges)
  const [selectedNode, setSelectedNode] = useState(null)

  // Initialize from store or convert workflow summary to nodes
  useEffect(() => {
    if (storeNodes.length > 0) {
      setNodes(storeNodes)
      setEdges(storeEdges)
    } else if (workflowSummary) {
      // Convert workflow summary to nodes/edges
      const { nodes: convertedNodes, edges: convertedEdges } = convertWorkflowToFlow(workflowSummary)
      setNodes(convertedNodes)
      setEdges(convertedEdges)
    }
  }, [workflowSummary, storeNodes, storeEdges, setNodes, setEdges])

  const onConnect = useCallback(
    (params) => {
      setEdges((eds) => addEdge(params, eds))
    },
    [setEdges]
  )

  const onSave = () => {
    // Save flow state
    setFlow(rfNodes, rfEdges)
    
    // Update workflow summary based on current nodes
    if (workflowSummary) {
      const updatedSummary = convertFlowToWorkflow(rfNodes, rfEdges, workflowSummary)
      setWorkflow(updatedSummary)
    }
    
    if (onClose) onClose()
  }

  const onNodeClick = useCallback((event, node) => {
    setSelectedNode(node)
  }, [])

  const addNode = (kind, label) => {
    const newNode = {
      id: `${kind}_${Date.now()}`,
      type: 'default',
      position: { x: Math.random() * 400, y: Math.random() * 400 },
      data: { kind, label, config: {} },
    }
    setNodes((nds) => [...nds, newNode])
  }

  const nodeTypes = [
    { kind: 'trigger.facebook.comment', label: 'Facebook Comment', category: 'Triggers' },
    { kind: 'trigger.webhook.inbound', label: 'Webhook', category: 'Triggers' },
    { kind: 'trigger.scheduler.cron', label: 'Schedule', category: 'Triggers' },
    { kind: 'logic.filter', label: 'Filter', category: 'Logic' },
    { kind: 'ai.guard', label: 'AI Guard', category: 'Logic' },
    { kind: 'ai.generate', label: 'AI Generate', category: 'Logic' },
    { kind: 'action.facebook.reply', label: 'Facebook Reply', category: 'Actions' },
    { kind: 'action.facebook.dm', label: 'Facebook DM', category: 'Actions' },
    { kind: 'action.sheets.appendRow', label: 'Add to Sheets', category: 'Actions' },
    { kind: 'action.email.send', label: 'Send Email', category: 'Actions' },
    { kind: 'action.http.request', label: 'HTTP Request', category: 'Actions' },
  ]

  const groupedNodes = nodeTypes.reduce((acc, node) => {
    if (!acc[node.category]) {
      acc[node.category] = []
    }
    acc[node.category].push(node)
    return acc
  }, {})

  return (
    <div className="flex h-screen bg-background">
      {/* Sidebar */}
      <div className="w-64 border-r bg-card overflow-y-auto p-4">
        <h2 className="font-semibold mb-4 text-lg">Nodes</h2>
        <div className="space-y-4">
          {Object.entries(groupedNodes).map(([category, nodes]) => (
            <div key={category}>
              <h3 className="text-xs font-semibold text-muted-foreground uppercase mb-2">
                {category}
              </h3>
              <div className="space-y-1">
                {nodes.map((node) => (
                  <Button
                    key={node.kind}
                    variant="outline"
                    size="sm"
                    className="w-full justify-start text-left"
                    onClick={() => addNode(node.kind, node.label)}
                  >
                    {node.label}
                  </Button>
                ))}
              </div>
            </div>
          ))}
        </div>

        <div className="mt-6 space-y-2">
          <Button onClick={onSave} className="w-full">Save Workflow</Button>
          {onClose && (
            <Button variant="outline" onClick={onClose} className="w-full">
              Cancel
            </Button>
          )}
        </div>
      </div>

      {/* Main Canvas */}
      <div className="flex-1 relative">
        <ReactFlow
          nodes={rfNodes}
          edges={rfEdges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={onConnect}
          onNodeClick={onNodeClick}
          connectionMode={ConnectionMode.Loose}
          fitView
        >
          <Background />
          <Controls />
          <MiniMap />
        </ReactFlow>

        {/* Node Details Panel */}
        {selectedNode && (
          <div className="absolute top-4 right-4 z-10 w-80">
            <Card className="p-4">
              <h3 className="font-semibold mb-2">Node Details</h3>
              <div className="space-y-2 text-sm">
                <div>
                  <span className="text-muted-foreground">Label:</span>
                  <span className="ml-2">{selectedNode.data.label}</span>
                </div>
                <div>
                  <span className="text-muted-foreground">Kind:</span>
                  <span className="ml-2 font-mono text-xs">{selectedNode.data.kind}</span>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setSelectedNode(null)}
                  className="mt-4 w-full"
                >
                  Close
                </Button>
              </div>
            </Card>
          </div>
        )}
      </div>
    </div>
  )
}

// Helper: Map step text to node kind
function inferNodeKindFromStep(stepText, trigger) {
  const lower = stepText.toLowerCase()
  const lowerTrigger = (trigger || '').toLowerCase()
  
  // Trigger kinds
  if (lowerTrigger.includes('facebook comment')) {
    return 'trigger.facebook.comment'
  }
  if (lowerTrigger.includes('webhook')) {
    return 'trigger.webhook.inbound'
  }
  if (lowerTrigger.includes('schedule') || lowerTrigger.includes('cron')) {
    return 'trigger.scheduler.cron'
  }
  
  // Action kinds based on step text
  if (lower.includes('capture facebook comment')) {
    // Capture step - use reply action as placeholder
    return 'action.facebook.reply'
  }
  if (lower.includes('facebook reply') || lower.includes('reply to comment')) {
    return 'action.facebook.reply'
  }
  if (lower.includes('capture facebook dm') || lower.includes('facebook dm') || lower.includes('send facebook dm') || (lower.includes('direct message') && lower.includes('facebook'))) {
    return 'action.facebook.dm'
  }
  if (lower.includes('google sheets') || lower.includes('add to google sheets') || lower.includes('add row') || lower.includes('save to sheet')) {
    return 'action.sheets.appendRow'
  }
  if (lower.includes('email') || lower.includes('send email')) {
    return 'action.email.send'
  }
  if (lower.includes('telegram')) {
    return 'action.telegram.sendMessage'
  }
  if (lower.includes('filter') || lower.includes('condition')) {
    return 'logic.filter'
  }
  if (lower.includes('ai guard') || lower.includes('guard')) {
    return 'ai.guard'
  }
  if (lower.includes('ai generate') || lower.includes('generate')) {
    return 'ai.generate'
  }
  
  // Default to HTTP request
  return 'action.http.request'
}

// Helper: Convert workflow summary to flow nodes/edges
export function convertWorkflowToFlow(workflow) {
  const nodes = []
  const edges = []
  
  if (!workflow || !workflow.steps) {
    return { nodes, edges }
  }

  let nodeIndex = 0
  let startX = 100

  // Create trigger node if trigger exists and is not "Manual trigger"
  if (workflow.trigger && workflow.trigger !== 'Manual trigger' && !workflow.trigger.toLowerCase().includes('manual trigger')) {
    const triggerKind = inferNodeKindFromStep(workflow.trigger, workflow.trigger)
    const triggerNode = {
      id: 'trigger_0',
      type: 'default',
      position: { x: startX, y: 100 },
      data: {
        kind: triggerKind,
        label: workflow.trigger,
        config: {},
        role: 'TRIGGER', // Ensure role is set for proper matching
      },
      style: { background: '#e3f2fd', color: '#1565c0', border: '1px solid #1565c0' },
    }
    nodes.push(triggerNode)
    startX += 250
    nodeIndex++
  }

  // Create nodes from steps with inferred kinds
  workflow.steps.forEach((step, index) => {
    const kind = inferNodeKindFromStep(step, workflow.trigger)
    // Determine role based on kind
    let role = 'ACTION';
    if (kind.startsWith('trigger.')) role = 'TRIGGER';
    else if (kind.startsWith('logic.')) role = 'LOGIC';
    else if (kind.startsWith('ai.')) role = 'AI';
    
    const node = {
      id: `step_${index}`,
      type: 'default',
      position: { x: startX + index * 250, y: 100 },
      data: {
        kind: kind,
        label: step,
        config: {},
        role: role, // Ensure role is set for proper matching
      },
    }
    nodes.push(node)
  })

  // Connect nodes in sequence
  for (let i = 0; i < nodes.length - 1; i++) {
    edges.push({
      id: `edge_${i}_${i + 1}`,
      source: nodes[i].id,
      target: nodes[i + 1].id,
      type: 'default',
      animated: false,
    })
  }

  return { nodes, edges }
}

// Helper: Convert flow nodes/edges to workflow summary
function convertFlowToWorkflow(nodes, edges, existingSummary) {
  // Filter out trigger nodes when building steps
  const steps = nodes
    .filter(node => !node.data.kind.startsWith('trigger'))
    .map(node => node.data.label)
  const integrations = extractIntegrations(nodes)
  const triggerNode = nodes.find(n => n.data.kind.startsWith('trigger'))
  const trigger = triggerNode 
    ? triggerNode.data.label
    : existingSummary?.trigger || 'Manual trigger'

  return {
    ...existingSummary,
    steps,
    integrations,
    trigger,
  }
}

// Helper: Extract integrations from nodes
function extractIntegrations(nodes) {
  const integrationMap = {
    'action.facebook.reply': 'Facebook',
    'action.facebook.dm': 'Facebook',
    'trigger.facebook.comment': 'Facebook',
    'action.sheets.appendRow': 'Google Sheets',
    'action.email.send': 'Email',
    'action.telegram.sendMessage': 'Telegram',
    'action.http.request': 'HTTP',
  }

  const integrations = new Set()
  nodes.forEach(node => {
    const integration = integrationMap[node.data.kind]
    if (integration) {
      integrations.add(integration)
    }
  })

  return Array.from(integrations)
}
