/**
 * Workflow node and edge type definitions
 */

/**
 * @typedef {"trigger.facebook.comment" | "trigger.webhook.inbound" | "trigger.scheduler.cron" | "trigger.sheets.newRow" | "trigger.sheets.update" | "logic.filter" | "ai.guard" | "ai.generate" | "action.facebook.reply" | "action.facebook.dm" | "action.telegram.sendMessage" | "action.telegram.sendPhoto" | "action.telegram.sendDocument" | "action.telegram.sendLocation" | "action.telegram.sendPoll" | "action.telegram.editMessage" | "action.telegram.deleteMessage" | "action.telegram.sendVideo" | "action.telegram.sendAudio" | "action.telegram.sendSticker" | "action.telegram.sendVenue" | "action.telegram.sendContact" | "action.telegram.getUpdates" | "action.email.send" | "action.sheets.appendRow" | "action.sheets.readRows" | "action.sheets.updateCell" | "action.sheets.clearRange" | "action.http.request"} NodeKind
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
    SHEETS_NEW_ROW: "trigger.sheets.newRow",
    SHEETS_UPDATE: "trigger.sheets.update",
  },
  LOGIC: {
    FILTER: "logic.filter",
    AI_GUARD: "ai.guard",
    AI_GENERATE: "ai.generate",
  },
  ACTIONS: {
    FACEBOOK_REPLY: "action.facebook.reply",
    FACEBOOK_DM: "action.facebook.dm",
    TELEGRAM_SEND_MESSAGE: "action.telegram.sendMessage",
    TELEGRAM_SEND_PHOTO: "action.telegram.sendPhoto",
    TELEGRAM_SEND_DOCUMENT: "action.telegram.sendDocument",
    TELEGRAM_SEND_LOCATION: "action.telegram.sendLocation",
    TELEGRAM_SEND_POLL: "action.telegram.sendPoll",
    TELEGRAM_EDIT_MESSAGE: "action.telegram.editMessage",
    TELEGRAM_DELETE_MESSAGE: "action.telegram.deleteMessage",
    TELEGRAM_SEND_VIDEO: "action.telegram.sendVideo",
    TELEGRAM_SEND_AUDIO: "action.telegram.sendAudio",
    TELEGRAM_SEND_STICKER: "action.telegram.sendSticker",
    TELEGRAM_SEND_VENUE: "action.telegram.sendVenue",
    TELEGRAM_SEND_CONTACT: "action.telegram.sendContact",
    TELEGRAM_GET_UPDATES: "action.telegram.getUpdates",
    EMAIL_SEND: "action.email.send",
    SHEETS_APPEND: "action.sheets.appendRow",
    SHEETS_READ: "action.sheets.readRows",
    SHEETS_UPDATE_CELL: "action.sheets.updateCell",
    SHEETS_CLEAR: "action.sheets.clearRange",
    HTTP_REQUEST: "action.http.request",
  },
}

export default {
  NODE_KINDS,
}

