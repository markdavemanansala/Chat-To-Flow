/**
 * @fileoverview Graph patch operations and validation
 */

import { getNodeRole } from './graphTypes.js';
import { connect, generateId, getDefaultLabel, calculateNextNodePosition } from './utils.js';

/**
 * Apply a patch to the graph
 * @param {import('./graphTypes').GraphPatch} patch
 * @param {import('reactflow').Node[]} currentNodes
 * @param {import('reactflow').Edge[]} currentEdges
 * @returns {import('./graphTypes').PatchResult & { nodes: import('reactflow').Node[], edges: import('reactflow').Edge[] }}
 */
export function applyPatch(patch, currentNodes = [], currentEdges = []) {
  // Filter out undefined/null nodes and create deep copies to avoid mutation
  const validNodes = (currentNodes || []).filter(n => n && n.id && n.data);
  const nodes = validNodes.map(n => ({ 
    ...n, 
    data: { ...(n.data || {}), role: n.data?.role || getNodeRole(n.data?.kind) },
    position: { ...(n.position || { x: 100, y: 100 }) }
  }));
  const edges = (currentEdges || []).filter(e => e && e.id && e.source && e.target).map(e => ({ ...e }));
  const issues = [];
  
  console.log('🔧 applyPatch called with:', {
    patchOp: patch?.op,
    currentNodesCount: currentNodes.length,
    validNodesCount: validNodes.length,
    currentEdgesCount: currentEdges.length,
    patch: patch
  });

  try {
    if (patch.op === 'BULK') {
      if (!patch.ops || !Array.isArray(patch.ops)) {
        issues.push('BULK operation missing ops array');
        return { ok: false, nodes, edges, issues };
      }
      
      let result = { ok: true, nodes, edges, issues };
      console.log('📦 Processing BULK patch with', patch.ops.length, 'operations');
      
      for (let i = 0; i < patch.ops.length; i++) {
        const op = patch.ops[i];
        // Skip invalid operations
        if (!op || !op.op) {
          console.warn('⚠️ Skipping invalid operation in BULK patch:', op);
          continue;
        }
        
        console.log(`📦 BULK operation ${i + 1}/${patch.ops.length}:`, op.op, op.id || 'N/A');
        console.log(`📦 Before operation: ${result.nodes.length} nodes, ${result.edges.length} edges`);
        
        result = applyPatch(op, result.nodes, result.edges);
        
        console.log(`📦 After operation: ${result.nodes.length} nodes, ${result.edges.length} edges`);
        console.log(`📦 Node IDs after operation:`, result.nodes.map(n => n.id));
        
        if (!result.ok) {
          // Filter out warnings - only add critical errors
          const criticalIssues = (result.issues || []).filter(issue => 
            !issue.includes('(workflow can still function)') &&
            !issue.includes('(workflow may not perform any actions)') &&
            !issue.includes('Orphaned nodes') &&
            !issue.includes('contains cycles') &&
            !issue.includes('Multiple triggers')
          );
          issues.push(...criticalIssues);
        }
      }
      
      console.log('📦 BULK patch completed:', {
        finalNodesCount: result.nodes.length,
        finalEdgesCount: result.edges.length,
        finalNodeIds: result.nodes.map(n => n.id)
      });
      
      // Only validate if we have nodes/edges
      if (result.nodes.length > 0 || result.edges.length > 0) {
        const validation = validateGraph(result.nodes, result.edges);
        if (!validation.ok) {
          // Filter out warnings - only add critical errors
          const criticalIssues = (validation.issues || []).filter(issue => 
            !issue.includes('(workflow can still function)') &&
            !issue.includes('(workflow may not perform any actions)') &&
            !issue.includes('Orphaned nodes') &&
            !issue.includes('contains cycles') &&
            !issue.includes('Multiple triggers')
          );
          issues.push(...criticalIssues);
          
          // Log warnings separately
          if (validation.warnings && validation.warnings.length > 0) {
            console.log('⚠️ Validation warnings (non-blocking):', validation.warnings);
          }
        }
      }
      
      // Only fail if there are critical errors, not warnings
      return { ...result, ok: issues.length === 0, issues };
    }

    if (patch.op === 'ADD_NODE') {
      // Ensure node exists and has required data structure
      if (!patch.node) {
        issues.push('ADD_NODE operation missing node');
        return { ok: false, nodes, edges, issues };
      }
      
      const node = patch.node;
      if (!node || !node.data || !node.data.kind) {
        issues.push('Node missing required data.kind');
        return { ok: false, nodes, edges, issues };
      }
      
      // Ensure node has all required properties
      if (!node.id) {
        issues.push('Node missing required id');
        return { ok: false, nodes, edges, issues };
      }
      
      // Add role if missing
      if (!node.data.role) {
        node.data.role = getNodeRole(node.data.kind);
      }
      
      // Calculate position if not provided - place to the right of existing nodes
      if (!node.position || (node.position.x === 100 && node.position.y === 100 && nodes.length > 0)) {
        node.position = calculateNextNodePosition(nodes);
        console.log('📍 Calculated position for new node:', node.position);
      }
      
      // Check for duplicate IDs
      if (nodes.find(n => n && n.id === node.id)) {
        issues.push(`Node with id ${node.id} already exists`);
        return { ok: false, nodes, edges, issues };
      }
      
      // Ensure label is set - prefer AI-provided label, fallback to default
      let nodeLabel = node.data.label;
      if (!nodeLabel || nodeLabel.trim() === '' || nodeLabel === 'Untitled Node') {
        nodeLabel = getDefaultLabel(node.data.kind);
        console.log('📝 Setting default label for node:', node.data.kind, '→', nodeLabel);
      } else {
        console.log('✅ Using provided label for node:', node.data.kind, '→', nodeLabel);
      }
      
      // Create a proper copy of the node to avoid mutation issues
      const newNode = {
        id: node.id,
        type: node.type || 'default',
        position: { ...node.position },
        data: {
          kind: node.data.kind,
          label: nodeLabel,
          config: node.data.config || {},
          role: node.data.role || getNodeRole(node.data.kind),
          ...node.data,
          // Override label to ensure it's set (after spreading node.data)
          label: nodeLabel
        }
      };
      
      console.log('➕ Adding node:', newNode.id, newNode.data.label);
      nodes.push(newNode);
      console.log('📊 Nodes after ADD_NODE:', nodes.length, nodes.map(n => n.id));
    }

    if (patch.op === 'UPDATE_NODE') {
      const index = nodes.findIndex(n => n.id === patch.id);
      if (index === -1) {
        issues.push(`Node ${patch.id} not found`);
        return { ok: false, nodes, edges, issues };
      }
      
      const node = { ...nodes[index] };
      if (patch.data) {
        node.data = { ...node.data, ...patch.data };
        // Ensure role is set
        if (!node.data.role && node.data.kind) {
          node.data.role = getNodeRole(node.data.kind);
        }
      }
      if (patch.position) {
        node.position = { ...node.position, ...patch.position };
      }
      nodes[index] = node;
    }

    if (patch.op === 'REMOVE_NODE') {
      const index = nodes.findIndex(n => n.id === patch.id);
      if (index === -1) {
        issues.push(`Node ${patch.id} not found`);
        return { ok: false, nodes, edges, issues };
      }
      
      // Find edges connected to this node BEFORE removing them
      const incomingEdges = edges.filter(e => e.target === patch.id);
      const outgoingEdges = edges.filter(e => e.source === patch.id);
      
      // Remove connected edges
      edges = edges.filter(e => e.source !== patch.id && e.target !== patch.id);
      
      // Reconnect edges if needed (connect incoming to outgoing)
      if (incomingEdges.length > 0 && outgoingEdges.length > 0) {
        for (const incoming of incomingEdges) {
          for (const outgoing of outgoingEdges) {
            if (incoming.source !== outgoing.target) {
              // Check if edge already exists
              const edgeExists = edges.some(e => 
                e.source === incoming.source && e.target === outgoing.target
              );
              if (!edgeExists) {
                edges.push(connect(incoming.source, outgoing.target));
              }
            }
          }
        }
      }
      
      // Remove the node
      const removedNode = nodes[index];
      nodes.splice(index, 1);
      
      console.log(`🗑️ Removed node ${patch.id} (${removedNode?.data?.label || 'unknown'}). Remaining: ${nodes.length} nodes`);
    }

    if (patch.op === 'ADD_EDGE') {
      // Handle both formats: {edge: {source, target}} or {from, to}
      let sourceId, targetId, edgeToAdd;
      
      if (patch.edge) {
        // Standard format with edge object
        sourceId = patch.edge.source;
        targetId = patch.edge.target;
        edgeToAdd = patch.edge;
      } else if (patch.from && patch.to) {
        // AI format with from/to at top level
        sourceId = patch.from;
        targetId = patch.to;
        edgeToAdd = connect(sourceId, targetId, patch.label);
        // Use provided edge ID if available
        if (patch.id || patch.edgeId) {
          edgeToAdd.id = patch.id || patch.edgeId;
        }
      } else {
        issues.push('ADD_EDGE operation missing edge or from/to properties');
        return { ok: false, nodes, edges, issues };
      }
      
      // Validate nodes exist
      const sourceExists = nodes.find(n => n && n.id === sourceId);
      const targetExists = nodes.find(n => n && n.id === targetId);
      
      if (!sourceExists || !targetExists) {
        issues.push(`Edge references non-existent node(s): source=${sourceId}, target=${targetId}`);
        return { ok: false, nodes, edges, issues };
      }
      
      // Check for duplicate
      const existing = edges.find(
        e => e && e.source === sourceId && e.target === targetId
      );
      if (existing) {
        issues.push(`Edge from ${sourceId} to ${targetId} already exists`);
        return { ok: false, nodes, edges, issues };
      }
      
      edges.push(edgeToAdd);
    }

    if (patch.op === 'REMOVE_EDGE') {
      const index = edges.findIndex(e => e.id === patch.id);
      if (index === -1) {
        issues.push(`Edge ${patch.id} not found`);
        return { ok: false, nodes, edges, issues };
      }
      edges.splice(index, 1);
    }

    if (patch.op === 'REWIRE') {
      // Validate required properties
      if (!patch.from || !patch.to) {
        issues.push('REWIRE operation missing from/to properties');
        return { ok: false, nodes, edges, issues };
      }
      
      // Validate nodes exist
      const sourceExists = nodes.find(n => n && n.id === patch.from);
      const targetExists = nodes.find(n => n && n.id === patch.to);
      
      if (!sourceExists || !targetExists) {
        issues.push(`Rewire references non-existent node(s): from=${patch.from}, to=${patch.to}`);
        return { ok: false, nodes, edges, issues };
      }
      
      // Remove old edges from 'from' node (if edgeId specified, only remove that one)
      if (patch.edgeId) {
        edges = edges.filter(e => e && e.id !== patch.edgeId);
      } else {
        // Remove all edges from 'from' node
        edges = edges.filter(e => e && e.source !== patch.from);
      }
      
      // Add new edge
      const newEdge = patch.edgeId 
        ? { ...connect(patch.from, patch.to), id: patch.edgeId }
        : connect(patch.from, patch.to);
      
      edges.push(newEdge);
    }

    // Validate after applying patch (only if we have nodes)
    if (nodes.length > 0 || edges.length > 0) {
      const validation = validateGraph(nodes, edges);
      // Only add critical errors to issues - warnings are informational
      if (!validation.ok) {
        // Filter out warnings - only add critical errors
        const criticalIssues = (validation.issues || []).filter(issue => 
          !issue.includes('(workflow can still function)') &&
          !issue.includes('(workflow may not perform any actions)') &&
          !issue.includes('Orphaned nodes') &&
          !issue.includes('contains cycles') &&
          !issue.includes('Multiple triggers')
        );
        issues.push(...criticalIssues);
        
        // Log warnings separately (don't block workflow creation)
        if (validation.warnings && validation.warnings.length > 0) {
          console.log('⚠️ Validation warnings (non-blocking):', validation.warnings);
        }
      }
    }

    // Only fail if there are critical errors, not warnings
    console.log('✅ applyPatch completed:', {
      ok: issues.length === 0,
      nodesCount: nodes.length,
      edgesCount: edges.length,
      nodeIds: nodes.map(n => n.id),
      issuesCount: issues.length
    });
    
    return { ok: issues.length === 0, nodes, edges, issues };
  } catch (error) {
    console.error('❌ Error in applyPatch:', error);
    console.error('❌ Patch that caused error:', patch);
    console.error('❌ Current nodes:', nodes);
    issues.push(`Error applying patch: ${error.message}`);
    return { ok: false, nodes, edges, issues };
  }
}

