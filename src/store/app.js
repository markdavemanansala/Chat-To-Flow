import { create } from 'zustand';

/**
 * @typedef {import('reactflow').Node} ReactFlowNode
 * @typedef {import('reactflow').Edge} ReactFlowEdge
 */

/**
 * @typedef {Object} RfNodeData
 * @property {string} kind
 * @property {string} label
 * @property {Object} config
 */

/**
 * @typedef {Object} RfEdgeData
 * @property {string} [label]
 */

/**
 * @typedef {Object} FlowState
 * @property {ReactFlowNode<RfNodeData>[]} nodes
 * @property {ReactFlowEdge<RfEdgeData>[]} edges
 * @property {function(ReactFlowNode<RfNodeData>[], ReactFlowEdge<RfEdgeData>[]): void} setFlow
 * @property {function(ReactFlowNode<RfNodeData>): void} upsertNode
 * @property {function(ReactFlowEdge<RfEdgeData>[]): void} setEdges
 * @property {function(): void} resetFlow
 */

/**
 * @typedef {Object} AppState
 * @property {import('../types').Template | undefined} selectedTemplate
 * @property {import('../types').WorkflowSummary | undefined} workflowSummary
 * @property {ReactFlowNode<RfNodeData>[]} nodes
 * @property {ReactFlowEdge<RfEdgeData>[]} edges
 * @property {function(import('../types').Template | undefined): void} setTemplate
 * @property {function(import('../types').WorkflowSummary | undefined): void} setWorkflow
 * @property {function(): void} resetAll
 * @property {function(ReactFlowNode<RfNodeData>[], ReactFlowEdge<RfEdgeData>[]): void} setFlow
 * @property {function(ReactFlowNode<RfNodeData>): void} upsertNode
 * @property {function(ReactFlowEdge<RfEdgeData>[]): void} setEdges
 * @property {function(): void} resetFlow
 */

/**
 * Zustand store for app state management
 * @type {import('zustand').UseBoundStore<import('zustand').StoreApi<AppState>>}
 */
export const useAppStore = create((set) => ({
  // Existing state
  selectedTemplate: undefined,
  workflowSummary: undefined,

  // Flow state (React Flow)
  nodes: [],
  edges: [],

  // Existing actions
  setTemplate: (template) => set({ selectedTemplate: template }),
  setWorkflow: (workflow) => set({ workflowSummary: workflow }),
  resetAll: () => set({ 
    selectedTemplate: undefined, 
    workflowSummary: undefined,
    nodes: [],
    edges: [],
  }),

  // Flow actions
  setFlow: (nodes, edges) => set({ nodes, edges }),
  upsertNode: (node) => set((state) => {
    const existingIndex = state.nodes.findIndex(n => n.id === node.id)
    if (existingIndex >= 0) {
      const newNodes = [...state.nodes]
      newNodes[existingIndex] = node
      return { nodes: newNodes }
    }
    return { nodes: [...state.nodes, node] }
  }),
  setEdges: (edges) => set({ edges }),
  resetFlow: () => set({ nodes: [], edges: [] }),
}));

// Convenience hooks for reading existing state
export const useSelectedTemplate = () => useAppStore((state) => state.selectedTemplate);
export const useWorkflowSummary = () => useAppStore((state) => state.workflowSummary);

// Convenience hooks for existing actions
export const useSetTemplate = () => useAppStore((state) => state.setTemplate);
export const useSetWorkflow = () => useAppStore((state) => state.setWorkflow);
export const useResetAll = () => useAppStore((state) => state.resetAll);

// Convenience hooks for flow state
export const useNodes = () => useAppStore((state) => state.nodes);
export const useEdges = () => useAppStore((state) => state.edges);

// Convenience hooks for flow actions
export const useSetFlow = () => useAppStore((state) => state.setFlow);
export const useUpsertNode = () => useAppStore((state) => state.upsertNode);
export const useSetEdges = () => useAppStore((state) => state.setEdges);
export const useResetFlow = () => useAppStore((state) => state.resetFlow);
