/**
 * @fileoverview Graph summarization for AI context
 */

/**
 * Summarize the graph into a human-readable string for AI context
 * @param {import('reactflow').Node[]} nodes
 * @param {import('reactflow').Edge[]} edges
 * @returns {string}
 */
export function summarizeGraph(nodes, edges) {
  if (nodes.length === 0) {
    return 'Empty workflow (no nodes)';
  }

  const trigger = nodes.find(n => n.data?.role === 'TRIGGER');
  const triggerDesc = trigger 
    ? `${trigger.data?.label || trigger.id}${trigger.data?.config ? ` (${JSON.stringify(trigger.data.config)})` : ''}`
    : 'No trigger';

  // Build ordered steps
  const steps = getOrderedSteps(nodes, edges, trigger?.id);
  const stepsDesc = steps.length > 0
    ? steps.map((step, idx) => {
        const node = nodes.find(n => n.id === step);
        const config = node?.data?.config ? ` ${JSON.stringify(node.data.config)}` : '';
        const nodeId = node?.id ? ` (id:${node.id})` : '';
        return `${idx + 1}. ${node?.data?.label || step}${nodeId}${config}`;
      }).join('\n')
    : 'No steps';

  // Extract integrations
  const integrations = extractIntegrations(nodes);

  return `Workflow Summary:
Trigger: ${triggerDesc}
Steps (in order):
${stepsDesc}
Integrations: ${integrations.join(', ') || 'None'}`;
}

/**
 * Get ordered step IDs starting from trigger
 * @param {import('reactflow').Node[]} nodes
 * @param {import('reactflow').Edge[]} edges
 * @param {string} [startNodeId]
 * @returns {string[]}
 */
function getOrderedSteps(nodes, edges, startNodeId) {
  if (!startNodeId) {
    // No trigger, return all non-trigger nodes in arbitrary order
    return nodes.filter(n => n.data?.role !== 'TRIGGER').map(n => n.id);
  }

  const visited = new Set();
  const result = [];
  const graph = new Map();
  
  // Build adjacency list
  nodes.forEach(n => graph.set(n.id, []));
  edges.forEach(e => {
    const list = graph.get(e.source) || [];
    list.push(e.target);
    graph.set(e.source, list);
  });

  function dfs(nodeId) {
    if (visited.has(nodeId)) return;
    visited.add(nodeId);
    
    const node = nodes.find(n => n.id === nodeId);
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
  nodes.forEach(n => {
    if (!visited.has(n.id) && n.data?.role !== 'TRIGGER') {
      result.push(n.id);
    }
  });

  return result;
}

/**
 * Extract integrations from nodes
 * @param {import('reactflow').Node[]} nodes
 * @returns {string[]}
 */
function extractIntegrations(nodes) {
  const integrationMap = {
    'trigger.facebook.comment': 'Facebook',
    'action.facebook.reply': 'Facebook',
    'action.facebook.dm': 'Facebook',
    'action.telegram.sendMessage': 'Telegram',
    'action.email.send': 'Email',
    'action.sheets.appendRow': 'Google Sheets',
    'action.http.request': 'HTTP',
  };

  const integrations = new Set();
  nodes.forEach(node => {
    const integration = integrationMap[node.data?.kind];
    if (integration) {
      integrations.add(integration);
    }
  });

  return Array.from(integrations);
}

