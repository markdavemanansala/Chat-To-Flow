// @ts-nocheck
import { useCallback, useEffect, useState, useRef, useMemo } from 'react'
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
  useNodesState,
  useEdgesState,
  Handle,
  Position,
} from 'reactflow'
import 'reactflow/dist/style.css'
import './WorkflowCanvas.css'

import { Button } from '@/components/ui/button'
import { useNodes, useEdges, useSetFlow, useSetEdges, useResetFlow, useWorkflowSummary, useUpsertNode, useSetWorkflow, useValidateGraph, useOnPatchApplied, useAppStore } from '@/store/app'
import { convertWorkflowToFlow } from '@/components/WorkflowBuilder'
import { createNode } from '@/workflow/utils'
import { useToast } from '@/components/ToastProvider'
import { saveWorkflowDraft } from '@/lib/api'
import { Badge } from '@/components/ui/badge'
import { checkNodeCredentials } from '@/utils/credentials'
import SimpleFlowView from './SimpleFlowView'

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
function CustomNode({ data, selected, id }) {
  const [hasMissingCreds, setHasMissingCreds] = useState(false)
  const [showTooltip, setShowTooltip] = useState(false)
  const [helpText, setHelpText] = useState('')
  const [highlighted, setHighlighted] = useState(false)
  
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

  // Check if this node should be highlighted
  useEffect(() => {
    const checkHighlight = () => {
      try {
        const highlightedNodesStr = sessionStorage.getItem('highlightedNodes');
        if (highlightedNodesStr) {
          const highlightedNodes = new Set(JSON.parse(highlightedNodesStr));
          setHighlighted(highlightedNodes.has(id));
        } else {
          setHighlighted(false);
        }
      } catch (e) {
        setHighlighted(false);
      }
    };
    
    checkHighlight();
    const interval = setInterval(checkHighlight, 100);
    return () => clearInterval(interval);
  }, [id]);

  return (
    <div 
      className={`relative px-4 py-2 shadow-md rounded-md bg-card border-2 transition-all ${
        highlighted ? 'border-green-500 shadow-lg ring-2 ring-green-300 animate-pulse' : 
        selected ? 'border-primary' : 'border-border'
      }`}
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

// Create node types - static to prevent React Flow warnings
// Highlighting is handled inside CustomNode via props
// Define nodeTypes outside component to prevent recreation on each render
const nodeTypes = {
  default: CustomNode,
};

interface WorkflowCanvasInnerProps {
  onNodeSelect?: (node: any) => void
}

/**
 * WorkflowCanvasInner - Main canvas component for workflow visualization
 * Uses React Flow's internal state management and syncs with Zustand store
 * 
 * @param {Object} props - Component props
 * @param {Function} props.onNodeSelect - Callback when a node is selected
 */
function WorkflowCanvasInner({ onNodeSelect }: WorkflowCanvasInnerProps) {
  // Store state - Zustand store (source of truth for persistence)
  const storeNodes = useNodes()
  const storeEdges = useEdges()
  const workflowSummary = useWorkflowSummary()
  const setFlow = useSetFlow()
  const resetFlow = useResetFlow()
  const upsertNode = useUpsertNode()
  const setWorkflow = useSetWorkflow()
  const { showToast } = useToast()
  
  // React Flow internal state - for smooth UI interactions
  const [rfNodes, setRfNodes, onNodesChange] = useNodesState([])
  const [rfEdges, setRfEdges, onEdgesChange] = useEdgesState([])
  
  // Local UI state
  const [selectedNodeIds, setSelectedNodeIds] = useState(new Set())
  const [selectedEdgeIds, setSelectedEdgeIds] = useState(new Set())
  const [isSaving, setIsSaving] = useState(false)
  const [highlightedNodes, setHighlightedNodes] = useState(new Set())
  const [viewMode, setViewMode] = useState<'flow' | 'simple'>('simple') // Default to simple view
  const autosaveTimerRef = useRef(null)
  const lastSavedRef = useRef(null)
  const positionDebounceTimerRef = useRef(null)
  const prevNodeIdsRef = useRef('')
  const prevEdgeIdsRef = useRef('')

  const rf = useReactFlow()

  const validateGraph = useValidateGraph()
  const onPatchApplied = useOnPatchApplied()

  /**
   * Initialize nodes/edges from workflowSummary if store is empty
   * This ensures templates and initial workflows load correctly
   */
  useEffect(() => {
    if (storeNodes.length === 0 && storeEdges.length === 0 && workflowSummary) {
      const { nodes: convertedNodes, edges: convertedEdges } = convertWorkflowToFlow(workflowSummary)
      if (convertedNodes.length > 0) {
        setFlow(convertedNodes, convertedEdges)
      }
    }
  }, [storeNodes.length, storeEdges.length, workflowSummary, setFlow])

  /**
   * Sync Zustand store to React Flow internal state
   * This ensures React Flow displays the latest nodes/edges from the store
   */
  useEffect(() => {
    const currentNodeIds = storeNodes.map(n => n.id).sort().join(',')
    const currentEdgeIds = storeEdges.map(e => `${e.id}:${e.source}->${e.target}`).sort().join(',')
    
    const nodesChanged = currentNodeIds !== prevNodeIdsRef.current
    const edgesChanged = currentEdgeIds !== prevEdgeIdsRef.current
    
    if (nodesChanged || edgesChanged || prevNodeIdsRef.current === '') {
      console.log('🔄 Syncing store to React Flow:', {
        nodesCount: storeNodes.length,
        edgesCount: storeEdges.length,
        nodeIds: storeNodes.map(n => n.id)
      })
      
      // Update React Flow state with new array references
      setRfNodes([...storeNodes])
      setRfEdges([...storeEdges])
      
      prevNodeIdsRef.current = currentNodeIds
      prevEdgeIdsRef.current = currentEdgeIds
      
      // Fit view after update
      if (storeNodes.length > 0) {
        setTimeout(() => {
          rf.fitView({ padding: 0.2, duration: 300 })
        }, 100)
      }
    }
  }, [storeNodes, storeEdges, setRfNodes, setRfEdges, rf])


  // Highlight nodes when patches are applied
  useEffect(() => {
    const unsubscribe = onPatchApplied(({ patch, result }) => {
      if (result.ok && patch) {
        const changedIds = new Set()
        
        if (patch.op === 'ADD_NODE' && patch.node) {
          changedIds.add(patch.node.id)
        } else if (patch.op === 'UPDATE_NODE' && patch.id) {
          changedIds.add(patch.id)
        } else if (patch.op === 'REMOVE_NODE' && patch.id) {
          // Node removed, highlight surrounding nodes
          const node = storeNodes.find(n => n.id === patch.id)
          if (node) {
            storeEdges.filter(e => e.source === patch.id || e.target === patch.id).forEach(e => {
              if (e.source !== patch.id) changedIds.add(e.source)
              if (e.target !== patch.id) changedIds.add(e.target)
            })
          }
        } else if (patch.op === 'BULK' && patch.ops) {
          patch.ops.forEach(op => {
            if (op.op === 'ADD_NODE' && op.node) changedIds.add(op.node.id)
            if (op.op === 'UPDATE_NODE' && op.id) changedIds.add(op.id)
          })
        }
        
        if (changedIds.size > 0) {
          setHighlightedNodes(changedIds)
          setTimeout(() => setHighlightedNodes(new Set()), 2000)
        }
      }
    })
    
    return unsubscribe
  }, [storeNodes, storeEdges, onPatchApplied])

  // Define handleAutoSave before using it
  const handleAutoSave = useCallback(async () => {
    if (storeNodes.length === 0) return
    const currentState = JSON.stringify({ nodes: storeNodes, edges: storeEdges })
    if (currentState === lastSavedRef.current) return

    try {
      const triggerNode = storeNodes.find(n => n.data?.kind?.startsWith('trigger'))
      const actionNodes = storeNodes.filter(n => n.data?.kind?.startsWith('action'))
      
      const summary = {
        name: workflowSummary?.name || 'Untitled Workflow',
        trigger: triggerNode?.data?.label || 'Manual Trigger',
        steps: actionNodes.map(n => n.data?.label || n.data?.kind || 'Unknown'),
        integrations: Array.from(new Set(
          storeNodes
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
        notes: workflowSummary?.notes || `Workflow with ${storeNodes.length} nodes`,
        source: 'chat',
      }

      await saveWorkflowDraft(summary)
      setWorkflow(summary)
      lastSavedRef.current = JSON.stringify({ nodes: storeNodes, edges: storeEdges })
      showToast('Saved', 'success')
    } catch (err) {
      console.error('Autosave failed', err)
    }
  }, [storeNodes, storeEdges, workflowSummary, setWorkflow, showToast])

  // Autosave functionality
  useEffect(() => {
    if (storeNodes.length === 0) return

    const currentState = JSON.stringify({ nodes: storeNodes, edges: storeEdges })
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
  }, [storeNodes, storeEdges, handleAutoSave])

  // Track selected nodes/edges
  useEffect(() => {
    const selectedNodes = rfNodes.filter(n => n.selected).map(n => n.id)
    const selectedEdges = rfEdges.filter(e => e.selected).map(e => e.id)
    setSelectedNodeIds(new Set(selectedNodes))
    setSelectedEdgeIds(new Set(selectedEdges))
  }, [rfNodes, rfEdges])

  /**
   * Handle node changes from React Flow
   * Syncs changes to the store while preventing infinite loops
   * Position changes are debounced to avoid excessive updates
   */
  /**
   * Handle node changes from React Flow (manual edits)
   * React Flow handles its own state, we sync back to Zustand store
   * 
   * @param {Array} changes - React Flow change array
   */
  const handleNodesChange = useCallback((changes) => {
    // Let React Flow update its internal state first
    onNodesChange(changes)
    
    // Then sync back to Zustand store (debounced for position changes)
    const significantChanges = changes.filter(c => 
      c.type !== 'select' && c.type !== 'position'
    )
    const positionChanges = changes.filter(c => c.type === 'position')
    
    if (significantChanges.length > 0) {
      // Immediate update for structural changes
      const next = applyNodeChanges(changes, rfNodes)
      setFlow(next, rfEdges)
    } else if (positionChanges.length > 0) {
      // Debounced update for position changes
      if (positionDebounceTimerRef.current) {
        clearTimeout(positionDebounceTimerRef.current)
      }
      positionDebounceTimerRef.current = setTimeout(() => {
        const next = applyNodeChanges(changes, rfNodes)
        setFlow(next, rfEdges)
        positionDebounceTimerRef.current = null
      }, 300)
    }
  }, [rfNodes, rfEdges, setFlow, onNodesChange, positionDebounceTimerRef])
  
  /**
   * Handle edge changes from React Flow (manual edits)
   * React Flow handles its own state, we sync back to Zustand store
   * 
   * @param {Array} changes - React Flow edge change array
   */
  const handleEdgesChange = useCallback((changes) => {
    // Let React Flow update its internal state first
    onEdgesChange(changes)
    
    // Then sync back to Zustand store
    const next = applyEdgeChanges(changes, rfEdges)
    setFlow(rfNodes, next)
  }, [rfNodes, rfEdges, setFlow, onEdgesChange])
  
  /**
   * Handle new edge connections from React Flow
   * Updates store directly
   * 
   * @param {Object} params - Connection parameters from React Flow
   */
  const onConnect = useCallback((params) => {
    const next = addEdge(params, rfEdges)
    setRfEdges(next)
    setFlow(rfNodes, next)
  }, [rfNodes, rfEdges, setRfEdges, setFlow])

  const handleFit = useCallback(() => {
    rf.fitView({ padding: 0.2, duration: 300 })
  }, [rf])

  const handleCenter = useCallback(() => {
    rf.setViewport({ x: 0, y: 0, zoom: 1 }, { duration: 300 })
  }, [rf])

  const handleExport = useCallback(() => {
    const data = { nodes: storeNodes, edges: storeEdges }
    const json = JSON.stringify(data, null, 2)
    const blob = new Blob([json], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'workflow.json'
    a.click()
    URL.revokeObjectURL(url)
    showToast('Workflow exported successfully', 'success')
  }, [storeNodes, storeEdges, showToast])

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
    const result = validateGraph()
    if (result.ok) {
      showToast('Workflow is valid!', 'success')
    } else {
      showToast(`Validation issues: ${result.issues?.join(', ')}`, 'error')
    }
  }, [validateGraph, showToast])

  const handleSaveDraft = useCallback(async () => {
    if (storeNodes.length === 0) {
      showToast('No workflow to save', 'error')
      return
    }

    setIsSaving(true)
    try {
      // Convert nodes/edges to workflow summary format
      const triggerNode = storeNodes.find(n => n.data?.kind?.startsWith('trigger'))
      const actionNodes = storeNodes.filter(n => n.data?.kind?.startsWith('action'))
      
      const summary = {
        name: workflowSummary?.name || 'Untitled Workflow',
        trigger: triggerNode?.data?.label || 'Manual Trigger',
        steps: actionNodes.map(n => n.data?.label || n.data?.kind || 'Unknown'),
        integrations: Array.from(new Set(
          storeNodes
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
        notes: workflowSummary?.notes || `Workflow with ${storeNodes.length} nodes`,
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
  }, [storeNodes, workflowSummary, setWorkflow, showToast])

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
    const next = storeNodes.map((n) => n.id === node.id ? { ...n, data: { ...n.data, label: newLabel } } : n)
    setFlow(next, storeEdges)
  }, [storeNodes, storeEdges, setFlow])

  const handleRenameNode = useCallback((node, newLabel) => {
    const next = storeNodes.map((n) => n.id === node.id ? { ...n, data: { ...n.data, label: newLabel } } : n)
    setFlow(next, storeEdges)
  }, [storeNodes, storeEdges, setFlow])

  // Keyboard shortcuts
  useEffect(() => {
    const onKeyDown = (e) => {
      // Delete/Backspace: Remove selected nodes and edges
      if (e.key === 'Delete' || e.key === 'Backspace') {
        const remainingNodes = storeNodes.filter(n => !selectedNodeIds.has(n.id))
        const remainingEdges = storeEdges.filter(e => !selectedEdgeIds.has(e.id))
        setFlow(remainingNodes, remainingEdges)
        showToast('Deleted selection', 'success')
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
        const undo = useAppStore.getState().undo
        if (undo()) {
          showToast('Undo', 'default')
        }
      }

      // Cmd/Ctrl + Shift + Z or Cmd/Ctrl + Y: Redo
      if (((e.metaKey || e.ctrlKey) && e.shiftKey && e.key === 'z') || ((e.metaKey || e.ctrlKey) && e.key === 'y')) {
        e.preventDefault()
        const redo = useAppStore.getState().redo
        if (redo()) {
          showToast('Redo', 'default')
        }
      }
    }

    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [storeNodes, storeEdges, selectedNodeIds, selectedEdgeIds, handleSaveDraft, handleExport, setFlow, showToast])

  return (
    <>
      {/* Toolbar - Workflow manipulation controls */}
      <div className="workflow-toolbar">
        {/* View Mode Toggle */}
        <div className="flex items-center gap-2 mr-4 border-r pr-4">
          <Button
            size="sm"
            variant={viewMode === 'simple' ? 'default' : 'outline'}
            onClick={() => setViewMode('simple')}
          >
            📋 Simple View
          </Button>
          <Button
            size="sm"
            variant={viewMode === 'flow' ? 'default' : 'outline'}
            onClick={() => setViewMode('flow')}
          >
            🗺️ Flow View
          </Button>
        </div>

        {viewMode === 'flow' && (
          <>
            <Button size="sm" variant="outline" onClick={handleFit}>Fit</Button>
            <Button size="sm" variant="outline" onClick={handleCenter}>Center</Button>
          </>
        )}
        <Button size="sm" variant="outline" onClick={handleExport}>Export JSON</Button>
        <Button size="sm" variant="outline" onClick={handleImport}>Import JSON</Button>
        <Button size="sm" variant="outline" onClick={handleValidate}>Validate Flow</Button>
        <Button 
          size="sm" 
          variant="outline" 
          onClick={handleSaveDraft}
          disabled={isSaving || storeNodes.length === 0}
        >
          {isSaving ? 'Saving...' : 'Save Draft'}
        </Button>
        <Button size="sm" variant="destructive" onClick={handleReset}>Reset</Button>
        {viewMode === 'flow' && (
          <div className="workflow-toolbar-help">
            <kbd className="px-1 py-0.5 bg-muted rounded">Del</kbd> / <kbd className="px-1 py-0.5 bg-muted rounded">Backspace</kbd> to delete • 
            <kbd className="px-1 py-0.5 bg-muted rounded">Ctrl+S</kbd> to save • 
            <kbd className="px-1 py-0.5 bg-muted rounded">Ctrl+E</kbd> to export
          </div>
        )}
      </div>

      {/* Canvas - Conditional rendering based on view mode */}
      {viewMode === 'simple' ? (
        <div className="workflow-canvas-wrapper" style={{ minHeight: '500px' }}>
          <SimpleFlowView onNodeSelect={onNodeSelect} />
        </div>
      ) : (
        <div className="workflow-canvas-wrapper">
        <ReactFlow
          nodes={rfNodes}
          edges={rfEdges}
          nodeTypes={nodeTypes}
          onNodesChange={handleNodesChange}
          onEdgesChange={handleEdgesChange}
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
          deleteKeyCode="Delete"
          nodesDraggable={true}
          nodesConnectable={true}
          elementsSelectable={true}
        >
          <Background />
          <MiniMap />
          <Controls />
        </ReactFlow>
        </div>
      )}
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