/**
 * Validate graph structure
 * @param {import('reactflow').Node[]} nodes
 * @param {import('reactflow').Edge[]} edges
 * @returns {import('./graphTypes').PatchResult}
 */
export function validateGraph(nodes, edges) {
  const issues = [];
  const warnings = []; // Non-critical warnings that don't block workflow creation

  // Filter out invalid nodes first
  const validNodes = (nodes || []).filter(n => n && n.id && n.data);
  const validEdges = (edges || []).filter(e => e && e.id && e.source && e.target);

  // Check for exactly one trigger (only warn, don't fail - workflows can start without triggers)
  const triggers = validNodes.filter(n => n.data?.role === 'TRIGGER');
  if (triggers.length === 0 && validNodes.length > 0) {
    // Only warn if we have nodes but no trigger - empty workflows are OK
    warnings.push('No trigger node found (workflow can still function)');
  } else if (triggers.length > 1) {
    // Multiple triggers is a warning, not an error
    warnings.push(`Multiple triggers found: ${triggers.length}`);
  }

  // Check for at least one action (only warn if we have nodes but no actions)
  const actions = validNodes.filter(n => n.data?.role === 'ACTION');
  if (actions.length === 0 && validNodes.length > 1) {
    warnings.push('No action nodes found (workflow may not perform any actions)');
  }

  // Check for dangling edges (CRITICAL ERROR - these break the graph)
  const nodeIds = new Set(validNodes.map(n => n.id));
  for (const edge of validEdges) {
    if (!nodeIds.has(edge.source)) {
      issues.push(`Edge ${edge.id} references non-existent source node ${edge.source}`);
    }
    if (!nodeIds.has(edge.target)) {
      issues.push(`Edge ${edge.id} references non-existent target node ${edge.target}`);
    }
  }

  // Check for orphaned nodes (WARNING - not critical, but worth noting)
  const connectedNodeIds = new Set();
  validEdges.forEach(e => {
    connectedNodeIds.add(e.source);
    connectedNodeIds.add(e.target);
  });
  
  const orphaned = validNodes.filter(n => {
    if (n.data?.role === 'TRIGGER') return false; // Triggers can be unconnected
    return !connectedNodeIds.has(n.id);
  });
  
  if (orphaned.length > 0 && validNodes.length > 1) {
    warnings.push(`Orphaned nodes found: ${orphaned.map(n => n.id).join(', ')}`);
  }

  // Check for cycles (WARNING - cycles might be intentional)
  const hasCycle = checkForCycles(validNodes, validEdges);
  if (hasCycle) {
    warnings.push('Graph contains cycles');
  }

  // Only fail on critical errors (dangling edges, etc.)
  // Warnings don't block workflow creation
  return { 
    ok: issues.length === 0, 
    issues: [...issues, ...warnings], // Include warnings in issues array for visibility
    warnings // Separate warnings array for filtering
  };
}

/**
 * Simple cycle detection using DFS
 * @param {import('reactflow').Node[]} nodes
 * @param {import('reactflow').Edge[]} edges
 * @returns {boolean}
 */
function checkForCycles(nodes, edges) {
  const graph = new Map();
  nodes.forEach(n => graph.set(n.id, []));
  edges.forEach(e => {
    const list = graph.get(e.source) || [];
    list.push(e.target);
    graph.set(e.source, list);
  });

  const visited = new Set();
  const recStack = new Set();

  function dfs(nodeId) {
    if (recStack.has(nodeId)) return true;
    if (visited.has(nodeId)) return false;

    visited.add(nodeId);
    recStack.add(nodeId);

    const neighbors = graph.get(nodeId) || [];
    for (const neighbor of neighbors) {
      if (dfs(neighbor)) return true;
    }

    recStack.delete(nodeId);
    return false;
  }

  for (const nodeId of graph.keys()) {
    if (!visited.has(nodeId)) {
      if (dfs(nodeId)) return true;
    }
  }

  return false;
}

