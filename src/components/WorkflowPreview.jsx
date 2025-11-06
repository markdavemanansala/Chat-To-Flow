import { useEffect, useRef } from 'react'
import ReactFlow, {
  Background,
  Controls,
  MiniMap,
  ConnectionMode,
  ReactFlowProvider,
  useReactFlow,
  useNodesState,
  useEdgesState,
} from 'reactflow'
import 'reactflow/dist/style.css'
import './WorkflowBuilder.css'

import { Button } from './ui/button'

// Inner component that uses React Flow hooks
function WorkflowPreviewInner({ workflow, nodes, edges, onOpenBuilder }) {
  const { fitView } = useReactFlow()
  
  // Use React Flow's internal state for smooth rendering
  const [rfNodes, setRfNodes, onNodesChange] = useNodesState([])
  const [rfEdges, setRfEdges, onEdgesChange] = useEdgesState([])
  
  // Track previous node/edge IDs and array references to detect ALL changes
  const prevNodeIdsRef = useRef('')
  const prevEdgeIdsRef = useRef('')
  const prevNodesArrayRef = useRef(null)
  const prevEdgesArrayRef = useRef(null)
  
  // Determine what nodes/edges to display - compute directly, don't memoize
  // This ensures we always get the latest values
  const sourceNodes = nodes !== undefined ? nodes : (workflow ? convertToFlowNodes(workflow).nodes : [])
  const sourceEdges = edges !== undefined ? edges : (workflow ? convertToFlowNodes(workflow).edges : [])
  
  // Sync store/props to React Flow state when ANY change is detected
  // Depend on nodes/edges/workflow props directly, not computed values
  useEffect(() => {
    const currentNodeIds = sourceNodes.map(n => n.id).sort().join(',')
    const currentEdgeIds = sourceEdges.map(e => e.id).sort().join(',')
    
    // Check BOTH array reference changes AND structure changes
    const nodesArrayChanged = sourceNodes !== prevNodesArrayRef.current
    const edgesArrayChanged = sourceEdges !== prevEdgesArrayRef.current
    const nodesChanged = currentNodeIds !== prevNodeIdsRef.current
    const edgesChanged = currentEdgeIds !== prevEdgeIdsRef.current
    
    // Update if ANY change detected (array ref OR structure)
    if (nodesArrayChanged || edgesArrayChanged || nodesChanged || edgesChanged || prevNodeIdsRef.current === '') {
      console.log('🔄 WorkflowPreview: Syncing to React Flow', {
        nodesCount: sourceNodes.length,
        edgesCount: sourceEdges.length,
        nodeIds: sourceNodes.map(n => n.id),
        nodesArrayChanged,
        edgesArrayChanged,
        nodesChanged,
        edgesChanged,
        propsNodes: nodes?.length,
        propsEdges: edges?.length
      })
      
      // Update React Flow state - create new array references
      setRfNodes([...sourceNodes])
      setRfEdges([...sourceEdges])
      
      // Update ALL refs
      prevNodesArrayRef.current = sourceNodes
      prevEdgesArrayRef.current = sourceEdges
      prevNodeIdsRef.current = currentNodeIds
      prevEdgeIdsRef.current = currentEdgeIds
      
      // Fit view after update
      if (sourceNodes.length > 0) {
        setTimeout(() => {
          fitView({ padding: 0.2, duration: 300 })
        }, 100)
      }
    }
  }, [nodes, edges, workflow, setRfNodes, setRfEdges, fitView, sourceNodes, sourceEdges])

  if (rfNodes.length === 0) {
    return (
      <div className="flex items-center justify-center h-full text-muted-foreground">
        <p className="text-center">
          Describe your automation in chat
          <br />
          <span className="text-xs">The workflow will appear here</span>
        </p>
      </div>
    )
  }

  return (
    <>
      <ReactFlow
        nodes={rfNodes}
        edges={rfEdges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        connectionMode={ConnectionMode.Loose}
        fitView
        nodesDraggable={false}
        nodesConnectable={false}
        elementsSelectable={false}
        proOptions={{ hideAttribution: true }}
      >
        <Background />
        <MiniMap />
      </ReactFlow>
      
      {onOpenBuilder && (
        <div className="absolute top-4 right-4 z-10">
          <Button size="sm" onClick={onOpenBuilder} variant="outline">
            Open Builder
          </Button>
        </div>
      )}
    </>
  )
}

// Main component with ReactFlowProvider
export function WorkflowPreview({ workflow, nodes, edges, onOpenBuilder }) {
  return (
    <div className="relative h-full w-full">
      <ReactFlowProvider>
        <WorkflowPreviewInner
          workflow={workflow}
          nodes={nodes}
          edges={edges}
          onOpenBuilder={onOpenBuilder}
        />
      </ReactFlowProvider>
    </div>
  )
}

// Convert workflow summary to visual nodes
function convertToFlowNodes(workflow) {
  const nodes = []
  const edges = []

  if (!workflow || !workflow.steps) {
    return { nodes, edges }
  }

  // Create trigger node if exists
  if (workflow.trigger && workflow.trigger !== 'Manual trigger') {
    const triggerNode = {
      id: 'trigger_0',
      type: 'default',
      position: { x: 100, y: 50 },
      data: {
        kind: 'trigger',
        label: workflow.trigger,
        config: {},
      },
      style: { background: '#e3f2fd', color: '#1565c0' },
    }
    nodes.push(triggerNode)
  }

  // Create step nodes
  workflow.steps.forEach((step, index) => {
    const node = {
      id: `step_${index}`,
      type: 'default',
      position: { x: 100 + index * 250, y: workflow.trigger !== 'Manual trigger' ? 150 : 50 },
      data: {
        kind: 'action',
        label: step,
        config: {},
      },
    }
    nodes.push(node)
  })

  // Connect nodes
  for (let i = 0; i < nodes.length - 1; i++) {
    edges.push({
      id: `edge_${i}`,
      source: nodes[i].id,
      target: nodes[i + 1].id,
      type: 'default',
      animated: true,
    })
  }

  return { nodes, edges }
}
