/**
 * @fileoverview Graph patch operations - apply patches to modify graph
 */

import type { Node, Edge } from 'reactflow';
import type { GraphPatch, PatchResult, RfNodeData } from '../types/graph';
// @ts-ignore
import { getNodeRole } from './graphTypes.js';
// Import from utils.js (will migrate to TS later)
// @ts-ignore
import { connect, generateId, getDefaultLabel, calculateNextNodePosition } from './utils.js';
import { generateNodeLabel } from './labeler';
import { validateGraph } from './validate';

/**
 * Apply a patch to the graph
 * This is the main entry point for all graph modifications
 */
export function applyPatch(
  patch: GraphPatch,
  currentNodes: Node<RfNodeData>[] = [],
  currentEdges: Edge[] = []
): PatchResult & { nodes: Node<RfNodeData>[]; edges: Edge[] } {
  console.log('🔧 applyPatch called:', {
    op: patch.op,
    currentNodesCount: currentNodes.length,
    currentEdgesCount: currentEdges.length
  });
  
  // Filter out invalid nodes/edges and create deep copies
  const validNodes = (currentNodes || []).filter((n) => n && n.id && n.data);
  let nodes = validNodes.map((n) => ({
    ...n,
    data: {
      ...(n.data || {}),
      role: n.data?.role || getNodeRole(n.data?.kind),
    },
    position: { ...(n.position || { x: 100, y: 100 }) },
  }));
  let edges = (currentEdges || [])
    .filter((e) => e && e.id && e.source && e.target)
    .map((e) => ({ ...e }));
  const issues: string[] = [];

  try {
    // Handle BULK operations
    if (patch.op === 'BULK') {
      if (!patch.ops || !Array.isArray(patch.ops)) {
        issues.push('BULK operation missing ops array');
        return { ok: false, nodes, edges, issues };
      }

      let result: PatchResult & { nodes: Node<RfNodeData>[]; edges: Edge[] } = {
        ok: true,
        nodes,
        edges,
        issues: [],
      };

      // Process operations in order: nodes first, then edges
      // This ensures edges can reference nodes that were just added
      const nodeOps: GraphPatch[] = [];
      const edgeOps: GraphPatch[] = [];
      const otherOps: GraphPatch[] = [];
      
      for (const op of patch.ops) {
        if (!op || !op.op) {
          continue; // Skip invalid operations
        }
        if (op.op === 'ADD_NODE') {
          nodeOps.push(op);
        } else if (op.op === 'ADD_EDGE') {
          edgeOps.push(op);
        } else {
          otherOps.push(op);
        }
      }
      
      // First pass: Add all nodes
      for (const op of nodeOps) {
        result = applyPatch(op, result.nodes, result.edges);
        if (!result.ok) {
          const criticalIssues = (result.issues || []).filter(
            (issue) =>
              !issue.includes('(workflow can still function)') &&
              !issue.includes('(workflow may not perform any actions)') &&
              !issue.includes('Orphaned nodes') &&
              !issue.includes('contains cycles') &&
              !issue.includes('Multiple triggers')
          );
          issues.push(...criticalIssues);
        }
      }
      
      // Second pass: Process other operations (UPDATE, REMOVE, etc.)
      for (const op of otherOps) {
        result = applyPatch(op, result.nodes, result.edges);
        if (!result.ok) {
          const criticalIssues = (result.issues || []).filter(
            (issue) =>
              !issue.includes('(workflow can still function)') &&
              !issue.includes('(workflow may not perform any actions)') &&
              !issue.includes('Orphaned nodes') &&
              !issue.includes('contains cycles') &&
              !issue.includes('Multiple triggers')
          );
          issues.push(...criticalIssues);
        }
      }
      
      // Third pass: Add all edges (now all nodes exist)
      console.log(`🔧 Processing ${edgeOps.length} edges. Available nodes:`, result.nodes.map(n => ({ id: n.id, kind: n.data?.kind })));
      for (const op of edgeOps) {
        console.log(`🔧 Processing edge op:`, JSON.stringify(op, null, 2));
        result = applyPatch(op, result.nodes, result.edges);
        if (!result.ok) {
          const criticalIssues = (result.issues || []).filter(
            (issue) =>
              !issue.includes('(workflow can still function)') &&
              !issue.includes('(workflow may not perform any actions)') &&
              !issue.includes('Orphaned nodes') &&
              !issue.includes('contains cycles') &&
              !issue.includes('Multiple triggers')
          );
          issues.push(...criticalIssues);
        }
      }

      // Validate after bulk operations
      if (result.nodes.length > 0 || result.edges.length > 0) {
        const validation = validateGraph(result.nodes, result.edges);
        if (!validation.ok) {
          const criticalIssues = (validation.issues || []).filter(
            (issue) =>
              !issue.includes('(workflow can still function)') &&
              !issue.includes('(workflow may not perform any actions)') &&
              !issue.includes('Orphaned nodes') &&
              !issue.includes('contains cycles') &&
              !issue.includes('Multiple triggers')
          );
          issues.push(...criticalIssues);
        }
      }

      return { ...result, ok: issues.length === 0, issues };
    }

    // ADD_NODE
    if (patch.op === 'ADD_NODE') {
      console.log('📦 ADD_NODE patch:', patch);
      
      if (!patch.node) {
        console.error('❌ ADD_NODE: missing node');
        issues.push('ADD_NODE operation missing node');
        return { ok: false, nodes, edges, issues };
      }

      const node = patch.node;
      console.log('📦 Node to add:', node);
      
      if (!node.data || !node.data.kind) {
        console.error('❌ ADD_NODE: missing data.kind');
        issues.push('Node missing required data.kind');
        return { ok: false, nodes, edges, issues };
      }

      if (!node.id) {
        console.error('❌ ADD_NODE: missing id');
        issues.push('Node missing required id');
        return { ok: false, nodes, edges, issues };
      }

      // Add role if missing
      if (!node.data.role) {
        node.data.role = getNodeRole(node.data.kind);
      }

      // Calculate position if not provided
      if (!node.position || (node.position.x === 100 && node.position.y === 100 && nodes.length > 0)) {
        node.position = calculateNextNodePosition(nodes);
      }

      // Check for duplicate IDs
      if (nodes.find((n) => n.id === node.id)) {
        console.error('❌ ADD_NODE: duplicate ID', node.id);
        issues.push(`Node with id ${node.id} already exists`);
        return { ok: false, nodes, edges, issues };
      }

      // Ensure label is set - use generateNodeLabel for better labels
      let nodeLabel = node.data.label;
      if (!nodeLabel || nodeLabel.trim() === '' || nodeLabel === 'Untitled Node') {
        nodeLabel = generateNodeLabel(node.data.kind, node.data.config || {}) || getDefaultLabel(node.data.kind);
      }

      const newNode: Node<RfNodeData> = {
        id: node.id,
        type: node.type || 'default',
        position: { ...node.position },
        data: {
          kind: node.data.kind,
          config: node.data.config || {},
          role: node.data.role || getNodeRole(node.data.kind),
          ...node.data,
          label: nodeLabel, // Override to ensure it's set
        },
      };

      console.log('📦 Created newNode:', newNode);
      console.log('📦 Nodes before push:', nodes.length);
      
      nodes.push(newNode);
      
      console.log('📦 Nodes after push:', nodes.length);
      console.log('📦 All node IDs:', nodes.map(n => n.id));
    }

    // UPDATE_NODE
    if (patch.op === 'UPDATE_NODE') {
      const index = nodes.findIndex((n) => n.id === patch.id);
      if (index === -1) {
        issues.push(`Node ${patch.id} not found`);
        return { ok: false, nodes, edges, issues };
      }

      const node = { ...nodes[index] };
      if (patch.data) {
        const oldConfig = node.data.config || {};
        node.data = { ...node.data, ...patch.data };
        
        // Merge config if provided
        if (patch.data.config) {
          node.data.config = { ...oldConfig, ...patch.data.config };
        }
        
        if (!node.data.role && node.data.kind) {
          node.data.role = getNodeRole(node.data.kind);
        }
        
        // Regenerate label if config changed (unless label was explicitly updated)
        if (patch.data.config && !patch.data.label) {
          node.data.label = generateNodeLabel(node.data.kind, node.data.config || {}) || node.data.label;
        }
      }
      if (patch.position) {
        node.position = { ...node.position, ...patch.position };
      }
      nodes[index] = node;
    }

    // REMOVE_NODE
    if (patch.op === 'REMOVE_NODE') {
      console.log('🗑️ REMOVE_NODE patch:', patch.id);
      
      if (!patch.id) {
        console.error('❌ REMOVE_NODE: missing id');
        issues.push('REMOVE_NODE operation missing id');
        return { ok: false, nodes, edges, issues };
      }

      const index = nodes.findIndex((n) => n.id === patch.id);
      if (index === -1) {
        console.error('❌ REMOVE_NODE: node not found', patch.id);
        console.log('📋 Available node IDs:', nodes.map(n => n.id));
        issues.push(`Node ${patch.id} not found`);
        return { ok: false, nodes, edges, issues };
      }

      console.log('🗑️ Removing node:', nodes[index].id, nodes[index].data?.label);

      // Find and remove connected edges
      const incomingEdges = edges.filter((e) => e.target === patch.id);
      const outgoingEdges = edges.filter((e) => e.source === patch.id);
      console.log('🗑️ Connected edges:', { incoming: incomingEdges.length, outgoing: outgoingEdges.length });
      
      edges = edges.filter((e) => e.source !== patch.id && e.target !== patch.id);

      // Reconnect edges if needed
      if (incomingEdges.length > 0 && outgoingEdges.length > 0) {
        for (const incoming of incomingEdges) {
          for (const outgoing of outgoingEdges) {
            if (incoming.source !== outgoing.target) {
              const edgeExists = edges.some(
                (e) => e.source === incoming.source && e.target === outgoing.target
              );
              if (!edgeExists) {
                edges.push(connect(incoming.source, outgoing.target));
                console.log('🔗 Reconnected edge:', incoming.source, '→', outgoing.target);
              }
            }
          }
        }
      }

      nodes.splice(index, 1);
      console.log('🗑️ Node removed. Remaining nodes:', nodes.length);
    }

    // ADD_EDGE
    if (patch.op === 'ADD_EDGE') {
      console.log('🔧 ADD_EDGE patch received:', JSON.stringify(patch, null, 2));
      console.log('🔧 Current nodes count:', nodes.length);
      console.log('🔧 Available nodes:', nodes.map(n => ({ id: n.id, kind: n.data?.kind, label: n.data?.label })));
      let sourceId: string, targetId: string, edgeToAdd: Edge;

      if (patch.edge) {
        sourceId = patch.edge.source;
        targetId = patch.edge.target;
        edgeToAdd = patch.edge;
      } else if ('from' in patch && 'to' in patch) {
        // Handle REWIRE-style format
        sourceId = patch.from as string;
        targetId = patch.to as string;
        edgeToAdd = connect(sourceId, targetId);
        if ('id' in patch && patch.id) {
          edgeToAdd.id = patch.id as string;
        }
      } else {
        issues.push('ADD_EDGE operation missing edge or from/to properties');
        return { ok: false, nodes, edges, issues };
      }
      
      console.log(`🔧 ADD_EDGE: source="${sourceId}", target="${targetId}"`);

      // Safety check: if source/target look like kinds, try to find the actual node IDs
      // This handles cases where edge fixing in planner didn't work
      let sourceFixed = false;
      let targetFixed = false;
      
      if (sourceId && (sourceId.includes('action.') || sourceId.includes('trigger.'))) {
        // Try exact kind match first
        let nodeOfKind = nodes.find((n) => n.data?.kind === sourceId);
        
        // If not found, try to find the first node of that kind (in case there are multiple)
        if (!nodeOfKind) {
          // Check all nodes to see their kinds
          console.log(`🔍 Looking for node with kind "${sourceId}". Checking all nodes:`, nodes.map(n => ({ id: n.id, kind: n.data?.kind })));
          nodeOfKind = nodes.find((n) => {
            const kind = n.data?.kind;
            return kind === sourceId;
          });
        }
        
        if (nodeOfKind) {
          console.log(`🔧 applyPatch: Fixed edge source from kind "${sourceId}" to id "${nodeOfKind.id}"`);
          sourceId = nodeOfKind.id;
          sourceFixed = true;
          if (edgeToAdd) {
            edgeToAdd.source = sourceId;
          }
        } else {
          console.error(`❌ applyPatch: Could not find node with kind "${sourceId}" in nodes array.`);
          console.error(`   Available node kinds:`, [...new Set(nodes.map(n => n.data?.kind))]);
          console.error(`   All nodes:`, nodes.map(n => ({ id: n.id, kind: n.data?.kind, label: n.data?.label })));
        }
      }
      
      if (targetId && (targetId.includes('action.') || targetId.includes('trigger.'))) {
        // Try exact kind match first
        let nodeOfKind = nodes.find((n) => n.data?.kind === targetId);
        
        // If not found, try to find the first node of that kind (in case there are multiple)
        if (!nodeOfKind) {
          nodeOfKind = nodes.find((n) => {
            const kind = n.data?.kind;
            return kind === targetId;
          });
        }
        
        if (nodeOfKind) {
          console.log(`🔧 applyPatch: Fixed edge target from kind "${targetId}" to id "${nodeOfKind.id}"`);
          targetId = nodeOfKind.id;
          targetFixed = true;
          if (edgeToAdd) {
            edgeToAdd.target = targetId;
          }
        } else {
          console.error(`❌ applyPatch: Could not find node with kind "${targetId}" in nodes array.`);
          console.error(`   Available node kinds:`, [...new Set(nodes.map(n => n.data?.kind))]);
          console.error(`   All nodes:`, nodes.map(n => ({ id: n.id, kind: n.data?.kind, label: n.data?.label })));
        }
      }
      
      // Also update from/to if we fixed them
      if (sourceFixed && 'from' in patch) {
        (patch as any).from = sourceId;
      }
      if (targetFixed && 'to' in patch) {
        (patch as any).to = targetId;
      }

      // Validate nodes exist
      const sourceExists = nodes.find((n) => n.id === sourceId);
      const targetExists = nodes.find((n) => n.id === targetId);

      if (!sourceExists || !targetExists) {
        issues.push(`Edge references non-existent node(s): source=${sourceId}, target=${targetId}`);
        return { ok: false, nodes, edges, issues };
      }

      // Check for duplicate
      const existing = edges.find((e) => e.source === sourceId && e.target === targetId);
      if (existing) {
        issues.push(`Edge from ${sourceId} to ${targetId} already exists`);
        return { ok: false, nodes, edges, issues };
      }

      edges.push(edgeToAdd);
    }

    // REMOVE_EDGE
    if (patch.op === 'REMOVE_EDGE') {
      const index = edges.findIndex((e) => e.id === patch.id);
      if (index === -1) {
        issues.push(`Edge ${patch.id} not found`);
        return { ok: false, nodes, edges, issues };
      }
      edges.splice(index, 1);
    }

    // REWIRE
    if (patch.op === 'REWIRE') {
      if (!patch.from || !patch.to) {
        issues.push('REWIRE operation missing from/to properties');
        return { ok: false, nodes, edges, issues };
      }

      const sourceExists = nodes.find((n) => n.id === patch.from);
      const targetExists = nodes.find((n) => n.id === patch.to);

      if (!sourceExists || !targetExists) {
        issues.push(`Rewire references non-existent node(s): from=${patch.from}, to=${patch.to}`);
        return { ok: false, nodes, edges, issues };
      }

      // Remove old edges
      if (patch.edgeId) {
        edges = edges.filter((e) => e.id !== patch.edgeId);
      } else {
        edges = edges.filter((e) => e.source !== patch.from);
      }

      // Add new edge
      const newEdge = patch.edgeId
        ? { ...connect(patch.from, patch.to), id: patch.edgeId }
        : connect(patch.from, patch.to);
      edges.push(newEdge);
    }

    // SET_NAME (handled by graphStore.setGraphName)
    if (patch.op === 'SET_NAME') {
      // This is handled at the store level
    }

    // Validate after applying patch
    if (nodes.length > 0 || edges.length > 0) {
      const validation = validateGraph(nodes, edges);
      if (!validation.ok) {
        const criticalIssues = (validation.issues || []).filter(
          (issue) =>
            !issue.includes('(workflow can still function)') &&
            !issue.includes('(workflow may not perform any actions)') &&
            !issue.includes('Orphaned nodes') &&
            !issue.includes('contains cycles') &&
            !issue.includes('Multiple triggers')
        );
        issues.push(...criticalIssues);
      }
    }

    console.log('🔧 applyPatch returning:', {
      ok: issues.length === 0,
      nodesCount: nodes.length,
      edgesCount: edges.length,
      issues: issues
    });
    
    return { ok: issues.length === 0, nodes, edges, issues };
  } catch (error: any) {
    console.error('❌ applyPatch error:', error);
    issues.push(`Error applying patch: ${error.message}`);
    return { ok: false, nodes, edges, issues };
  }
}

