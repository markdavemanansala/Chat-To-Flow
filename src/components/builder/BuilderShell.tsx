/**
 * @fileoverview Main builder shell - layout and mode toggle
 */

// @ts-nocheck
import { useEffect } from 'react';
import { Panel, PanelGroup, PanelResizeHandle } from 'react-resizable-panels';
import { useViewMode, useSetMode, useLeftTab, useSetLeftTab, useSelectedNodeId, useUIStore } from '@/store/uiStore';
import { useNodes, useEdges } from '@/store/graphStore';
import { useUpdateSummaryFromGraph, useCurrentSummary } from '@/store/aiStore';
import { useGraphStore } from '@/store/graphStore';
import ChatPanel from './LeftPanel/ChatPanel';
import NodeCatalog from './LeftPanel/NodeCatalog';
import SimpleCanvas from './RightPanel/SimpleCanvas';
import FlowCanvas from './RightPanel/FlowCanvas';
import NodeInspector from '@/components/workflow/NodeInspector';
import Toolbar from './RightPanel/Toolbar';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';

interface BuilderShellProps {
  initialTab?: 'chat' | 'catalog';
}

export default function BuilderShell({ initialTab = 'chat' }: BuilderShellProps) {
  const mode = useViewMode();
  const setMode = useSetMode();
  const leftTab = useLeftTab();
  const setLeftTab = useSetLeftTab();
  const nodes = useNodes();
  const edges = useEdges();
  const selectedNodeId = useSelectedNodeId();
  const updateSummaryFromGraph = useUpdateSummaryFromGraph();
  const currentSummary = useCurrentSummary();
  
  // Find selected node
  const selectedNode = selectedNodeId ? nodes.find(n => n.id === selectedNodeId) || null : null;

  // Initialize left tab
  useEffect(() => {
    if (initialTab === 'catalog') {
      setLeftTab('catalog');
    }
  }, [initialTab, setLeftTab]);
  
  // For mobile, ensure we have a valid tab
  const currentTab = leftTab || 'chat';

  // Update AI summary when graph changes
  useEffect(() => {
    const onGraphChange = useGraphStore.getState().onGraphChange;
    const unsubscribe = onGraphChange(({ nodes, edges }) => {
      updateSummaryFromGraph(nodes, edges);
    });

    // Initial update
    updateSummaryFromGraph(nodes, edges);

    return unsubscribe;
  }, [updateSummaryFromGraph, nodes, edges]);

  return (
    <div className="flex flex-col h-screen w-full bg-gradient-to-br from-background via-background to-muted/20">
      {/* Header with mode toggle */}
      <div className="border-b-2 border-primary/10 bg-gradient-to-r from-primary/5 via-background to-primary/5 backdrop-blur-md px-3 sm:px-6 py-3 sm:py-4 shadow-lg shadow-primary/5">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 sm:gap-0">
          <div className="flex items-center gap-2 sm:gap-4 w-full sm:w-auto">
            <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl bg-gradient-to-br from-primary to-primary/70 flex items-center justify-center shadow-lg shadow-primary/30">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="text-primary-foreground">
                <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/>
              </svg>
            </div>
            <div className="flex-1 sm:flex-initial">
              <h1 className="text-lg sm:text-2xl font-extrabold bg-gradient-to-r from-primary via-primary/80 to-primary bg-clip-text text-transparent">
                Workflow Builder
              </h1>
              <div className="flex sm:hidden items-center gap-2 mt-0.5">
                <div className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse"></div>
                <span className="text-[10px] text-muted-foreground">
                  {nodes.length} nodes • {edges.length} edges
                </span>
              </div>
            </div>
          </div>
          
          <div className="flex items-center gap-2 w-full sm:w-auto">
            <div className="flex items-center gap-1.5 sm:gap-2 flex-1 sm:flex-initial">
              <button
                onClick={() => setMode('simple')}
                className={`flex-1 sm:flex-initial px-4 sm:px-5 py-2 sm:py-2.5 text-sm sm:text-base font-semibold rounded-xl transition-all duration-300 transform hover:scale-105 ${
                  mode === 'simple'
                    ? 'bg-gradient-to-r from-primary to-primary/80 text-primary-foreground shadow-xl shadow-primary/40 ring-2 ring-primary/20'
                    : 'bg-muted/80 hover:bg-muted text-muted-foreground hover:text-foreground border-2 border-transparent hover:border-primary/20'
                }`}
              >
                <span className="hidden sm:inline">📋 </span>Simple
              </button>
              <button
                onClick={() => setMode('flow')}
                className={`flex-1 sm:flex-initial px-4 sm:px-5 py-2 sm:py-2.5 text-sm sm:text-base font-semibold rounded-xl transition-all duration-300 transform hover:scale-105 ${
                  mode === 'flow'
                    ? 'bg-gradient-to-r from-primary to-primary/80 text-primary-foreground shadow-xl shadow-primary/40 ring-2 ring-primary/20'
                    : 'bg-muted/80 hover:bg-muted text-muted-foreground hover:text-foreground border-2 border-transparent hover:border-primary/20'
                }`}
              >
                <span className="hidden sm:inline">🗺️ </span>Flow
              </button>
            </div>
            <div className="hidden sm:flex items-center gap-2 px-4 py-2 bg-white/50 dark:bg-black/20 rounded-xl text-xs font-semibold backdrop-blur-sm border border-primary/10">
              <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse shadow-lg shadow-green-500/50"></div>
              <span className="text-foreground/80">
                {nodes.length} node{nodes.length !== 1 ? 's' : ''} • {edges.length} edge{edges.length !== 1 ? 's' : ''}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Main content area - Responsive layout */}
      <div className="hidden lg:flex flex-1 min-h-0">
        <PanelGroup direction="horizontal" className="flex-1">
          {/* Left Panel - Chat or Catalog */}
          <Panel defaultSize={35} minSize={25} maxSize={45}>
            <div className="h-full flex flex-col border-r-2 border-primary/10 bg-gradient-to-br from-background to-muted/10">
              <Tabs value={leftTab} onValueChange={(v) => setLeftTab(v as 'chat' | 'catalog')} className="flex-1 flex flex-col">
                <TabsList className="w-full rounded-none border-b-2 border-primary/10 shrink-0 bg-gradient-to-r from-muted/40 to-muted/20">
                  <TabsTrigger value="chat" className="flex-1 data-[state=active]:bg-background data-[state=active]:shadow-lg data-[state=active]:border-b-2 data-[state=active]:border-primary transition-all font-semibold">
                    <span className="mr-2 text-lg">💬</span> Chat
                  </TabsTrigger>
                  <TabsTrigger value="catalog" className="flex-1 data-[state=active]:bg-background data-[state=active]:shadow-lg data-[state=active]:border-b-2 data-[state=active]:border-primary transition-all font-semibold">
                    <span className="mr-2 text-lg">📦</span> Catalog
                  </TabsTrigger>
                </TabsList>
                <div className="flex-1 overflow-hidden min-h-0">
                  {leftTab === 'chat' && <ChatPanel />}
                  {leftTab === 'catalog' && <NodeCatalog />}
                </div>
              </Tabs>
            </div>
          </Panel>

          <PanelResizeHandle className="w-2 bg-gradient-to-b from-primary/10 to-primary/5 hover:from-primary/20 hover:to-primary/10 transition-colors" />

          {/* Right Panel - Canvas */}
          <Panel defaultSize={50} minSize={35}>
            <div className="h-full flex flex-col bg-gradient-to-br from-background to-muted/5">
              <Toolbar />
              <div className="flex-1 overflow-hidden min-h-0">
                {mode === 'simple' ? <SimpleCanvas /> : <FlowCanvas />}
              </div>
            </div>
          </Panel>

          <PanelResizeHandle className="w-2 bg-gradient-to-b from-primary/10 to-primary/5 hover:from-primary/20 hover:to-primary/10 transition-colors" />

          {/* Right Panel - Inspector */}
          <Panel defaultSize={15} minSize={15} maxSize={30}>
            <div className="h-full border-l-2 border-primary/10 bg-gradient-to-br from-background to-muted/10">
              <NodeInspector selectedNode={selectedNode} />
            </div>
          </Panel>
        </PanelGroup>
      </div>

      {/* Mobile Layout - Stack vertically with tabs */}
      <div className="lg:hidden flex flex-col flex-1 min-h-0 overflow-hidden">
        <Tabs value={currentTab} onValueChange={(v) => setLeftTab(v as 'chat' | 'catalog' | 'canvas')} className="flex-1 flex flex-col min-h-0">
          <TabsList className="w-full rounded-none border-b-2 border-primary/10 shrink-0 bg-gradient-to-r from-muted/40 to-muted/20 px-1">
            <TabsTrigger value="chat" className="flex-1 data-[state=active]:bg-background data-[state=active]:shadow-lg data-[state=active]:border-b-2 data-[state=active]:border-primary transition-all font-semibold text-xs py-2">
              <span className="mr-1">💬</span> Chat
            </TabsTrigger>
            <TabsTrigger value="catalog" className="flex-1 data-[state=active]:bg-background data-[state=active]:shadow-lg data-[state=active]:border-b-2 data-[state=active]:border-primary transition-all font-semibold text-xs py-2">
              <span className="mr-1">📦</span> Catalog
            </TabsTrigger>
            <TabsTrigger value="canvas" className="flex-1 data-[state=active]:bg-background data-[state=active]:shadow-lg data-[state=active]:border-b-2 data-[state=active]:border-primary transition-all font-semibold text-xs py-2">
              <span className="mr-1">🎨</span> Canvas
            </TabsTrigger>
          </TabsList>
          <div className="flex-1 overflow-hidden min-h-0">
            {currentTab === 'chat' && <ChatPanel />}
            {currentTab === 'catalog' && <NodeCatalog />}
            {currentTab === 'canvas' && (
              <div className="h-full flex flex-col">
                <Toolbar />
                <div className="flex-1 overflow-hidden min-h-0">
                  {mode === 'simple' ? <SimpleCanvas /> : <FlowCanvas />}
                </div>
              </div>
            )}
          </div>
        </Tabs>
      </div>
    </div>
  );
}

