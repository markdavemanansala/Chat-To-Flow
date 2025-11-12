// @ts-nocheck
import { useState, useCallback, useEffect } from 'react'
import { useNodes, useEdges, useSetFlow, useApplyPatch } from '@/store/graphStore'
import { useSetSelectedNodeId } from '@/store/uiStore'
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

export default function SimpleCanvas() {
  const setSelectedNodeId = useSetSelectedNodeId()
  const nodes = useNodes()
  const edges = useEdges()
  const setFlow = useSetFlow()
  const applyPatch = useApplyPatch()
  const [draggedNode, setDraggedNode] = useState<string | null>(null)
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null)
  const [isDraggingFromCatalog, setIsDraggingFromCatalog] = useState(false)
  const [touchDragActive, setTouchDragActive] = useState(false)

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
    const types = Array.from(e.dataTransfer.types)
    const hasCatalogData = types.includes('application/reactflow') || 
                          (types.includes('text/plain') && !e.dataTransfer.getData('text/plain').includes('reorder'))
    
    if (hasCatalogData) {
      // This is a catalog drop, let parent handle it - don't prevent default
      console.log('🎯 Node card detected catalog drop, letting parent handle')
      return
    }

    // Check if this is a reorder operation
    const reorderMarker = e.dataTransfer.getData('text/plain')
    if (reorderMarker !== 'reorder' || !draggedNode) {
      return
    }

    e.preventDefault()
    e.stopPropagation() // Prevent parent from handling only for reorder

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

  const handleNodeDrop = useCallback((e: React.DragEvent | CustomEvent) => {
    if (e instanceof Event) {
      e.preventDefault()
      e.stopPropagation()
    }
    
    let data: string | null = null
    
    // Handle both drag events and custom mobile events
    // Check for React.DragEvent (has nativeEvent property) or native DragEvent
    if ('dataTransfer' in e && e.dataTransfer) {
      console.log('🎯 SimpleCanvas handleNodeDrop fired (desktop)')
      console.log('🎯 DataTransfer types:', Array.from(e.dataTransfer.types))
      // Try both data types
      data = e.dataTransfer.getData('application/reactflow') || e.dataTransfer.getData('text/plain') || null
      console.log('🎯 Retrieved data:', data)
    } else if (e instanceof CustomEvent && e.detail) {
      console.log('🎯 SimpleCanvas handleNodeDrop fired (mobile)')
      data = e.detail
    }
    
    console.log('🎯 Drag data in SimpleCanvas:', data)
    
    if (!data) {
      console.log('No drag data found in SimpleCanvas - might be reorder drag')
      return
    }
    
    // Check if it's just the kind string (text/plain fallback)
    if (data && !data.startsWith('{')) {
      // It's just the kind, reconstruct the payload
      try {
        const { DEFAULT_CONFIGS } = require('@/workflow/nodeCatalog')
        data = JSON.stringify({ kind: data, config: DEFAULT_CONFIGS[data] || {} })
        console.log('🎯 Reconstructed payload from kind:', data)
      } catch (err) {
        console.error('Failed to reconstruct payload:', err)
        return
      }
    }
    
    try {
      const parsed = JSON.parse(data)
      console.log('🎯 Parsed node data in SimpleCanvas:', parsed)
      
      // Check if node requires credentials
      const credStatus = checkNodeCredentials(parsed.kind)
      
      if (credStatus.requires && !credStatus.has) {
        // Show warning but still allow adding
        console.warn(`⚠️ This node requires ${credStatus.typeName}. Configure it in Secrets Manager.`)
      }
      
      // Calculate position for new node
      const position = calculateNextNodePosition(nodes)
      console.log('🎯 Calculated position in SimpleCanvas:', position)
      
      const node = createNode(parsed.kind, { 
        position, 
        data: { 
          config: parsed.config 
        } 
      })
      console.log('🎯 Created node in SimpleCanvas:', node)
      
      const result = applyPatch({ op: 'ADD_NODE', node })
      console.log('🎯 Patch result in SimpleCanvas:', result)
      
      if (!result.ok) {
        console.error('❌ Failed to add node in SimpleCanvas:', result.issues)
      } else {
        console.log('✅ Patch succeeded in SimpleCanvas, nodes should appear')
        setTouchDragActive(false)
      }
    } catch (err: any) {
      console.error('❌ Error in SimpleCanvas handleNodeDrop:', err)
      setTouchDragActive(false)
    }
  }, [nodes, applyPatch])
  
  // Listen for mobile drag events
  useEffect(() => {
    const handleMobileDrop = (e: Event) => {
      if (e instanceof CustomEvent && e.type === 'mobile-node-drop' && e.detail) {
        e.preventDefault()
        e.stopPropagation()
        handleNodeDrop(e)
        setTouchDragActive(false)
      }
    }
    
    // Listen on document for mobile drops
    document.addEventListener('mobile-node-drop', handleMobileDrop)
    return () => {
      document.removeEventListener('mobile-node-drop', handleMobileDrop)
    }
  }, [handleNodeDrop])

  if (flowOrder.length === 0) {
    return (
      <div 
        className="flex items-center justify-center h-full w-full border-2 border-dashed border-muted/50 rounded-xl bg-muted/20 hover:border-primary/30 hover:bg-muted/30 transition-all duration-200 touch-none"
        onDragOver={(e) => {
          e.preventDefault()
          e.stopPropagation()
          e.dataTransfer.dropEffect = 'copy'
        }}
        onDrop={(e) => {
          e.preventDefault()
          e.stopPropagation()
          handleNodeDrop(e)
        }}
        onTouchEnd={(e) => {
          // Visual feedback - the actual drop is handled by the event listener
          setTouchDragActive(false)
        }}
      >
        <div className="text-center p-6 sm:p-12 max-w-md">
          <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-primary/10 flex items-center justify-center">
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-primary">
              <path d="M12 5v14M5 12h14"/>
            </svg>
          </div>
          <p className="text-foreground font-semibold text-lg sm:text-xl mb-2">No workflow steps yet</p>
          <p className="text-sm sm:text-base text-muted-foreground">
            Drag nodes from the catalog here to get started
          </p>
        </div>
      </div>
    )
  }

  return (
    <div 
      className="simple-flow-view h-full w-full overflow-y-auto overflow-x-hidden p-4 sm:p-6 space-y-4 sm:space-y-5 touch-none"
      onDragOver={(e) => {
        e.preventDefault()
        e.stopPropagation()
        // Check if dragging from catalog
        const types = Array.from(e.dataTransfer.types)
        if (types.includes('application/reactflow') || types.includes('text/plain')) {
          e.dataTransfer.dropEffect = 'copy'
          setIsDraggingFromCatalog(true)
        } else {
          e.dataTransfer.dropEffect = 'move'
          setIsDraggingFromCatalog(false)
        }
      }}
      onDragLeave={(e) => {
        // Only clear if leaving the container entirely
        const relatedTarget = e.relatedTarget as HTMLElement | null
        if (!relatedTarget || !e.currentTarget.contains(relatedTarget)) {
          setIsDraggingFromCatalog(false)
        }
      }}
      onDrop={(e) => {
        e.preventDefault()
        e.stopPropagation()
        setIsDraggingFromCatalog(false)
        console.log('🎯 onDrop fired in SimpleCanvas main container')
        console.log('🎯 DataTransfer types:', Array.from(e.dataTransfer.types))
        handleNodeDrop(e)
      }}
      onTouchEnd={(e) => {
        // Visual feedback - the actual drop is handled by the event listener
        setTouchDragActive(false)
      }}
    >
      <div className="mb-4 sm:mb-5">
        <h3 className="text-lg sm:text-xl font-bold mb-1.5 bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text text-transparent">
          Your Workflow
        </h3>
        <p className="text-xs sm:text-sm text-muted-foreground">
          Drag steps to reorder • Click to edit
        </p>
      </div>

      <div 
        className={`space-y-2 sm:space-y-3 transition-colors ${
          isDraggingFromCatalog ? 'bg-primary/5 border-2 border-dashed border-primary rounded-lg p-3 sm:p-4' : ''
        }`}
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
                // Check if dragging from catalog - if so, don't handle (let parent handle)
                const types = Array.from(e.dataTransfer.types)
                // Catalog drops have 'application/reactflow' type, reorder has 'text/plain' with 'reorder' marker
                const isFromCatalog = types.includes('application/reactflow')
                // If it's a reorder (has 'reorder' marker), we'll know in onDrop
                if (isFromCatalog) {
                  // Let parent handle catalog drops
                  return
                }
                // For reorder, check if we have the draggedNode state
                if (draggedNode) {
                  handleDragOver(e, index)
                }
              }}
              onDragLeave={handleDragLeave}
              onDrop={(e) => {
                // Check if dragging from catalog - if so, don't handle (let parent handle)
                const types = Array.from(e.dataTransfer.types)
                const catalogData = e.dataTransfer.getData('application/reactflow')
                const textData = e.dataTransfer.getData('text/plain')
                const isFromCatalog = catalogData || (textData && textData !== 'reorder')
                
                if (isFromCatalog) {
                  // Let parent handle catalog drops - don't prevent default
                  console.log('🎯 Node card onDrop: catalog drop detected, letting parent handle')
                  return
                }
                handleDrop(e, index)
              }}
              onClick={() => setSelectedNodeId(node.id)}
              className={`
                relative transition-all cursor-move
                ${isDragging ? 'opacity-50' : ''}
                ${isDragOver ? 'translate-x-2' : ''}
              `}
            >
              <Card
                className={`
                  p-4 sm:p-5 border-2 transition-all duration-300 shadow-lg hover:shadow-xl
                  ${isDragOver 
                    ? 'border-primary bg-gradient-to-br from-primary/10 to-primary/5 shadow-2xl shadow-primary/30 scale-[1.02] ring-2 ring-primary/20' 
                    : 'border-border/50 hover:border-primary/60 bg-gradient-to-br from-card to-card/50 hover:from-card hover:to-primary/5'
                  }
                  ${isDragging ? 'opacity-50 scale-95' : ''}
                `}
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    {/* Step number */}
                    <div className="flex-shrink-0 w-9 h-9 rounded-lg bg-gradient-to-br from-primary/20 to-primary/10 text-primary font-bold flex items-center justify-center text-sm shadow-sm border border-primary/20">
                      {index + 1}
                    </div>

                    {/* Node info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        <span className="font-semibold text-sm text-foreground">{label}</span>
                        <Badge variant={getRoleBadgeVariant(role)} className="text-[10px] px-1.5 py-0 font-medium shadow-sm">
                          {role}
                        </Badge>
                        {hasMissingCreds && (
                          <div className="flex items-center gap-1" title="Requires API key">
                            <svg width="12" height="12" viewBox="0 0 16 16" fill="none" className="text-blue-600 dark:text-blue-400">
                              <path d="M8 1C4.13 1 1 4.13 1 8s3.13 7 7 7 7-3.13 7-7-3.13-7-7-7zm0 12c-2.76 0-5-2.24-5-5s2.24-5 5-5 5 2.24 5 5-2.24 5-5 5z" fill="currentColor"/>
                              <path d="M8 4.5c-.28 0-.5.22-.5.5v3c0 .28.22.5.5.5s.5-.22.5-.5V5c0-.28-.22-.5-.5-.5zM8 11c-.28 0-.5.22-.5.5s.22.5.5.5.5-.22.5-.5-.22-.5-.5-.5z" fill="currentColor"/>
                            </svg>
                          </div>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground truncate">
                        {node.data?.kind || 'Unknown type'}
                      </p>
                    </div>
                  </div>

                  {/* Drag handle */}
                  <div className="flex-shrink-0 text-muted-foreground hover:text-foreground transition-colors cursor-grab active:cursor-grabbing">
                    <svg
                      width="18"
                      height="18"
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
                <div className="flex justify-center my-3">
                  <div className="flex flex-col items-center gap-1">
                    <div className="w-0.5 h-4 bg-gradient-to-b from-border to-transparent" />
                    <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center border border-primary/20">
                      <svg
                        width="14"
                        height="14"
                        viewBox="0 0 20 20"
                        fill="none"
                        className="text-primary"
                      >
                        <path
                          d="M10 15L5 10L10 5"
                          stroke="currentColor"
                          strokeWidth="2.5"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      </svg>
                    </div>
                    <div className="w-0.5 h-4 bg-gradient-to-b from-transparent to-border" />
                  </div>
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* Summary */}
      <div className="mt-6 sm:mt-8 p-4 sm:p-5 bg-gradient-to-r from-muted/50 to-muted/30 rounded-xl border border-border/50 shadow-sm">
        <p className="text-sm sm:text-base text-muted-foreground">
          <span className="font-bold text-foreground">{flowOrder.length}</span> step{flowOrder.length !== 1 ? 's' : ''} in this workflow
        </p>
      </div>
    </div>
  )
}

