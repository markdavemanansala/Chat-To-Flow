// @ts-nocheck
import { useCallback, useEffect, useState, useRef } from 'react'
import ReactFlow, {
  Background,
  Controls,
  MiniMap,
  addEdge,
  applyNodeChanges,
  applyEdgeChanges,
  ConnectionMode,
  useReactFlow,
  ReactFlowProvider,
  Handle,
  Position,
} from 'reactflow'
import 'reactflow/dist/style.css'

import { Button } from '@/components/ui/button'
import { useNodes, useEdges, useSetFlow, useSetEdges, useResetFlow, useWorkflowSummary, useUpsertNode, useSetWorkflow } from '@/store/app'
import { convertWorkflowToFlow } from '@/components/WorkflowBuilder'
import { createNode } from '@/workflow/utils'
import { useToast } from '@/components/ToastProvider'
import { saveWorkflowDraft } from '@/lib/api'
import { createHistory } from '@/lib/undoRedo'
import { Badge } from '@/components/ui/badge'
import { checkNodeCredentials } from '@/utils/credentials'

// Helper function to get a meaningful label from node kind
function getNodeLabel(data) {
  if (data?.label && data.label.trim()) {
    return data.label
  }
  
  if (!data?.kind) {
    return 'Untitled Node'
  }
  
  // Extract readable name from kind
  const kind = data.kind
  const parts = kind.split('.')
  
  // Handle different node kind formats
  if (kind.startsWith('trigger.')) {
    if (kind.includes('facebook.comment')) return 'Facebook Comment'
    if (kind.includes('webhook')) return 'Webhook Trigger'
    if (kind.includes('scheduler') || kind.includes('cron')) return 'Scheduled Trigger'
    return parts.length > 1 ? parts.slice(1).map(p => p.charAt(0).toUpperCase() + p.slice(1)).join(' ') : 'Trigger'
  }
  
  if (kind.startsWith('action.')) {
    if (kind.includes('facebook.reply')) return 'Facebook Reply'
    if (kind.includes('facebook.dm')) return 'Facebook DM'
    if (kind.includes('telegram')) return 'Send Telegram'
    if (kind.includes('email.send')) return 'Send Email'
    if (kind.includes('sheets')) return 'Add to Sheets'
    if (kind.includes('http')) return 'HTTP Request'
    return parts.length > 1 ? parts.slice(1).map(p => p.charAt(0).toUpperCase() + p.slice(1)).join(' ') : 'Action'
  }
  
  if (kind.startsWith('logic.')) {
    if (kind.includes('filter')) return 'Filter'
    return 'Logic'
  }
  
  if (kind.includes('ai.')) {
    if (kind.includes('guard')) return 'AI Guard'
    if (kind.includes('generate')) return 'AI Generate'
    return 'AI Node'
  }
  
  // Fallback: format the kind nicely
  return parts.map(p => p.charAt(0).toUpperCase() + p.slice(1)).join(' ')
}

