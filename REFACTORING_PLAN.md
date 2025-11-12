# Workflow Builder Refactoring Plan

## Overview
Complete refactoring of the workflow builder according to the specification. This document tracks progress.

## File Structure Changes

### New Structure
```
src/
  types/
    graph.ts                 ✅ Created
  store/
    graphStore.ts            ⏳ In Progress
    uiStore.ts               ⏳ Pending
    aiStore.ts               ⏳ Pending
  workflow/
    summarize.ts             ⏳ Pending (migrate from graphSummary.js)
    validate.ts              ⏳ Pending (migrate from graphPatch.js)
    labeler.ts               ⏳ Pending (NEW - per-kind label generation)
    patches.ts               ⏳ Pending (migrate from graphPatch.js)
    dnd.ts                   ⏳ Pending (NEW - drag-n-drop helpers)
  components/
    builder/
      BuilderShell.tsx       ⏳ Pending
      LeftPanel/
        ChatPanel.tsx        ⏳ Pending
        NodeCatalog.tsx      ⏳ Pending (update existing)
      RightPanel/
        SimpleCanvas.tsx     ⏳ Pending (migrate from SimpleFlowView.tsx)
        FlowCanvas.tsx       ⏳ Pending (migrate from WorkflowCanvas.tsx)
        NodeInspector.tsx    ⏳ Pending (update existing)
        Toolbar.tsx          ⏳ Pending (NEW)
        Console.tsx          ⏳ Pending (optional)
  lib/
    debounce.ts              ✅ Created
    id.ts                    ✅ Created
    storage.ts               ⏳ Pending (NEW - localStorage helpers)
```

## Implementation Order

1. ✅ Create types/graph.ts
2. ✅ Create lib/debounce.ts and lib/id.ts
3. ⏳ Create store/graphStore.ts (split from app.js)
4. ⏳ Create store/aiStore.ts (split from app.js)
5. ⏳ Create store/uiStore.ts (new)
6. ⏳ Create workflow/labeler.ts (per-kind label generation)
7. ⏳ Migrate workflow/summarize.ts (enhance graphSummary.js)
8. ⏳ Migrate workflow/validate.ts (extract from graphPatch.js)
9. ⏳ Migrate workflow/patches.ts (extract from graphPatch.js)
10. ⏳ Create components/builder structure
11. ⏳ Migrate components one by one
12. ⏳ Add persistence and keyboard shortcuts
13. ⏳ Testing and validation

## Key Principles

- **Single Source of Truth**: All graph state in graphStore
- **Patch-Based Changes**: All programmatic changes via applyPatch
- **Two-Way Sync**: Chat → Graph via patches, Manual edits → AI via summary
- **Mode Invariant**: Switching modes preserves graph fidelity
- **Labeling**: Centralized, per-kind rules, max 24 chars
- **Summarization**: Deterministic, compact, debounced updates

## Migration Strategy

1. Create new stores alongside existing app.js
2. Create new utilities alongside existing ones
3. Migrate components one at a time
4. Update imports gradually
5. Remove old code once migration complete

