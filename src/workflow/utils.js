import { getRectOfNodes } from 'reactflow';
import { getNodeRole } from './graphTypes.js';

/**
 * Create a new node with the given kind
 * @param {string} kind - The node kind/type
 * @param {Partial<import('reactflow').Node>} [partial] - Optional partial node properties
 * @returns {import('reactflow').Node}
 */
export function createNode(kind, partial = {}) {
  const id = partial.id || `node_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  
  // Get default label based on kind
  const defaultLabel = getDefaultLabel(kind)
  
  return {
    id,
    type: 'default',
    position: partial.position || { x: 100, y: 100 },
    data: {
      kind,
      label: partial.data?.label || partial.label || defaultLabel,
      config: partial.data?.config || partial.config || {},
      role: partial.data?.role || getNodeRole(kind),
      ...partial.data,
    },
    ...partial,
  }
}

/**
 * Get default label for a node kind
 * @param {string} kind - The node kind
 * @returns {string} Default label
 */
function getDefaultLabel(kind) {
  const labelMap = {
    'trigger.facebook.comment': 'Facebook Comment',
    'trigger.webhook.inbound': 'Webhook',
    'trigger.scheduler.cron': 'Schedule',
    'logic.filter': 'Filter',
    'ai.guard': 'AI Guard',
    'ai.generate': 'AI Generate',
    'action.facebook.reply': 'Facebook Reply',
    'action.facebook.dm': 'Facebook DM',
    'action.telegram.sendMessage': 'Send Telegram',
    'action.email.send': 'Send Email',
    'action.sheets.appendRow': 'Add to Sheets',
    'action.http.request': 'HTTP Request',
  }
  
  return labelMap[kind] || kind
}

/**
 * Create an edge connecting two nodes
 * @param {string} sourceId - Source node ID
 * @param {string} targetId - Target node ID
 * @param {string} [label] - Optional edge label
 * @returns {import('reactflow').Edge}
 */
export function connect(sourceId, targetId, label) {
  return {
    id: `edge_${sourceId}_${targetId}_${Date.now()}`,
    source: sourceId,
    target: targetId,
    type: 'default',
    animated: false,
    data: {
      label: label || '',
    },
  }
}

/**
 * Generate a unique ID for nodes/edges
 * @param {string} prefix - Prefix for the ID
 * @returns {string} Unique ID
 */
export function generateId(prefix = 'id') {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
}

/**
 * Validate node data structure
 * @param {any} node - Node to validate
 * @returns {boolean} True if valid
 */
export function isValidNode(node) {
  return (
    node &&
    typeof node.id === 'string' &&
    node.data &&
    typeof node.data.kind === 'string' &&
    typeof node.data.label === 'string' &&
    typeof node.data.config === 'object'
  )
}

/**
 * Validate edge data structure
 * @param {any} edge - Edge to validate
 * @returns {boolean} True if valid
 */
export function isValidEdge(edge) {
  return (
    edge &&
    typeof edge.id === 'string' &&
    typeof edge.source === 'string' &&
    typeof edge.target === 'string'
  )
}