// Custom node component with handles for edge creation, badges, and tooltips
function CustomNode({ data, selected }) {
  const [hasMissingCreds, setHasMissingCreds] = useState(false)
  const [showTooltip, setShowTooltip] = useState(false)
  const [helpText, setHelpText] = useState('')
  
  const displayLabel = getNodeLabel(data)

  useEffect(() => {
    // Check if node requires credentials using utility
    const kind = data?.kind || ''
    const status = checkNodeCredentials(kind)
    setHasMissingCreds(status.requires && !status.has)
    
    // Listen for storage changes to update badge when secrets are added/removed
    const handleStorageChange = () => {
      const newStatus = checkNodeCredentials(kind)
      setHasMissingCreds(newStatus.requires && !newStatus.has)
    }
    
    window.addEventListener('storage', handleStorageChange)
    // Also listen to custom event for same-tab updates
    window.addEventListener('secrets-updated', handleStorageChange)
    
    // Set help text based on node kind
    if (data?.kind) {
      if (data.kind.startsWith('trigger')) {
        setHelpText('Triggers start your workflow when a specific event occurs')
      } else if (data.kind.startsWith('action')) {
        setHelpText('Actions perform tasks like sending messages or updating data')
      } else if (data.kind.includes('filter')) {
        setHelpText('Filters conditionally route workflow based on data')
      } else if (data.kind.includes('ai')) {
        setHelpText('AI nodes use artificial intelligence to process or generate content')
      }
    }
    
    return () => {
      window.removeEventListener('storage', handleStorageChange)
      window.removeEventListener('secrets-updated', handleStorageChange)
    }
  }, [data])

  return (
    <div 
      className={`relative px-4 py-2 shadow-md rounded-md bg-card border-2 ${selected ? 'border-primary' : 'border-border'}`}
      onMouseEnter={() => setShowTooltip(true)}
      onMouseLeave={() => setShowTooltip(false)}
    >
      <Handle type="target" position={Position.Top} className="w-3 h-3" />
      <div className="flex items-center justify-between gap-2">
        <div className="text-sm font-medium flex-1">{displayLabel}</div>
        {hasMissingCreds && (
          <Badge variant="destructive" className="text-xs px-1.5 py-0">
            ❗
          </Badge>
        )}
      </div>
      <Handle type="source" position={Position.Bottom} className="w-3 h-3" />
      
      {/* Tooltip */}
      {showTooltip && helpText && (
        <div className="absolute z-50 left-1/2 transform -translate-x-1/2 bottom-full mb-2 px-3 py-2 bg-popover text-popover-foreground border border-border text-xs rounded shadow-lg max-w-xs pointer-events-none">
          {helpText}
          {hasMissingCreds && (
            <div className="mt-1 pt-1 border-t border-border">
              ⚠️ Missing credentials - Connect accounts to use this node
            </div>
          )}
          <div className="absolute left-1/2 transform -translate-x-1/2 top-full w-0 h-0 border-l-4 border-r-4 border-t-4 border-transparent border-t-popover"></div>
        </div>
      )}
    </div>
  )
}

const nodeTypes = {
  default: CustomNode,
}

interface WorkflowCanvasInnerProps {
  onNodeSelect?: (node: any) => void
}

