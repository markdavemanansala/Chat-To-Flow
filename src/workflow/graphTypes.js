/**
 * @fileoverview Type definitions for workflow graph operations
 */

/**
 * @typedef {"trigger.facebook.comment"|"trigger.webhook.inbound"|"trigger.scheduler.cron"|"trigger.sheets.newRow"|"trigger.sheets.update"|"logic.filter"|"ai.guard"|"ai.generate"|"action.facebook.reply"|"action.facebook.dm"|"action.telegram.sendMessage"|"action.telegram.sendPhoto"|"action.telegram.sendDocument"|"action.telegram.sendLocation"|"action.telegram.sendPoll"|"action.telegram.editMessage"|"action.telegram.deleteMessage"|"action.telegram.sendVideo"|"action.telegram.sendAudio"|"action.telegram.sendSticker"|"action.telegram.sendVenue"|"action.telegram.sendContact"|"action.telegram.getUpdates"|"action.email.send"|"action.sheets.appendRow"|"action.sheets.readRows"|"action.sheets.updateCell"|"action.sheets.clearRange"|"action.http.request"} NodeKind
 * Node kind types - must match exactly
 */

/**
 * @typedef {Object} RfNodeData
 * @property {NodeKind} kind
 * @property {string} label
 * @property {Record<string, any>} config
 * @property {"TRIGGER"|"LOGIC"|"AI"|"ACTION"} role
 */

/**
 * @typedef {Object} GraphPatch
 * @property {string} op - Operation type
 * @property {import('reactflow').Node} [node] - Node for ADD_NODE
 * @property {string} [id] - ID for UPDATE_NODE, REMOVE_NODE, REMOVE_EDGE
 * @property {Partial<RfNodeData>} [data] - Data for UPDATE_NODE
 * @property {{x:number,y:number}} [position] - Position for UPDATE_NODE
 * @property {import('reactflow').Edge} [edge] - Edge for ADD_EDGE
 * @property {string} [from] - Source for REWIRE
 * @property {string} [to] - Target for REWIRE
 * @property {string} [edgeId] - Edge ID for REWIRE
 * @property {string} [name] - Name for SET_NAME
 * @property {GraphPatch[]} [ops] - Operations for BULK
 */

/**
 * @typedef {Object} PatchResult
 * @property {boolean} ok
 * @property {string[]} [issues]
 */

/**
 * Get the role for a given node kind
 * @param {NodeKind} kind
 * @returns {"TRIGGER"|"LOGIC"|"AI"|"ACTION"}
 */
export function getNodeRole(kind) {
  if (!kind || typeof kind !== 'string') {
    return 'ACTION'; // Default fallback for invalid/undefined kind
  }
  if (kind.startsWith('trigger.')) return 'TRIGGER';
  if (kind.startsWith('logic.')) return 'LOGIC';
  if (kind.startsWith('ai.')) return 'AI';
  if (kind.startsWith('action.')) return 'ACTION';
  return 'ACTION'; // Default fallback
}

