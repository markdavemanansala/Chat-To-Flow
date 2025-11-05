import { useEffect } from 'react'
import ReactFlow, {
  Background,
  Controls,
  MiniMap,
  useNodesState,
  useEdgesState,
  ConnectionMode,
} from 'reactflow'
import 'reactflow/dist/style.css'
import './WorkflowBuilder.css'

import { Button } from './ui/button'

export function WorkflowPreview({ workflow, nodes, edges, onOpenBuilder }) {
  const [rfNodes, setNodes, onNodesChange] = useNodesState([])
  const [rfEdges, setEdges, onEdgesChange] = useEdgesState([])

  useEffect(() => {
    if (nodes && nodes.length > 0) {
      setNodes(nodes)
      setEdges(edges)
    } else if (workflow && workflow.steps) {
      // Convert workflow summary to visual nodes
      const converted = convertToFlowNodes(workflow)
      setNodes(converted.nodes)
      setEdges(converted.edges)
    }
  }, [workflow, nodes, edges, setNodes, setEdges])

  if (!workflow && (!nodes || nodes.length === 0)) {
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
    <div className="relative h-full w-full">
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

