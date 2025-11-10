// @ts-nocheck
import { useState, useCallback } from 'react'
import { useNodes, useEdges, useSetFlow, useUpsertNode } from '@/store/app'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card } from '@/components/ui/card'
import { checkNodeCredentials } from '@/utils/credentials'
import { getNodeRole } from '@/workflow/graphTypes'
import { getDefaultLabel, createNode, calculateNextNodePosition } from '@/workflow/utils'

// Helper to get node label
function getNodeLabel(data) {
  if (data?.label && data.label.trim()) {
    return data.label
  }
  if (!data?.kind) {
    return 'Untitled Node'
  }
  return getDefaultLabel(data.kind) || data.kind
}

// Helper to get role badge color
function getRoleBadgeVariant(role) {
  switch (role) {
    case 'TRIGGER':
      return 'default'
    case 'ACTION':
      return 'secondary'
    case 'LOGIC':
      return 'outline'
    case 'AI':
      return 'destructive'
    default:
      return 'outline'
  }
}

interface SimpleFlowViewProps {
  onNodeSelect?: (node: any) => void
}

export default function SimpleFlowView({ onNodeSelect }: SimpleFlowViewProps) {
  const nodes = useNodes()
  const edges = useEdges()
  const setFlow = useSetFlow()
  const upsertNode = useUpsertNode()
  const [draggedNode, setDraggedNode] = useState<string | null>(null)
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null)
  const [isDraggingFromCatalog, setIsDraggingFromCatalog] = useState(false)

  // Sort nodes by their position in the flow (left to right)
  const sortedNodes = [...nodes].sort((a, b) => {
    const aX = a.position?.x || 0
    const bX = b.position?.x || 0
    return aX - bX
  })

  // Build flow order based on edges
  const flowOrder: any[] = []
  const processed = new Set<string>()

  // Find trigger node (usually first)
  const triggerNode = sortedNodes.find(n => n.data?.role === 'TRIGGER')
  if (triggerNode && !processed.has(triggerNode.id)) {
    flowOrder.push(triggerNode)
    processed.add(triggerNode.id)
  }

  // Follow edges to build flow
  let currentId = triggerNode?.id
  while (currentId) {
    const nextEdge = edges.find(e => e.source === currentId)
    if (!nextEdge) break
    
    const nextNode = sortedNodes.find(n => n.id === nextEdge.target)
    if (nextNode && !processed.has(nextNode.id)) {
      flowOrder.push(nextNode)
      processed.add(nextNode.id)
      currentId = nextNode.id
    } else {
      break
    }
  }

  // Add any remaining nodes
  sortedNodes.forEach(node => {
    if (!processed.has(node.id)) {
      flowOrder.push(node)
    }
  })

  const handleDragStart = useCallback((e: React.DragEvent, nodeId: string) => {
    setDraggedNode(nodeId)
    // Set a marker to distinguish from catalog drags
    e.dataTransfer.setData('text/plain', 'reorder') // Marker for reordering
    e.dataTransfer.effectAllowed = 'move'
  }, [])

  const handleDragOver = useCallback((e: React.DragEvent, index: number) => {
    // Only handle reordering if this is an existing node being dragged
    // If dragging from catalog, let the parent container handle it
    const isFromCatalog = e.dataTransfer.types.includes('application/reactflow')
    if (isFromCatalog) {
      return // Let parent handle catalog drops
    }
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
    setDragOverIndex(index)
  }, [])

  const handleDragLeave = useCallback(() => {
    setDragOverIndex(null)
  }, [])

  const handleDrop = useCallback((e: React.DragEvent, targetIndex: number) => {
    // Check if this is a catalog drop (new node) - if so, don't handle reordering
    const catalogData = e.dataTransfer.getData('application/reactflow')
    if (catalogData) {
      // This is a catalog drop, let parent handle it
      return
    }

    // Check if this is a reorder operation
    const reorderMarker = e.dataTransfer.getData('text/plain')
    if (reorderMarker !== 'reorder' || !draggedNode) {
      return
    }

    e.preventDefault()
    e.stopPropagation() // Prevent parent from handling

    const draggedNodeData = nodes.find(n => n.id === draggedNode)
    if (!draggedNodeData) return

    // Get current dragged node index
    const currentIndex = flowOrder.findIndex(n => n.id === draggedNode)
    if (currentIndex === -1 || currentIndex === targetIndex) {
      setDraggedNode(null)
      setDragOverIndex(null)
      return
    }

    // Calculate new positions for all nodes
    const baseX = 100
    const spacingX = 300
    const newNodes = nodes.map((node, idx) => {
      let newIndex = idx
      
      // Adjust indices based on drag operation
      if (currentIndex < targetIndex) {
        // Moving right
        if (idx > currentIndex && idx <= targetIndex) {
          newIndex = idx - 1
        } else if (idx === currentIndex) {
          newIndex = targetIndex
        }
      } else {
        // Moving left
        if (idx >= targetIndex && idx < currentIndex) {
          newIndex = idx + 1
        } else if (idx === currentIndex) {
          newIndex = targetIndex
        }
      }

      return {
        ...node,
        position: {
          x: baseX + (newIndex * spacingX),
          y: 100
        }
      }
    })

    // Rebuild edges to maintain linear flow
    const sortedNodes = [...newNodes].sort((a, b) => a.position.x - b.position.x)
    const newEdges = []
    
    for (let i = 0; i < sortedNodes.length - 1; i++) {
      newEdges.push({
        id: `edge_${sortedNodes[i].id}_${sortedNodes[i + 1].id}`,
        source: sortedNodes[i].id,
        target: sortedNodes[i + 1].id,
        type: 'default'
      })
    }

    setFlow(newNodes, newEdges)
    setDraggedNode(null)
    setDragOverIndex(null)
  }, [draggedNode, nodes, edges, flowOrder, setFlow])

  const handleNodeDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    const data = e.dataTransfer.getData('application/reactflow')
    if (!data) return
    
    try {
      const parsed = JSON.parse(data)
      
      // Check if node requires credentials
      const credStatus = checkNodeCredentials(parsed.kind)
      
      if (credStatus.requires && !credStatus.has) {
        // Show warning but still allow adding
        console.warn(`⚠️ This node requires ${credStatus.typeName}. Configure it in Secrets Manager.`)
      }
      
      // Calculate position for new node
      const position = calculateNextNodePosition(nodes)
      const node = createNode(parsed.kind, { 
        position, 
        data: { config: parsed.config } 
      })
      
      upsertNode(node)
    } catch (err) {
      console.error('Failed to add node:', err)
    }
  }, [nodes, upsertNode])

  if (flowOrder.length === 0) {
    return (
      <div 
        className="flex items-center justify-center h-full min-h-[400px] border-2 border-dashed border-muted rounded-lg"
        onDragOver={(e) => {
          e.preventDefault()
          e.dataTransfer.dropEffect = 'copy'
        }}
        onDrop={handleNodeDrop}
      >
        <div className="text-center p-8">
          <p className="text-muted-foreground text-lg mb-2">No workflow steps yet</p>
          <p className="text-sm text-muted-foreground">
            Drag nodes from the catalog here to get started
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="simple-flow-view p-6 space-y-4">
      <div className="mb-4">
        <h3 className="text-lg font-semibold mb-1">Your Workflow</h3>
        <p className="text-sm text-muted-foreground">
          Drag steps to reorder • Click to edit
        </p>
      </div>

      <div 
        className={`space-y-3 min-h-[200px] transition-colors ${
          isDraggingFromCatalog ? 'bg-primary/5 border-2 border-dashed border-primary rounded-lg p-4' : ''
        }`}
        onDragEnter={(e) => {
          // Check if dragging from catalog
          const isFromCatalog = e.dataTransfer.types.includes('application/reactflow')
          if (isFromCatalog) {
            setIsDraggingFromCatalog(true)
          }
        }}
        onDragLeave={(e) => {
          // Only clear if leaving the container (not just moving to a child)
          const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()
          const x = e.clientX
          const y = e.clientY
          if (x < rect.left || x > rect.right || y < rect.top || y > rect.bottom) {
            setIsDraggingFromCatalog(false)
          }
        }}
        onDragOver={(e) => {
          // Only handle if dragging from catalog
          const isFromCatalog = e.dataTransfer.types.includes('application/reactflow')
          if (isFromCatalog) {
            e.preventDefault()
            e.stopPropagation()
            e.dataTransfer.dropEffect = 'copy'
            setIsDraggingFromCatalog(true)
          }
        }}
        onDrop={(e) => {
          setIsDraggingFromCatalog(false)
          const data = e.dataTransfer.getData('application/reactflow')
          
          // Only handle if dropping a new node from catalog
          if (data) {
            e.preventDefault()
            e.stopPropagation()
            handleNodeDrop(e)
            return
          }
          
          // Otherwise, reordering is handled by individual node drop handlers
        }}
      >
        {flowOrder.map((node, index) => {
          const kind = node.data?.kind || ''
          const role = node.data?.role || getNodeRole(kind)
          const label = getNodeLabel(node.data)
          const hasMissingCreds = kind && checkNodeCredentials(kind).requires && 
                                  !checkNodeCredentials(kind).has
          const isDragging = draggedNode === node.id
          const isDragOver = dragOverIndex === index

          return (
            <div
              key={node.id}
              draggable
              onDragStart={(e) => {
                handleDragStart(e, node.id)
              }}
              onDragOver={(e) => {
                handleDragOver(e, index)
              }}
              onDragLeave={handleDragLeave}
              onDrop={(e) => {
                handleDrop(e, index)
              }}
              onClick={() => onNodeSelect?.(node)}
              className={`
                relative transition-all cursor-move
                ${isDragging ? 'opacity-50' : ''}
                ${isDragOver ? 'translate-x-2' : ''}
              `}
            >
              <Card
                className={`
                  p-4 border-2 hover:border-primary transition-colors
                  ${isDragOver ? 'border-primary bg-primary/5' : ''}
                `}
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3 flex-1">
                    {/* Step number */}
                    <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary/10 text-primary font-semibold flex items-center justify-center text-sm">
                      {index + 1}
                    </div>

                    {/* Node info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-medium text-sm">{label}</span>
                        <Badge variant={getRoleBadgeVariant(role)} className="text-xs">
                          {role}
                        </Badge>
                        {hasMissingCreds && (
                          <Badge variant="destructive" className="text-xs">
                            ⚠️ Needs Setup
                          </Badge>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {node.data?.kind || 'Unknown type'}
                      </p>
                    </div>
                  </div>

                  {/* Drag handle */}
                  <div className="flex-shrink-0 text-muted-foreground">
                    <svg
                      width="16"
                      height="16"
                      viewBox="0 0 16 16"
                      fill="none"
                      xmlns="http://www.w3.org/2000/svg"
                    >
                      <path
                        d="M6 4H10M6 8H10M6 12H10"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                      />
                    </svg>
                  </div>
                </div>
              </Card>

              {/* Arrow between steps */}
              {index < flowOrder.length - 1 && (
                <div className="flex justify-center my-2">
                  <div className="w-0.5 h-6 bg-border" />
                  <svg
                    width="20"
                    height="20"
                    viewBox="0 0 20 20"
                    fill="none"
                    className="text-border"
                  >
                    <path
                      d="M10 15L5 10L10 5"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                  <div className="w-0.5 h-6 bg-border" />
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* Summary */}
      <div className="mt-6 p-4 bg-muted/50 rounded-lg">
        <p className="text-sm text-muted-foreground">
          <strong>{flowOrder.length}</strong> step{flowOrder.length !== 1 ? 's' : ''} in this workflow
        </p>
      </div>
    </div>
  )
}

