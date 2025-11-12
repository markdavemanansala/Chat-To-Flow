/**
 * @fileoverview Toolbar with validation chips and workflow controls
 */

// @ts-nocheck
import { useCallback, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useNodes, useEdges, useResetFlow, useUndo, useRedo, useCanUndo, useCanRedo, useSetFlow } from '@/store/graphStore';
import { useAddToast } from '@/store/uiStore';
import { validateGraph } from '@/workflow/validate';
import { useViewMode } from '@/store/uiStore';
import { executeWorkflow } from '@/workflow/executor';

export default function Toolbar() {
  const nodes = useNodes();
  const edges = useEdges();
  const resetFlow = useResetFlow();
  const undo = useUndo();
  const redo = useRedo();
  const canUndo = useCanUndo();
  const canRedo = useCanRedo();
  const addToast = useAddToast();
  const mode = useViewMode();
  const setFlow = useSetFlow();
  const [isExecuting, setIsExecuting] = useState(false);

  const handleExport = useCallback(() => {
    const data = { nodes, edges };
    const json = JSON.stringify(data, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'workflow.json';
    a.click();
    URL.revokeObjectURL(url);
    addToast({ type: 'ok', text: 'Workflow exported successfully' });
  }, [nodes, edges, addToast]);

  const handleImport = useCallback(() => {
    const jsonStr = window.prompt('Paste JSON with {nodes, edges}:');
    if (!jsonStr) return;

    try {
      const data = JSON.parse(jsonStr);
      if (!data.nodes || !data.edges || !Array.isArray(data.nodes) || !Array.isArray(data.edges)) {
        throw new Error('Invalid format: expected {nodes: [], edges: []}');
      }
      setFlow(data.nodes, data.edges);
      addToast({ type: 'ok', text: 'Workflow imported successfully' });
    } catch (err: any) {
      addToast({ type: 'error', text: `Import failed: ${err.message}` });
    }
  }, [addToast, setFlow]);

  const handleValidate = useCallback(() => {
    const result = validateGraph(nodes, edges);
    if (result.ok) {
      addToast({ type: 'ok', text: 'Workflow is valid!' });
    } else {
      const criticalIssues = result.issues?.filter(
        (issue) => !result.warnings?.includes(issue)
      ) || [];
      if (criticalIssues.length > 0) {
        addToast({ type: 'error', text: `Validation issues: ${criticalIssues.join(', ')}` });
      } else {
        addToast({ type: 'warn', text: `Validation warnings: ${result.warnings?.join(', ')}` });
      }
    }
  }, [nodes, edges, addToast]);

  const handleReset = useCallback(() => {
    if (window.confirm('Are you sure you want to reset the workflow? This cannot be undone.')) {
      resetFlow();
      addToast({ type: 'ok', text: 'Workflow reset!' });
    }
  }, [resetFlow, addToast]);

  const handleRun = useCallback(async () => {
    // Validate first
    const validation = validateGraph(nodes, edges);
    if (!validation.ok) {
      const criticalIssues = validation.issues?.filter(
        (issue) => !validation.warnings?.includes(issue)
      ) || [];
      if (criticalIssues.length > 0) {
        addToast({ type: 'error', text: `Cannot run: ${criticalIssues.join(', ')}` });
        return;
      }
    }

    setIsExecuting(true);
    addToast({ type: 'ok', text: 'Running workflow...' });

    try {
      // Execute workflow with mock payload
      const result = await executeWorkflow(nodes, edges, {
        test: true,
        timestamp: new Date().toISOString(),
      });

      if (result.success) {
        const successCount = result.results.filter(r => r.success).length;
        const totalCount = result.results.length;
        addToast({ 
          type: 'ok', 
          text: `Workflow executed successfully! ${successCount}/${totalCount} nodes completed in ${result.totalDuration}ms` 
        });
        
        // Log results to console for debugging
        console.log('✅ Workflow execution results:', result);
        result.results.forEach((r, idx) => {
          if (r.success) {
            console.log(`  ${idx + 1}. ${r.nodeLabel}: ✓ (${r.duration}ms)`, r.output);
          } else {
            console.error(`  ${idx + 1}. ${r.nodeLabel}: ✗ ${r.error}`);
          }
        });
      } else {
        addToast({ 
          type: 'error', 
          text: `Workflow execution failed: ${result.error || 'Unknown error'}` 
        });
        console.error('❌ Workflow execution failed:', result);
      }
    } catch (error: any) {
      addToast({ type: 'error', text: `Execution error: ${error.message}` });
      console.error('❌ Execution error:', error);
    } finally {
      setIsExecuting(false);
    }
  }, [nodes, edges, addToast]);

  // Calculate validation status
  const validation = validateGraph(nodes, edges);
  const triggers = nodes.filter((n) => n.data?.role === 'TRIGGER');
  const actions = nodes.filter((n) => n.data?.role === 'ACTION');
  const hasOrphans = validation.warnings?.some((w) => w.includes('Orphaned')) || false;
  const hasBranches = edges.some((e) => {
    const outgoing = edges.filter((e2) => e2.source === e.source);
    return outgoing.length > 1;
  });

  return (
    <div className="border-b-2 border-primary/10 bg-gradient-to-r from-primary/5 via-background to-primary/5 backdrop-blur-sm px-2 sm:px-4 py-2 sm:py-2.5 flex items-center gap-1.5 sm:gap-3 flex-wrap shadow-md">
      {/* Validation Chips */}
      <div className="flex items-center gap-1 sm:gap-1.5 mr-1 sm:mr-2 flex-wrap">
        {triggers.length === 1 ? (
          <Badge variant="default" className="text-[9px] sm:text-xs px-1.5 sm:px-2 py-0.5 font-semibold shadow-md bg-green-500/90 hover:bg-green-500">
            <span className="mr-0.5 sm:mr-1">✓</span>Trigger
          </Badge>
        ) : (
          <Badge variant="destructive" className="text-[9px] sm:text-xs px-1.5 sm:px-2 py-0.5 font-semibold shadow-md">
            <span className="mr-0.5 sm:mr-1">❗</span>Trigger
          </Badge>
        )}
        {actions.length > 0 ? (
          <Badge variant="default" className="text-[9px] sm:text-xs px-1.5 sm:px-2 py-0.5 font-semibold shadow-md bg-green-500/90 hover:bg-green-500">
            <span className="mr-0.5 sm:mr-1">✓</span>Actions
          </Badge>
        ) : (
          <Badge variant="destructive" className="text-[9px] sm:text-xs px-1.5 sm:px-2 py-0.5 font-semibold shadow-md">
            <span className="mr-0.5 sm:mr-1">❗</span>Actions
          </Badge>
        )}
        {hasOrphans && (
          <Badge variant="outline" className="text-[9px] sm:text-xs px-1.5 sm:px-2 py-0.5 font-semibold border-yellow-500/50 text-yellow-700 dark:text-yellow-400">
            <span className="mr-0.5 sm:mr-1">⚠</span>Orphans
          </Badge>
        )}
        {hasBranches && (
          <Badge variant="outline" className="text-[9px] sm:text-xs px-1.5 sm:px-2 py-0.5 font-semibold border-blue-500/50 text-blue-700 dark:text-blue-400">
            <span className="mr-0.5 sm:mr-1">ℹ</span>Branches
          </Badge>
        )}
      </div>

      <div className="flex-1 min-w-[20px]" />

      {/* Action Buttons Group */}
      <div className="flex items-center gap-1 sm:gap-1.5 flex-wrap">
        {mode === 'flow' && (
          <>
            <Button 
              size="sm" 
              variant="outline" 
              onClick={() => {
                const rf = document.querySelector('.react-flow') as any;
                if (rf?.__rf?.fitView) {
                  rf.__rf.fitView({ padding: 0.2, duration: 300 });
                }
              }}
              className="h-7 sm:h-8 text-[10px] sm:text-xs font-semibold hover:bg-primary/10 hover:border-primary/40 hover:text-primary transition-all shadow-sm"
            >
              Fit
            </Button>
            <Button 
              size="sm" 
              variant="outline" 
              onClick={() => {
                const rf = document.querySelector('.react-flow') as any;
                if (rf?.__rf?.setViewport) {
                  rf.__rf.setViewport({ x: 0, y: 0, zoom: 1 }, { duration: 300 });
                }
              }}
              className="h-7 sm:h-8 text-[10px] sm:text-xs font-semibold hover:bg-primary/10 hover:border-primary/40 hover:text-primary transition-all shadow-sm"
            >
              Center
            </Button>
            <div className="w-px h-4 bg-border/50 mx-0.5 hidden sm:block" />
          </>
        )}

        <Button 
          size="sm" 
          variant="outline" 
          onClick={handleExport}
          className="h-7 sm:h-8 text-[10px] sm:text-xs font-semibold hover:bg-primary/10 hover:border-primary/40 hover:text-primary transition-all shadow-sm"
        >
          Export
        </Button>
        <Button 
          size="sm" 
          variant="outline" 
          onClick={handleImport}
          className="h-7 sm:h-8 text-[10px] sm:text-xs font-semibold hover:bg-primary/10 hover:border-primary/40 hover:text-primary transition-all shadow-sm"
        >
          Import
        </Button>
        <Button 
          size="sm" 
          variant="outline" 
          onClick={handleValidate}
          className="h-7 sm:h-8 text-[10px] sm:text-xs font-semibold hover:bg-primary/10 hover:border-primary/40 hover:text-primary transition-all shadow-sm"
        >
          Validate
        </Button>
        <Button 
          size="sm" 
          variant="default" 
          onClick={handleRun}
          disabled={isExecuting || nodes.length === 0}
          className="h-7 sm:h-8 text-[10px] sm:text-xs font-semibold bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700 text-white shadow-md disabled:opacity-50"
        >
          {isExecuting ? '⏳ Running...' : '▶️ Run'}
        </Button>
        <div className="w-px h-4 bg-border/50 mx-0.5 hidden sm:block" />
        <Button 
          size="sm" 
          variant="outline" 
          onClick={undo} 
          disabled={!canUndo}
          className="h-7 sm:h-8 text-[10px] sm:text-xs font-semibold hover:bg-primary/10 hover:border-primary/40 hover:text-primary transition-all disabled:opacity-40 shadow-sm"
        >
          ↶ Undo
        </Button>
        <Button 
          size="sm" 
          variant="outline" 
          onClick={redo} 
          disabled={!canRedo}
          className="h-7 sm:h-8 text-[10px] sm:text-xs font-semibold hover:bg-primary/10 hover:border-primary/40 hover:text-primary transition-all disabled:opacity-40 shadow-sm"
        >
          ↷ Redo
        </Button>
        <div className="w-px h-4 bg-border/50 mx-0.5 hidden sm:block" />
        <Button 
          size="sm" 
          variant="destructive" 
          onClick={handleReset}
          className="h-7 sm:h-8 text-[10px] sm:text-xs font-semibold hover:bg-destructive/90 transition-all shadow-md"
        >
          Reset
        </Button>
      </div>

      {mode === 'flow' && (
        <div className="hidden lg:flex text-[10px] text-muted-foreground ml-2 items-center gap-1.5">
          <kbd className="px-1.5 py-0.5 bg-muted rounded border border-border text-[10px] font-mono">Del</kbd>
          <span>/</span>
          <kbd className="px-1.5 py-0.5 bg-muted rounded border border-border text-[10px] font-mono">Backspace</kbd>
          <span>delete</span>
          <span>•</span>
          <kbd className="px-1.5 py-0.5 bg-muted rounded border border-border text-[10px] font-mono">Ctrl+S</kbd>
          <span>save</span>
        </div>
      )}
    </div>
  );
}

