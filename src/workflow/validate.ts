/**
 * @fileoverview Graph validation utilities
 */

import type { Node, Edge } from 'reactflow';
import type { RfNodeData, ValidationResult } from '../types/graph';

/**
 * Validate graph structure
 * Returns critical errors and warnings separately
 */
export function validateGraph(
  nodes: Node<RfNodeData>[],
  edges: Edge[]
): ValidationResult {
  const issues: string[] = [];
  const warnings: string[] = [];

  // Filter out invalid nodes/edges first
  const validNodes = (nodes || []).filter((n) => n && n.id && n.data);
  const validEdges = (edges || []).filter((e) => e && e.id && e.source && e.target);

  // Check for exactly one trigger
  const triggers = validNodes.filter((n) => n.data?.role === 'TRIGGER');
  if (triggers.length === 0 && validNodes.length > 0) {
    warnings.push('No trigger node found (workflow can still function)');
  } else if (triggers.length > 1) {
    warnings.push(`Multiple triggers found: ${triggers.length}`);
  }

  // Check for at least one action
  const actions = validNodes.filter((n) => n.data?.role === 'ACTION');
  if (actions.length === 0 && validNodes.length > 1) {
    warnings.push('No action nodes found (workflow may not perform any actions)');
  }

  // Check for dangling edges (CRITICAL ERROR)
  const nodeIds = new Set(validNodes.map((n) => n.id));
  for (const edge of validEdges) {
    if (!nodeIds.has(edge.source)) {
      issues.push(`Edge ${edge.id} references non-existent source node ${edge.source}`);
    }
    if (!nodeIds.has(edge.target)) {
      issues.push(`Edge ${edge.id} references non-existent target node ${edge.target}`);
    }
  }

  // Check for orphaned nodes (WARNING)
  const connectedNodeIds = new Set<string>();
  validEdges.forEach((e) => {
    connectedNodeIds.add(e.source);
    connectedNodeIds.add(e.target);
  });

  const orphaned = validNodes.filter((n) => {
    if (n.data?.role === 'TRIGGER') return false; // Triggers can be unconnected
    return !connectedNodeIds.has(n.id);
  });

  if (orphaned.length > 0 && validNodes.length > 1) {
    warnings.push(`Orphaned nodes found: ${orphaned.map((n) => n.id).join(', ')}`);
  }

  // Check for cycles (WARNING)
  if (hasCycles(validNodes, validEdges)) {
    warnings.push('Graph contains cycles');
  }

  // Only fail on critical errors (dangling edges)
  return {
    ok: issues.length === 0,
    issues: [...issues, ...warnings], // Include warnings for visibility
    warnings, // Separate warnings array
  };
}

/**
 * Check if graph has cycles using DFS
 */
function hasCycles(nodes: Node<RfNodeData>[], edges: Edge[]): boolean {
  const graph = new Map<string, string[]>();
  nodes.forEach((n) => graph.set(n.id, []));
  edges.forEach((e) => {
    const list = graph.get(e.source) || [];
    list.push(e.target);
    graph.set(e.source, list);
  });

  const visited = new Set<string>();
  const recStack = new Set<string>();

  function dfs(nodeId: string): boolean {
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
    if (dfs(nodeId)) return true;
  }

  return false;
}

