/**
 * @fileoverview Deterministic graph summarization for AI context
 */

import type { Node, Edge } from 'reactflow';
import type { RfNodeData, NodeKind } from '../types/graph';

/**
 * Summarize the graph into a compact, deterministic string for AI context
 * Format: Name, Trigger, Steps, Integrations, Issues
 */
export function summarizeGraph(
  nodes: Node<RfNodeData>[],
  edges: Edge[]
): string {
  if (nodes.length === 0) {
    return 'Empty workflow (no nodes)';
  }

  // Extract name (from graph name or generate from nodes)
  const name = generateWorkflowName(nodes);

  // Find trigger
  const trigger = nodes.find((n) => n.data?.role === 'TRIGGER');
  const triggerDesc = trigger
    ? formatTrigger(trigger)
    : 'No trigger';

  // Build ordered steps
  const steps = getOrderedSteps(nodes, edges, trigger?.id);
  const stepsDesc = steps.length > 0
    ? steps
        .map((stepId, idx) => {
          const node = nodes.find((n) => n.id === stepId);
          if (!node) return null;
          return formatStep(node, idx + 1);
        })
        .filter(Boolean)
        .join('\n  ')
    : 'No steps';

  // Extract integrations
  const integrations = extractIntegrations(nodes);

  // Check for issues
  const issues = detectIssues(nodes, edges);

  // Build summary
  let summary = `Name: ${name}\n`;
  summary += `Trigger: ${triggerDesc}\n`;
  summary += `Steps:\n  ${stepsDesc}\n`;
  summary += `Integrations: ${integrations.join(', ') || 'None'}`;
  
  if (issues.length > 0) {
    summary += `\nIssues: ${issues.join(', ')}`;
  }

  return summary;
}

/**
 * Generate workflow name from nodes
 */
function generateWorkflowName(nodes: Node<RfNodeData>[]): string {
  const trigger = nodes.find((n) => n.data?.role === 'TRIGGER');
  const actions = nodes.filter((n) => n.data?.role === 'ACTION').slice(0, 2);

  if (trigger && actions.length > 0) {
    const triggerName = getShortName(trigger.data?.kind || '');
    const actionNames = actions.map((a) => getShortName(a.data?.kind || ''));
    return `${triggerName} → ${actionNames.join(' + ')}`;
  }

  if (trigger) {
    return `${getShortName(trigger.data?.kind || '')} Workflow`;
  }

  return 'New Workflow';
}

/**
 * Get short name from kind
 */
function getShortName(kind: string): string {
  const parts = kind.split('.');
  const last = parts[parts.length - 1];
  return last
    .split(/(?=[A-Z])/)
    .map((p) => p.charAt(0).toUpperCase() + p.slice(1))
    .join(' ');
}

/**
 * Format trigger description
 */
function formatTrigger(node: Node<RfNodeData>): string {
  const kind = node.data?.kind || '';
  const config = node.data?.config || {};

  let desc = kind.replace('trigger.', '');

  // Add key config fields
  if (kind === 'trigger.facebook.comment') {
    if (config.match?.contains) {
      desc += `(match="${config.match.contains}")`;
    }
    if (config.pageId) {
      desc += `(pageId="${config.pageId}")`;
    }
  } else if (kind === 'trigger.scheduler.cron') {
    if (config.schedule) {
      desc += `(schedule="${config.schedule}")`;
    }
  }

  return desc;
}

/**
 * Format step description
 */
function formatStep(node: Node<RfNodeData>, index: number): string {
  const kind = node.data?.kind || '';
  const config = node.data?.config || {};
  const label = node.data?.label || kind;

  let desc = `${index}) ${label}`;

  // Add one key field per kind
  if (kind === 'action.facebook.reply' && config.replyTemplate) {
    desc += `(template="${truncate(String(config.replyTemplate), 20)}")`;
  } else if (kind === 'action.facebook.dm' && config.message) {
    desc += `(message="${truncate(String(config.message), 20)}")`;
  } else if (kind === 'action.sheets.appendRow' && config.range) {
    desc += `(range="${config.range}")`;
  } else if (kind === 'action.email.send' && config.subjectTpl) {
    desc += `(subject="${truncate(String(config.subjectTpl), 20)}")`;
  } else if (kind === 'action.http.request' && config.url) {
    try {
      const url = new URL(String(config.url));
      desc += `(url="${url.hostname}")`;
    } catch {
      // Invalid URL, skip
    }
  }

  return desc;
}

