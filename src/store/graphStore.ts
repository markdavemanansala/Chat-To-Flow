/**
 * @fileoverview Graph store - Single source of truth for workflow graph
 */

import { create } from 'zustand';
import type { Node, Edge } from 'reactflow';
import type { GraphPatch, PatchResult, RfNodeData } from '../types/graph';
import { applyPatch as applyGraphPatch } from '../workflow/patches';
import { generateNodeLabel } from '../workflow/labeler';
import { getNodeRole } from '../workflow/graphTypes';

// Event bus for graph events
class EventBus {
  private listeners = new Map<string, Array<(data: any) => void>>();

  on(event: string, callback: (data: any) => void) {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, []);
    }
    this.listeners.get(event)!.push(callback);
  }

  off(event: string, callback: (data: any) => void) {
    const callbacks = this.listeners.get(event);
    if (callbacks) {
      const index = callbacks.indexOf(callback);
      if (index > -1) {
        callbacks.splice(index, 1);
      }
    }
  }

  emit(event: string, data: any) {
    const callbacks = this.listeners.get(event);
    if (callbacks) {
      callbacks.forEach(callback => callback(data));
    }
  }
}

const eventBus = new EventBus();

// History management
interface HistoryState {
  nodes: Node<RfNodeData>[];
  edges: Edge[];
}

function createHistory() {
  const history: HistoryState[] = [];
  let currentIndex = -1;

  return {
    push(state: HistoryState) {
      if (currentIndex < history.length - 1) {
        history.splice(currentIndex + 1);
      }
      history.push(JSON.parse(JSON.stringify(state)));
      currentIndex = history.length - 1;
      
      if (history.length > 50) {
        history.shift();
        currentIndex--;
      }
    },
    undo(): HistoryState | null {
      if (currentIndex > 0) {
        currentIndex--;
        return JSON.parse(JSON.stringify(history[currentIndex]));
      }
      return null;
    },
    redo(): HistoryState | null {
      if (currentIndex < history.length - 1) {
        currentIndex++;
        return JSON.parse(JSON.stringify(history[currentIndex]));
      }
      return null;
    },
    canUndo(): boolean {
      return currentIndex > 0;
    },
    canRedo(): boolean {
      return currentIndex < history.length - 1;
    },
  };
}

interface GraphStore {
  // State
  nodes: Node<RfNodeData>[];
  edges: Edge[];
  graphName: string;
  historyRef: { current: ReturnType<typeof createHistory> };

  // Actions
  setFlow: (nodes: Node<RfNodeData>[], edges: Edge[]) => void;
  setEdges: (edges: Edge[]) => void;
  applyPatch: (patch: GraphPatch) => PatchResult & { nodes: Node<RfNodeData>[]; edges: Edge[] };
  undo: () => boolean;
  redo: () => boolean;
  canUndo: () => boolean;
  canRedo: () => boolean;
  resetFlow: () => void;
  setGraphName: (name: string) => void;

  // Event bus
  onGraphChange: (callback: (data: { nodes: Node<RfNodeData>[]; edges: Edge[] }) => void) => () => void;
  onPatchApplied: (callback: (data: { patch: GraphPatch; result: any }) => void) => () => void;
  onPatchFailed: (callback: (data: { patch: GraphPatch; result: any }) => void) => () => void;
}

