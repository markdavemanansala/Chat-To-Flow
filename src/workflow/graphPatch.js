/**
 * @fileoverview Graph patch operations and validation
 */

import { getNodeRole } from './graphTypes.js';
import { connect, generateId } from './utils.js';

/**
 * Apply a patch to the graph
 * @param {import('./graphTypes').GraphPatch} patch
 * @param {import('reactflow').Node[]} currentNodes
 * @param {import('reactflow').Edge[]} currentEdges
 * @returns {import('./graphTypes').PatchResult & { nodes: import('reactflow').Node[], edges: import('reactflow').Edge[] }}
 */
export function applyPatch(patch, currentNodes = [], currentEdges = []) {
  // Create deep copies to avoid mutation
  const nodes = currentNodes.map(n => ({ ...n, data: { ...n.data } }));
  const edges = currentEdges.map(e => ({ ...e }));
  const issues = [];

  try {
    if (patch.op === 'BULK') {
      let result = { ok: true, nodes, edges, issues };
      for (const op of patch.ops) {
        result = applyPatch(op, result.nodes, result.edges);
        if (!result.ok) {
          issues.push(...(result.issues || []));
        }
      }
      const validation = validateGraph(result.nodes, result.edges);
      if (!validation.ok) {
        issues.push(...(validation.issues || []));
      }
      return { ...result, ok: issues.length === 0, issues };
    }

    if (patch.op === 'ADD_NODE') {
      // Ensure node has required data structure
      const node = patch.node;
      if (!node.data || !node.data.kind) {
        issues.push('Node missing required data.kind');
        return { ok: false, nodes, edges, issues };
      }
      
      // Add role if missing
      if (!node.data.role) {
        node.data.role = getNodeRole(node.data.kind);
      }
      
      // Check for duplicate IDs
      if (nodes.find(n => n.id === node.id)) {
        issues.push(`Node with id ${node.id} already exists`);
        return { ok: false, nodes, edges, issues };
      }
      
      nodes.push(node);
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
      // Validate nodes exist
      const sourceExists = nodes.find(n => n.id === patch.edge.source);
      const targetExists = nodes.find(n => n.id === patch.edge.target);
      
      if (!sourceExists || !targetExists) {
        issues.push(`Edge references non-existent node(s)`);
        return { ok: false, nodes, edges, issues };
      }
      
      // Check for duplicate
      const existing = edges.find(
        e => e.source === patch.edge.source && e.target === patch.edge.target
      );
      if (existing) {
        issues.push(`Edge from ${patch.edge.source} to ${patch.edge.target} already exists`);
        return { ok: false, nodes, edges, issues };
      }
      
      edges.push(patch.edge);
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
      // Validate nodes exist
      const sourceExists = nodes.find(n => n.id === patch.from);
      const targetExists = nodes.find(n => n.id === patch.to);
      
      if (!sourceExists || !targetExists) {
        issues.push(`Rewire references non-existent node(s)`);
        return { ok: false, nodes, edges, issues };
      }
      
      // Remove old edges from 'from' node (if edgeId specified, only remove that one)
      if (patch.edgeId) {
        edges = edges.filter(e => e.id !== patch.edgeId);
      } else {
        // Remove all edges from 'from' node
        edges = edges.filter(e => e.source !== patch.from);
      }
      
      // Add new edge
      const newEdge = patch.edgeId 
        ? { ...connect(patch.from, patch.to), id: patch.edgeId }
        : connect(patch.from, patch.to);
      
      edges.push(newEdge);
    }

    // Validate after applying patch
    const validation = validateGraph(nodes, edges);
    if (!validation.ok) {
      issues.push(...(validation.issues || []));
    }

    return { ok: issues.length === 0, nodes, edges, issues };
  } catch (error) {
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

  // Check for exactly one trigger
  const triggers = nodes.filter(n => n.data?.role === 'TRIGGER');
  if (triggers.length === 0) {
    issues.push('No trigger node found');
  } else if (triggers.length > 1) {
    issues.push(`Multiple triggers found: ${triggers.length}`);
  }

  // Check for at least one action
  const actions = nodes.filter(n => n.data?.role === 'ACTION');
  if (actions.length === 0 && nodes.length > 1) {
    issues.push('No action nodes found');
  }

  // Check for dangling edges
  const nodeIds = new Set(nodes.map(n => n.id));
  for (const edge of edges) {
    if (!nodeIds.has(edge.source)) {
      issues.push(`Edge ${edge.id} references non-existent source node ${edge.source}`);
    }
    if (!nodeIds.has(edge.target)) {
      issues.push(`Edge ${edge.id} references non-existent target node ${edge.target}`);
    }
  }

  // Check for orphaned nodes (no connections)
  const connectedNodeIds = new Set();
  edges.forEach(e => {
    connectedNodeIds.add(e.source);
    connectedNodeIds.add(e.target);
  });
  
  const orphaned = nodes.filter(n => {
    if (n.data?.role === 'TRIGGER') return false; // Triggers can be unconnected
    return !connectedNodeIds.has(n.id);
  });
  
  if (orphaned.length > 0 && nodes.length > 1) {
    issues.push(`Orphaned nodes found: ${orphaned.map(n => n.id).join(', ')}`);
  }

  // Check for cycles (simple check - can be enhanced)
  const hasCycle = checkForCycles(nodes, edges);
  if (hasCycle) {
    issues.push('Graph contains cycles');
  }

  return { ok: issues.length === 0, issues };
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