function WorkflowCanvasInner({ onNodeSelect }: WorkflowCanvasInnerProps) {
  const nodes = useNodes()
  const edges = useEdges()
  const workflowSummary = useWorkflowSummary()
  const setFlow = useSetFlow()
  const setEdges = useSetEdges()
  const resetFlow = useResetFlow()
  const upsertNode = useUpsertNode()
  const setWorkflow = useSetWorkflow()
  const { showToast } = useToast()
  const [selectedNodeIds, setSelectedNodeIds] = useState(new Set())
  const [selectedEdgeIds, setSelectedEdgeIds] = useState(new Set())
  const [isSaving, setIsSaving] = useState(false)
  const historyRef = useRef(createHistory())
  const autosaveTimerRef = useRef(null)
  const lastSavedRef = useRef(null)

  const rf = useReactFlow()

  // Initialize nodes/edges from workflowSummary if store is empty
  useEffect(() => {
    if (nodes.length === 0 && edges.length === 0 && workflowSummary) {
      const { nodes: convertedNodes, edges: convertedEdges } = convertWorkflowToFlow(workflowSummary)
      if (convertedNodes.length > 0) {
        setFlow(convertedNodes, convertedEdges)
        historyRef.current.push({ nodes: convertedNodes, edges: convertedEdges })
      }
    }
  }, [nodes.length, edges.length, workflowSummary, setFlow])

  // Define handleAutoSave before using it
  const handleAutoSave = useCallback(async () => {
    if (nodes.length === 0) return
    const currentState = JSON.stringify({ nodes, edges })
    if (currentState === lastSavedRef.current) return

    try {
      const triggerNode = nodes.find(n => n.data?.kind?.startsWith('trigger'))
      const actionNodes = nodes.filter(n => n.data?.kind?.startsWith('action'))
      
      const summary = {
        name: workflowSummary?.name || 'Untitled Workflow',
        trigger: triggerNode?.data?.label || 'Manual Trigger',
        steps: actionNodes.map(n => n.data?.label || n.data?.kind || 'Unknown'),
        integrations: Array.from(new Set(
          nodes
            .map(n => n.data?.kind)
            .filter(Boolean)
            .map(kind => {
              if (kind.includes('facebook')) return 'Facebook'
              if (kind.includes('sheets')) return 'Google Sheets'
              if (kind.includes('email')) return 'Email'
              if (kind.includes('telegram')) return 'Telegram'
              return 'Generic'
            })
        )),
        notes: workflowSummary?.notes || `Workflow with ${nodes.length} nodes`,
        source: 'chat',
      }

      await saveWorkflowDraft(summary)
      setWorkflow(summary)
      lastSavedRef.current = JSON.stringify({ nodes, edges })
      showToast('Saved', 'success')
    } catch (err) {
      console.error('Autosave failed', err)
    }
  }, [nodes, edges, workflowSummary, setWorkflow, showToast])

  // Autosave functionality
  useEffect(() => {
    if (nodes.length === 0) return

    const currentState = JSON.stringify({ nodes, edges })
    if (currentState === lastSavedRef.current) return

    // Clear existing timer
    if (autosaveTimerRef.current) {
      clearTimeout(autosaveTimerRef.current)
    }

    // Set new timer
    autosaveTimerRef.current = setTimeout(() => {
      handleAutoSave()
    }, 3000) // Autosave after 3 seconds of inactivity

    return () => {
      if (autosaveTimerRef.current) {
        clearTimeout(autosaveTimerRef.current)
      }
    }
  }, [nodes, edges, handleAutoSave])

  // Track selected nodes/edges
  useEffect(() => {
    const selectedNodes = nodes.filter(n => n.selected).map(n => n.id)
    const selectedEdges = edges.filter(e => e.selected).map(e => e.id)
    setSelectedNodeIds(new Set(selectedNodes))
    setSelectedEdgeIds(new Set(selectedEdges))
  }, [nodes, edges])

  const onNodesChange = useCallback((changes) => {
    const next = applyNodeChanges(changes, nodes)
    // Push to history before change
    if (changes.some(c => c.type !== 'select' && c.type !== 'position')) {
      historyRef.current.push({ nodes, edges })
    }
    setFlow(next, edges)
  }, [nodes, edges, setFlow])

  const onEdgesChange = useCallback((changes) => {
    const next = applyEdgeChanges(changes, edges)
    // Push to history before change
    if (changes.some(c => c.type !== 'select')) {
      historyRef.current.push({ nodes, edges })
    }
    setEdges(next)
  }, [nodes, edges, setEdges])

  const onConnect = useCallback((params) => {
    historyRef.current.push({ nodes, edges })
    const next = addEdge(params, edges)
    setEdges(next)
  }, [nodes, edges, setEdges])

  const handleFit = useCallback(() => {
    rf.fitView({ padding: 0.2, duration: 300 })
  }, [rf])

  const handleCenter = useCallback(() => {
    rf.setViewport({ x: 0, y: 0, zoom: 1 }, { duration: 300 })
  }, [rf])

  const handleExport = useCallback(() => {
    const data = { nodes, edges }
    const json = JSON.stringify(data, null, 2)
    const blob = new Blob([json], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'workflow.json'
    a.click()
    URL.revokeObjectURL(url)
    showToast('Workflow exported successfully', 'success')
  }, [nodes, edges, showToast])

  const handleImport = useCallback(() => {
    const jsonStr = window.prompt('Paste JSON with {nodes, edges}:')
    if (!jsonStr) return
    
    try {
      const data = JSON.parse(jsonStr)
      if (!data.nodes || !data.edges || !Array.isArray(data.nodes) || !Array.isArray(data.edges)) {
        throw new Error('Invalid format: expected {nodes: [], edges: []}')
      }
      setFlow(data.nodes, data.edges)
      showToast('Workflow imported successfully', 'success')
    } catch (err) {
      showToast(`Import failed: ${err.message}`, 'error')
    }
  }, [setFlow, showToast])

  const handleValidate = useCallback(() => {
    const triggers = nodes.filter(n => n.data?.kind?.startsWith('trigger'))
    const actions = nodes.filter(n => n.data?.kind?.startsWith('action'))

    if (triggers.length === 0) {
      showToast('Validation failed: No trigger found. A workflow must have exactly one trigger.', 'error')
      return
    }

    if (triggers.length > 1) {
      showToast(`Validation failed: Multiple triggers found (${triggers.length}). A workflow must have exactly one trigger.`, 'error')
      return
    }

    if (actions.length === 0) {
      showToast('Validation failed: No actions found. A workflow must have at least one action.', 'error')
      return
    }

    showToast('Validation passed! Workflow has one trigger and at least one action.', 'success')
  }, [nodes, showToast])

  const handleSaveDraft = useCallback(async () => {
    if (nodes.length === 0) {
      showToast('No workflow to save', 'error')
      return
    }

    setIsSaving(true)
    try {
      // Convert nodes/edges to workflow summary format
      const triggerNode = nodes.find(n => n.data?.kind?.startsWith('trigger'))
      const actionNodes = nodes.filter(n => n.data?.kind?.startsWith('action'))
      
      const summary = {
        name: workflowSummary?.name || 'Untitled Workflow',
        trigger: triggerNode?.data?.label || 'Manual Trigger',
        steps: actionNodes.map(n => n.data?.label || n.data?.kind || 'Unknown'),
        integrations: Array.from(new Set(
          nodes
            .map(n => n.data?.kind)
            .filter(Boolean)
            .map(kind => {
              if (kind.includes('facebook')) return 'Facebook'
              if (kind.includes('sheets')) return 'Google Sheets'
              if (kind.includes('email')) return 'Email'
              if (kind.includes('telegram')) return 'Telegram'
              return 'Generic'
            })
        )),
        notes: workflowSummary?.notes || `Workflow with ${nodes.length} nodes`,
        source: 'chat' as const,
      }

      await saveWorkflowDraft(summary)
      setWorkflow(summary)
      showToast('Draft saved successfully!', 'success')
    } catch (err) {
      showToast('Failed to save draft', 'error')
    } finally {
      setIsSaving(false)
    }
  }, [nodes, workflowSummary, setWorkflow, showToast])

  const handleReset = useCallback(() => {
    resetFlow()
  }, [resetFlow])

  const onNodeClick = useCallback((evt, node) => {
    if (onNodeSelect) {
      onNodeSelect(node)
    }
  }, [onNodeSelect])

  const onPaneClick = useCallback(() => {
    if (onNodeSelect) {
      onNodeSelect(null)
    }
  }, [onNodeSelect])

  const onNodeDoubleClick = useCallback((evt, node) => {
    const newLabel = window.prompt('Rename node label', node?.data?.label || '')
    if (!newLabel) return
    const next = nodes.map((n) => n.id === node.id ? { ...n, data: { ...n.data, label: newLabel } } : n)
    setFlow(next, edges)
  }, [nodes, edges, setFlow])

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e) => {
      // Skip if user is typing in an input/textarea
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return
      }

      // Delete/Backspace: Remove selected nodes and edges
      if ((e.key === 'Delete' || e.key === 'Backspace') && (selectedNodeIds.size > 0 || selectedEdgeIds.size > 0)) {
        e.preventDefault()
        const remainingNodes = nodes.filter(n => !selectedNodeIds.has(n.id))
        const remainingEdges = edges.filter(e => !selectedEdgeIds.has(e.id))
        setFlow(remainingNodes, remainingEdges)
      }

      // Cmd/Ctrl + S: Save draft
      if ((e.metaKey || e.ctrlKey) && e.key === 's') {
        e.preventDefault()
        handleSaveDraft()
      }

      // Cmd/Ctrl + E: Export JSON
      if ((e.metaKey || e.ctrlKey) && e.key === 'e') {
        e.preventDefault()
        handleExport()
      }

      // Cmd/Ctrl + Z: Undo
      if ((e.metaKey || e.ctrlKey) && e.key === 'z' && !e.shiftKey) {
        e.preventDefault()
        const previous = historyRef.current.undo()
        if (previous) {
          setFlow(previous.nodes, previous.edges)
          showToast('Undo', 'default')
        }
      }

      // Cmd/Ctrl + Shift + Z or Cmd/Ctrl + Y: Redo
      if (((e.metaKey || e.ctrlKey) && e.shiftKey && e.key === 'z') || ((e.metaKey || e.ctrlKey) && e.key === 'y')) {
        e.preventDefault()
        const next = historyRef.current.redo()
        if (next) {
          setFlow(next.nodes, next.edges)
          showToast('Redo', 'default')
        }
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [nodes, edges, selectedNodeIds, selectedEdgeIds, handleSaveDraft, handleExport, setFlow, showToast])

  return (
    <>
      {/* Toolbar */}
      <div className="flex items-center gap-2 p-2 border-b bg-card">
        <Button size="sm" variant="outline" onClick={handleFit}>Fit</Button>
        <Button size="sm" variant="outline" onClick={handleCenter}>Center</Button>
        <Button size="sm" variant="outline" onClick={handleExport}>Export JSON</Button>
        <Button size="sm" variant="outline" onClick={handleImport}>Import JSON</Button>
        <Button size="sm" variant="outline" onClick={handleValidate}>Validate Flow</Button>
        <Button 
          size="sm" 
          variant="outline" 
          onClick={handleSaveDraft}
          disabled={isSaving || nodes.length === 0}
        >
          {isSaving ? 'Saving...' : 'Save Draft'}
        </Button>
        <Button size="sm" variant="destructive" onClick={handleReset}>Reset</Button>
        <div className="ml-auto text-xs text-muted-foreground">
          <kbd className="px-1 py-0.5 bg-muted rounded">Del</kbd> / <kbd className="px-1 py-0.5 bg-muted rounded">Backspace</kbd> to delete • 
          <kbd className="px-1 py-0.5 bg-muted rounded">Ctrl+S</kbd> to save • 
          <kbd className="px-1 py-0.5 bg-muted rounded">Ctrl+E</kbd> to export
        </div>
      </div>

      {/* Canvas */}
      <div className="flex-1">
        <ReactFlow
          nodes={nodes}
          edges={edges}
          nodeTypes={nodeTypes}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={onConnect}
          onNodeDoubleClick={onNodeDoubleClick}
          onNodeClick={onNodeClick}
          onPaneClick={onPaneClick}
          onDragOver={(e) => {
            e.preventDefault()
            e.dataTransfer.dropEffect = 'move'
          }}
          onDrop={(e) => {
            e.preventDefault()
            const data = e.dataTransfer.getData('application/reactflow')
            if (!data) return
            try {
              const parsed = JSON.parse(data)
              const pos = rf.screenToFlowPosition({ x: e.clientX, y: e.clientY })
              
              // Check if node requires credentials
              const credStatus = checkNodeCredentials(parsed.kind)
              
              if (credStatus.requires && !credStatus.has) {
                showToast(
                  `⚠️ This node requires ${credStatus.typeName}. Configure it in Secrets Manager.`,
                  'warning',
                  6000
                )
              }
              
              const node = createNode(parsed.kind, { position: pos, data: { config: parsed.config } })
              upsertNode(node)
            } catch (err) {
              // ignore
            }
          }}
          connectionMode={ConnectionMode.Loose}
          fitView
          snapToGrid
          snapGrid={[15, 15]}
          deleteKeyCode={null} // We handle deletion manually with keyboard shortcuts
        >
          <Background />
          <MiniMap />
          <Controls />
        </ReactFlow>
      </div>
    </>
  )
}

export default function WorkflowCanvas() {
  return (
    <div className="flex flex-col h-full">
      <ReactFlowProvider>
        <WorkflowCanvasInner />
      </ReactFlowProvider>
    </div>
  )
}
