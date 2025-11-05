/**
 * Workflow node and edge type definitions
 */

/**
 * @typedef {"trigger.facebook.comment" | "trigger.webhook.inbound" | "trigger.scheduler.cron" | "logic.filter" | "ai.guard" | "ai.generate" | "action.facebook.reply" | "action.facebook.dm" | "action.telegram.sendMessage" | "action.email.send" | "action.sheets.appendRow" | "action.http.request"} NodeKind
 */

/**
 * @typedef {Object} NodeConfig
 * @property {any} [key] - Configuration key-value pairs
 */

/**
 * @typedef {Object} RfNodeData
 * @property {NodeKind} kind - The kind/type of the node
 * @property {string} label - Human-readable label for the node
 * @property {NodeConfig} config - Node-specific configuration
 */

/**
 * @typedef {Object} RfEdgeData
 * @property {string} [label] - Optional label for the edge
 */

export const NODE_KINDS = {
  TRIGGERS: {
    FACEBOOK_COMMENT: "trigger.facebook.comment",
    WEBHOOK_INBOUND: "trigger.webhook.inbound",
    SCHEDULER_CRON: "trigger.scheduler.cron",
  },
  LOGIC: {
    FILTER: "logic.filter",
    AI_GUARD: "ai.guard",
    AI_GENERATE: "ai.generate",
  },
  ACTIONS: {
    FACEBOOK_REPLY: "action.facebook.reply",
    FACEBOOK_DM: "action.facebook.dm",
    TELEGRAM_SEND: "action.telegram.sendMessage",
    EMAIL_SEND: "action.email.send",
    SHEETS_APPEND: "action.sheets.appendRow",
    HTTP_REQUEST: "action.http.request",
  },
}

export default {
  NODE_KINDS,
}

