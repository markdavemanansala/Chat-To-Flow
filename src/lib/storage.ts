/**
 * @fileoverview LocalStorage persistence for workflow drafts
 */

import type { Node, Edge } from 'reactflow';
import type { RfNodeData } from '../types/graph';

const DRAFT_KEY = 'workflow_draft';

export interface DraftData {
  name: string;
  nodes: Node<RfNodeData>[];
  edges: Edge[];
  ts: number;
}

/**
 * Save workflow draft to localStorage
 */
export function saveWorkflowDraft(data: { name: string; nodes: Node<RfNodeData>[]; edges: Edge[] }): void {
  try {
    const draft: DraftData = {
      name: data.name,
      nodes: data.nodes,
      edges: data.edges,
      ts: Date.now(),
    };
    localStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
  } catch (error) {
    console.error('Failed to save draft:', error);
  }
}

/**
 * Load workflow draft from localStorage
 */
export function loadWorkflowDraft(): DraftData | null {
  try {
    const stored = localStorage.getItem(DRAFT_KEY);
    if (!stored) return null;
    return JSON.parse(stored);
  } catch (error) {
    console.error('Failed to load draft:', error);
    return null;
  }
}

/**
 * Clear workflow draft from localStorage
 */
export function clearWorkflowDraft(): void {
  try {
    localStorage.removeItem(DRAFT_KEY);
  } catch (error) {
    console.error('Failed to clear draft:', error);
  }
}