export const useGraphStore = create<GraphStore>((set, get) => {
  const historyRef = { current: createHistory() };

  return {
    // Initial state
    nodes: [],
    edges: [],
    graphName: 'New Workflow',
    historyRef,

    // Set flow (nodes + edges)
    setFlow: (nodes, edges) => {
      const state = get();
      
      // Detect changes
      const nodeIdsChanged = JSON.stringify(state.nodes.map(n => n.id)) !== JSON.stringify(nodes.map(n => n.id));
      const nodePositionsChanged = JSON.stringify(state.nodes.map(n => ({ id: n.id, position: n.position }))) !== 
                                    JSON.stringify(nodes.map(n => ({ id: n.id, position: n.position })));
      const edgesChanged = JSON.stringify(state.edges.map(e => e.id)) !== JSON.stringify(edges.map(e => e.id));
      
      if (nodeIdsChanged || nodePositionsChanged || edgesChanged) {
        set({ nodes, edges });
        historyRef.current.push({ nodes, edges });
        eventBus.emit('graph-changed', { nodes, edges });
      }
    },

    // Set edges only
    setEdges: (edges) => {
      const state = get();
      set({ edges });
      historyRef.current.push({ nodes: state.nodes, edges });
      eventBus.emit('graph-changed', { nodes: state.nodes, edges });
    },

    // Apply patch (main entry point for all graph changes)
    applyPatch: (patch) => {
      const state = get();
      console.log('🔧 Store applyPatch called:', patch.op, {
        currentNodes: state.nodes.length,
        currentEdges: state.edges.length,
        patch: patch
      });
      
      const result = applyGraphPatch(patch, state.nodes, state.edges);
      console.log('🔧 Patch result:', {
        ok: result.ok,
        nodesCount: result.nodes?.length || 0,
        edgesCount: result.edges?.length || 0,
        issues: result.issues
      });
      
      if (result.ok) {
        // Validate and clean nodes
        const validNodes = (result.nodes || []).filter(n => {
          if (!n || !n.id || !n.data) {
            console.warn('⚠️ Filtering invalid node:', n);
            return false;
          }
          
          // Recompute label if config changed
          if (patch.op === 'UPDATE_NODE' && patch.id === n.id && patch.data?.config) {
            n.data.label = generateNodeLabel(n.data.kind, patch.data.config);
          }
          
          return true;
        });

        console.log('🔧 Valid nodes after filtering:', validNodes.length);

        const newNodes = validNodes.map(n => ({
          ...n,
          data: { ...n.data },
          position: { ...n.position }
        }));
        const newEdges = (result.edges || []).map(e => ({ ...e }));

        console.log('🔧 Setting new state:', {
          nodes: newNodes.length,
          edges: newEdges.length,
          nodeIds: newNodes.map(n => n.id)
        });

        set({ nodes: newNodes, edges: newEdges });
        historyRef.current.push({ nodes: newNodes, edges: newEdges });
        
        eventBus.emit('graph-changed', { nodes: newNodes, edges: newEdges });
        eventBus.emit('patch-applied', { patch, result });
        
        console.log('🔧 State updated, new state:', {
          nodes: get().nodes.length,
          edges: get().edges.length
        });
      } else {
        console.error('❌ Patch failed:', result.issues);
        eventBus.emit('patch-failed', { patch, result });
      }
      
      return result;
    },

    // Undo/Redo
    undo: () => {
      const previous = historyRef.current.undo();
      if (previous) {
        set({ nodes: previous.nodes, edges: previous.edges });
        eventBus.emit('graph-changed', { nodes: previous.nodes, edges: previous.edges });
        return true;
      }
      return false;
    },

    redo: () => {
      const next = historyRef.current.redo();
      if (next) {
        set({ nodes: next.nodes, edges: next.edges });
        eventBus.emit('graph-changed', { nodes: next.nodes, edges: next.edges });
        return true;
      }
      return false;
    },

    canUndo: () => historyRef.current.canUndo(),
    canRedo: () => historyRef.current.canRedo(),

    // Reset
    resetFlow: () => {
      set({ nodes: [], edges: [] });
      historyRef.current.push({ nodes: [], edges: [] });
      eventBus.emit('graph-changed', { nodes: [], edges: [] });
    },

    // Set graph name
    setGraphName: (name: string) => {
      set({ graphName: name });
    },

    // Event bus access
    onGraphChange: (callback) => {
      eventBus.on('graph-changed', callback);
      return () => eventBus.off('graph-changed', callback);
    },

    onPatchApplied: (callback) => {
      eventBus.on('patch-applied', callback);
      return () => eventBus.off('patch-applied', callback);
    },

    onPatchFailed: (callback) => {
      eventBus.on('patch-failed', callback);
      return () => eventBus.off('patch-failed', callback);
    },
  };
});

// Convenience hooks
export const useNodes = () => useGraphStore((state) => state.nodes);
export const useEdges = () => useGraphStore((state) => state.edges);
export const useGraphName = () => useGraphStore((state) => state.graphName);
export const useSetFlow = () => useGraphStore((state) => state.setFlow);
export const useSetEdges = () => useGraphStore((state) => state.setEdges);
export const useApplyPatch = () => useGraphStore((state) => state.applyPatch);
export const useUndo = () => useGraphStore((state) => state.undo);
export const useRedo = () => useGraphStore((state) => state.redo);
export const useCanUndo = () => useGraphStore((state) => state.canUndo());
export const useCanRedo = () => useGraphStore((state) => state.canRedo());
export const useResetFlow = () => useGraphStore((state) => state.resetFlow);
export const useSetGraphName = () => useGraphStore((state) => state.setGraphName);
export const useOnGraphChange = () => useGraphStore((state) => state.onGraphChange);
export const useOnPatchApplied = () => useGraphStore((state) => state.onPatchApplied);
export const useOnPatchFailed = () => useGraphStore((state) => state.onPatchFailed);

