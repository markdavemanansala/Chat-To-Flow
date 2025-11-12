/**
 * @fileoverview Keyboard shortcuts for workflow builder
 */

import { useEffect } from 'react';

export interface KeyboardShortcuts {
  onDelete?: () => void;
  onUndo?: () => void;
  onRedo?: () => void;
  onSave?: () => void;
  onExport?: () => void;
  enabled?: boolean;
}

/**
 * Hook for keyboard shortcuts
 * Supports: Del, Cmd/Ctrl+Z (undo), Cmd/Ctrl+Y (redo), Cmd/Ctrl+S (save), Cmd/Ctrl+E (export)
 */
export function useKeyboardShortcuts({
  onDelete,
  onUndo,
  onRedo,
  onSave,
  onExport,
  enabled = true,
}: KeyboardShortcuts) {
  useEffect(() => {
    if (!enabled) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      // Delete key
      if (e.key === 'Delete' || e.key === 'Backspace') {
        if (onDelete && !isInputFocused()) {
          e.preventDefault();
          onDelete();
        }
        return;
      }

      // Check for modifier keys
      const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;
      const modifier = isMac ? e.metaKey : e.ctrlKey;

      if (!modifier) return;

      // Undo: Cmd/Ctrl+Z
      if (e.key === 'z' || e.key === 'Z') {
        if (onUndo && !e.shiftKey) {
          e.preventDefault();
          onUndo();
        }
        return;
      }

      // Redo: Cmd/Ctrl+Y or Cmd/Ctrl+Shift+Z
      if (e.key === 'y' || e.key === 'Y' || (e.key === 'z' && e.shiftKey)) {
        if (onRedo) {
          e.preventDefault();
          onRedo();
        }
        return;
      }

      // Save: Cmd/Ctrl+S
      if (e.key === 's' || e.key === 'S') {
        if (onSave) {
          e.preventDefault();
          onSave();
        }
        return;
      }

      // Export: Cmd/Ctrl+E
      if (e.key === 'e' || e.key === 'E') {
        if (onExport) {
          e.preventDefault();
          onExport();
        }
        return;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onDelete, onUndo, onRedo, onSave, onExport, enabled]);
}

/**
 * Check if an input/textarea/contenteditable is focused
 */
function isInputFocused(): boolean {
  const activeElement = document.activeElement;
  if (!activeElement) return false;

  const tagName = activeElement.tagName.toLowerCase();
  if (tagName === 'input' || tagName === 'textarea') return true;
  if (activeElement.getAttribute('contenteditable') === 'true') return true;

  return false;
}

