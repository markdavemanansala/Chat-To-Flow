/**
 * @fileoverview Authoritative type definitions for workflow graph
 */

export type NodeRole = "TRIGGER" | "LOGIC" | "AI" | "ACTION";

export type NodeKind =
  | "trigger.facebook.comment"
  | "trigger.webhook.inbound"
  | "trigger.scheduler.cron"
  | "logic.filter"
  | "ai.guard"
  | "ai.generate"
  | "action.facebook.reply"
  | "action.facebook.dm"
  | "action.telegram.sendMessage"
  | "action.email.send"
  | "action.sheets.appendRow"
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