/**
 * Get ordered step IDs starting from trigger
 */
function getOrderedSteps(
  nodes: Node<RfNodeData>[],
  edges: Edge[],
  startNodeId?: string
): string[] {
  if (!startNodeId) {
    return nodes.filter((n) => n.data?.role !== 'TRIGGER').map((n) => n.id);
  }

  const visited = new Set<string>();
  const result: string[] = [];
  const graph = new Map<string, string[]>();

  // Build adjacency list
  nodes.forEach((n) => graph.set(n.id, []));
  edges.forEach((e) => {
    const list = graph.get(e.source) || [];
    list.push(e.target);
    graph.set(e.source, list);
  });

  function dfs(nodeId: string) {
    if (visited.has(nodeId)) return;
    visited.add(nodeId);

    const node = nodes.find((n) => n.id === nodeId);
    if (node && node.data?.role !== 'TRIGGER') {
      result.push(nodeId);
    }

    const neighbors = graph.get(nodeId) || [];
    for (const neighbor of neighbors) {
      dfs(neighbor);
    }
  }

  if (startNodeId) {
    dfs(startNodeId);
  }

  // Include any unvisited non-trigger nodes
  nodes.forEach((n) => {
    if (!visited.has(n.id) && n.data?.role !== 'TRIGGER') {
      result.push(n.id);
    }
  });

  return result;
}

/**
 * Extract integrations from nodes
 */
function extractIntegrations(nodes: Node<RfNodeData>[]): string[] {
  const integrationMap: Record<string, string> = {
    'trigger.facebook.comment': 'Facebook',
    'action.facebook.reply': 'Facebook',
    'action.facebook.dm': 'Facebook',
    'action.telegram.sendMessage': 'Telegram',
    'action.email.send': 'Email',
    'action.sheets.appendRow': 'Google Sheets',
    'action.http.request': 'HTTP',
  };

  const integrations = new Set<string>();
  nodes.forEach((node) => {
    const integration = integrationMap[node.data?.kind || ''];
    if (integration) {
      integrations.add(integration);
    }
  });

  return Array.from(integrations);
}

/**
 * Detect issues in the graph
 */
function detectIssues(nodes: Node<RfNodeData>[], edges: Edge[]): string[] {
  const issues: string[] = [];

  // Check for multiple triggers
  const triggers = nodes.filter((n) => n.data?.role === 'TRIGGER');
  if (triggers.length > 1) {
    issues.push('Multiple triggers');
  } else if (triggers.length === 0) {
    issues.push('No trigger node found');
  }

  // Check for action nodes
  const actions = nodes.filter((n) => n.data?.role === 'ACTION');
  if (actions.length === 0) {
    issues.push('No action nodes found');
  }

  // Check for dangling edges
  const nodeIds = new Set(nodes.map((n) => n.id));
  const danglingEdges = edges.filter(
    (e) => !nodeIds.has(e.source) || !nodeIds.has(e.target)
  );
  if (danglingEdges.length > 0) {
    issues.push(`${danglingEdges.length} dangling edge(s)`);
  }

  // Check for cycles (basic)
  if (hasCycles(nodes, edges)) {
    issues.push('Graph contains cycles');
  }

  return issues;
}

/**
 * Check if graph has cycles (basic DFS)
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

  function hasCycle(nodeId: string): boolean {
    if (recStack.has(nodeId)) return true;
    if (visited.has(nodeId)) return false;

    visited.add(nodeId);
    recStack.add(nodeId);

    const neighbors = graph.get(nodeId) || [];
    for (const neighbor of neighbors) {
      if (hasCycle(neighbor)) return true;
    }

    recStack.delete(nodeId);
    return false;
  }

  for (const nodeId of graph.keys()) {
    if (hasCycle(nodeId)) return true;
  }

  return false;
}

/**
 * Truncate string
 */
function truncate(str: string, maxLen: number): string {
  if (str.length <= maxLen) return str;
  return str.substring(0, maxLen - 1) + '…';
}

