/**
 * @fileoverview Authoritative type definitions for workflow graph
 */

export type NodeRole = "TRIGGER" | "LOGIC" | "AI" | "ACTION";

export type NodeKind =
  | "trigger.facebook.comment"
  | "trigger.webhook.inbound"
  | "trigger.scheduler.cron"
  | "trigger.sheets.newRow"
  | "trigger.sheets.update"
  | "logic.filter"
  | "ai.guard"
  | "ai.generate"
  | "action.facebook.reply"
  | "action.facebook.dm"
  | "action.telegram.sendMessage"
  | "action.telegram.sendPhoto"
  | "action.telegram.sendDocument"
  | "action.telegram.sendLocation"
  | "action.telegram.sendPoll"
  | "action.telegram.editMessage"
  | "action.telegram.deleteMessage"
  | "action.telegram.sendVideo"
  | "action.telegram.sendAudio"
  | "action.telegram.sendSticker"
  | "action.telegram.sendVenue"
  | "action.telegram.sendContact"
  | "action.telegram.getUpdates"
  | "action.email.send"
  | "action.sheets.appendRow"
  | "action.sheets.readRows"
  | "action.sheets.updateCell"
  | "action.sheets.clearRange"
  | "action.http.request";

export type NodeConfig = Record<string, any>;

export type RfNodeData = {
  kind: NodeKind;
  role: NodeRole;
  label: string;      // human-friendly, auto-generated (see labeler)
  config: NodeConfig; // per kind
};

export type GraphPatch =
  | { op: "ADD_NODE"; node: import("reactflow").Node<RfNodeData> }
  | { op: "UPDATE_NODE"; id: string; data?: Partial<RfNodeData>; position?: { x: number; y: number } }
  | { op: "REMOVE_NODE"; id: string }
  | { op: "ADD_EDGE"; edge: import("reactflow").Edge }
  | { op: "REMOVE_EDGE"; id: string }
  | { op: "REWIRE"; from: string; to: string; edgeId?: string }
  | { op: "SET_NAME"; name: string }
  | { op: "BULK"; ops: GraphPatch[] };

export type PatchResult = {
  ok: boolean;
  issues?: string[];
};

export type ValidationResult = {
  ok: boolean;
  issues: string[];
  warnings?: string[];
};

