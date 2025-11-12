/**
 * @fileoverview Chat panel for workflow builder - sends intents, renders messages
 */

// @ts-nocheck
import { useState, useEffect, useRef } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { useNodes, useEdges } from '@/store/graphStore';
import { useCurrentSummary, useIsThinking, useSetAIState, useLastAIMessage } from '@/store/aiStore';
import { useApplyPatch } from '@/store/graphStore';
import { useAddToast } from '@/store/uiStore';
import { planFromIntent } from '@/workflow/planner';
import { getConversationalResponse } from '@/lib/api';
import { isOpenAIAvailable } from '@/lib/config';
import { useConnectModal } from '@/store/connectionStore';
import { getNodesRequiringCredentials } from '@/utils/connectionCheck';
import { getCurrentLocale, getT } from '@/i18n';
import { ConnectModal } from '@/components/connect/ConnectModal';
import type { Node } from 'reactflow';
import type { RfNodeData } from '@/types/graph';

interface Message {
  id: number;
  role: 'user' | 'assistant';
  text: string;
}

export default function ChatPanel() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [openAIConnected, setOpenAIConnected] = useState(false);
  const pendingResponseRef = useRef(false);
  
  const nodes = useNodes();
  const edges = useEdges();
  const currentSummary = useCurrentSummary();
  const isThinking = useIsThinking();
  const setAIState = useSetAIState();
  const applyPatch = useApplyPatch();
  const addToast = useAddToast();
  const { openModal: openConnectModal } = useConnectModal();
  const locale = getCurrentLocale();
  const t = getT(locale);

  // Check OpenAI connection
  useEffect(() => {
    setOpenAIConnected(isOpenAIAvailable());
  }, []);

  const handleSend = async (e?: React.FormEvent | React.KeyboardEvent) => {
    if (e) e.preventDefault();
    if (!input.trim() || pendingResponseRef.current) return;

    const userMessage = input.trim();
    setMessages((prev) => [...prev, { id: Date.now(), role: 'user', text: userMessage }]);
    setInput('');
    pendingResponseRef.current = true;
    setAIState({ isThinking: true });

    try {
      // Get conversational response first
      const aiResponse = await getConversationalResponse(userMessage, messages, {
        workflow: undefined, // We use currentSummary instead
        nodes: nodes,
        edges: edges,
        collectingInfo: false,
      });

      const responseText = typeof aiResponse === 'string' ? aiResponse : aiResponse.text;
      const shouldGenerate = typeof aiResponse === 'object' ? aiResponse.shouldGenerateWorkflow : false;

      setMessages((prev) => [...prev, { id: Date.now() + 1, role: 'assistant', text: responseText }]);
      setAIState({ lastAIMessage: responseText, isThinking: false });

      // Always try to generate a patch if the message might modify the workflow
      // Check if the message contains workflow modification keywords
      const lowerMessage = userMessage.toLowerCase();
      const isWorkflowModification = shouldGenerate || 
        lowerMessage.includes('add') || 
        lowerMessage.includes('remove') || 
        lowerMessage.includes('delete') || 
        lowerMessage.includes('change') || 
        lowerMessage.includes('update') ||
        lowerMessage.includes('modify');

      if (isWorkflowModification) {
        try {
          console.log('🔧 Generating patch for:', userMessage);
          console.log('📋 Current nodes:', nodes.map(n => ({ id: n.id, label: n.data?.label, kind: n.data?.kind })));
          const patch = await planFromIntent(userMessage, currentSummary, nodes, userMessage);
          console.log('🔧 Generated patch:', JSON.stringify(patch, null, 2));

          if (!patch) {
            console.warn('⚠️ No patch generated');
            addToast({ type: 'warn', text: 'Could not understand the request. Please try rephrasing.' });
            return;
          }

          // Check if patch is empty (BULK with no ops)
          if (patch.op === 'BULK' && (!patch.ops || patch.ops.length === 0)) {
            console.log('ℹ️ Patch is empty - no workflow changes needed');
            return;
          }

          // Validate REMOVE_NODE patches before applying
          if (patch.op === 'REMOVE_NODE') {
            const nodeExists = nodes.some(n => n.id === patch.id);
            if (!nodeExists) {
              console.error('❌ REMOVE_NODE patch references non-existent node:', patch.id);
              addToast({ type: 'error', text: `Could not find the node to remove. Available nodes: ${nodes.map(n => n.data?.label || n.id).join(', ')}` });
              return;
            }
          } else if (patch.op === 'BULK' && patch.ops) {
            // Validate all REMOVE_NODE ops in BULK
            const invalidRemoves = patch.ops.filter(op => 
              op.op === 'REMOVE_NODE' && !nodes.some(n => n.id === op.id)
            );
            if (invalidRemoves.length > 0) {
              console.error('❌ BULK patch contains invalid REMOVE_NODE operations:', invalidRemoves);
              addToast({ type: 'error', text: `Could not find ${invalidRemoves.length} node(s) to remove.` });
              return;
            }
          }

          const result = applyPatch(patch);
          console.log('🔧 Patch result:', result);

          if (result.ok) {
            // Check for nodes requiring credentials
            const nodesRequiringCreds = getNodesRequiringCredentials(patch);
            if (nodesRequiringCreds.length > 0) {
              // Show connection prompt for the first provider
              const firstProvider = nodesRequiringCreds[0];
              const providerName = firstProvider.providerName;
              const nodeKind = firstProvider.nodeKind;
              
              // Add inline message to chat
              setMessages((prev) => [
                ...prev,
                {
                  id: Date.now() + 2,
                  role: 'assistant',
                  text: t('node.requiresCredentials', 'This node requires {provider} credentials')
                    .replace('{provider}', providerName),
                },
              ]);
              
              // Show toast with action
              addToast({
                type: 'warn',
                text: t('node.connectPrompt', 'Connect {provider} to continue').replace('{provider}', providerName),
              });
              
              // Open connect modal
              setTimeout(() => {
                openConnectModal(firstProvider.providerId, nodeKind);
              }, 500);
            }

            // Highlight changed nodes (handled by store events)
            const nodeCountChange = result.nodes.length - nodes.length;
            if (nodeCountChange > 0) {
              addToast({ type: 'ok', text: `Added ${nodeCountChange} node(s) to your workflow.` });
            } else if (nodeCountChange < 0) {
              addToast({ type: 'ok', text: `Removed ${Math.abs(nodeCountChange)} node(s) from your workflow.` });
            } else {
              addToast({ type: 'ok', text: 'Updated your workflow.' });
            }
          } else {
            console.error('❌ Patch failed:', result.issues);
            addToast({ type: 'error', text: `Failed to update workflow: ${result.issues?.join(', ')}` });
          }
        } catch (error: any) {
          console.error('❌ Error in workflow generation:', error);
          addToast({ type: 'error', text: `Error generating workflow: ${error.message}` });
        }
      }
    } catch (error: any) {
      console.error('Error in chat:', error);
      addToast({ type: 'error', text: 'Error processing your message. Please try again.' });
    } finally {
      pendingResponseRef.current = false;
      setAIState({ isThinking: false });
    }
  };

  // Auto-resize textarea based on content
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      const scrollHeight = textareaRef.current.scrollHeight;
      // Responsive max height: 150px on mobile, 200px on larger screens
      const maxHeight = window.innerWidth < 640 ? 150 : 200;
      textareaRef.current.style.height = `${Math.min(scrollHeight, maxHeight)}px`;
    }
  }, [input]);

  return (
    <>
      <ConnectModal />
      <div className="h-full w-full flex flex-col bg-background overflow-hidden">
      <CardHeader className="border-b pb-2 sm:pb-3 shrink-0 px-3 sm:px-6">
        <div className="flex items-center justify-between gap-2">
          <div className="flex-1 min-w-0">
            <CardTitle className="flex items-center gap-1.5 sm:gap-2 text-sm sm:text-base">
              <span className="truncate">Chat Builder</span>
              <Badge
                variant={openAIConnected ? 'default' : 'outline'}
                className={`${openAIConnected ? 'bg-green-500 hover:bg-green-600' : ''} text-[10px] sm:text-xs shrink-0`}
                title={openAIConnected ? 'OpenAI connected' : 'OpenAI not connected'}
              >
                {openAIConnected ? (
                  <>
                    <span className="w-1 h-1 sm:w-1.5 sm:h-1.5 rounded-full bg-white mr-0.5 sm:mr-1 inline-block animate-pulse"></span>
                    AI
                  </>
                ) : (
                  <>
                    <span className="w-1 h-1 sm:w-1.5 sm:h-1.5 rounded-full bg-yellow-500 mr-0.5 sm:mr-1 inline-block"></span>
                    Basic
                  </>
                )}
              </Badge>
            </CardTitle>
            <CardDescription className="text-[10px] sm:text-xs mt-0.5 sm:mt-1 truncate">
              Describe your workflow • {nodes.length} node{nodes.length !== 1 ? 's' : ''} in graph
            </CardDescription>
          </div>
        </div>
      </CardHeader>

      <CardContent className="flex-1 overflow-y-auto overflow-x-hidden p-2 sm:p-4 space-y-3 sm:space-y-4 min-h-0 scrollbar-hide">
        {messages.length === 0 && (
          <div className="text-xs sm:text-sm text-muted-foreground text-center py-8 sm:py-12 px-2 sm:px-4">
            <p className="mb-2 sm:mb-3 font-medium">Start by describing your workflow...</p>
            <p className="text-[10px] sm:text-xs leading-relaxed">
              Example: "Reply to Facebook comments containing 'price' and log to Google Sheets"
            </p>
          </div>
        )}
        {messages.map((m) => (
          <div 
            key={m.id} 
            className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'} animate-in fade-in slide-in-from-bottom-2 duration-200`}
          >
            <div
              className={`max-w-[90%] sm:max-w-[85%] rounded-xl p-3 sm:p-4 shadow-md overflow-hidden transition-all duration-200 ${
                m.role === 'user' 
                  ? 'bg-gradient-to-br from-primary to-primary/90 text-primary-foreground shadow-primary/20' 
                  : 'bg-card border border-border shadow-sm hover:shadow-md'
              }`}
            >
              <p className="text-xs sm:text-sm leading-relaxed whitespace-pre-wrap break-words overflow-wrap-anywhere">{m.text}</p>
            </div>
          </div>
        ))}
        {isThinking && (
          <div className="flex justify-start animate-in fade-in slide-in-from-bottom-2 duration-200">
            <div className="bg-card border border-border rounded-xl p-3 sm:p-4 shadow-sm">
              <div className="flex items-center gap-2.5">
                <div className="flex gap-1">
                  <span className="w-2 h-2 rounded-full bg-primary animate-bounce" style={{ animationDelay: '0ms' }}></span>
                  <span className="w-2 h-2 rounded-full bg-primary animate-bounce" style={{ animationDelay: '150ms' }}></span>
                  <span className="w-2 h-2 rounded-full bg-primary animate-bounce" style={{ animationDelay: '300ms' }}></span>
                </div>
                <p className="text-xs sm:text-sm text-muted-foreground font-medium">AI is thinking...</p>
              </div>
            </div>
          </div>
        )}
      </CardContent>

      <div className="border-t bg-background p-2 sm:p-3 space-y-1.5 sm:space-y-2 shrink-0">
        <form onSubmit={handleSend} className="flex gap-1.5 sm:gap-2 items-end">
          <div className="flex-1 relative min-w-0">
            <textarea
              ref={textareaRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleSend(e);
                }
              }}
              placeholder="Describe your automation..."
              className="w-full min-h-[36px] sm:min-h-[40px] max-h-[150px] sm:max-h-[200px] px-2 sm:px-3 py-1.5 sm:py-2 text-xs sm:text-sm rounded-md border border-input bg-background resize-none focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-1 sm:focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
              disabled={pendingResponseRef.current}
              rows={1}
            />
          </div>
          <Button 
            type="submit" 
            disabled={pendingResponseRef.current || !input.trim()}
            className="shrink-0 h-[36px] sm:h-auto text-xs sm:text-sm px-2 sm:px-4"
          >
            {pendingResponseRef.current ? (
              <>
                <span className="w-3 h-3 sm:w-4 sm:h-4 border-2 border-current border-t-transparent rounded-full animate-spin mr-1 sm:mr-2"></span>
                <span className="hidden sm:inline">Sending...</span>
              </>
            ) : (
              'Send'
            )}
          </Button>
        </form>
        <div className="flex items-center justify-between text-[10px] sm:text-xs text-muted-foreground gap-2">
          <span className="truncate">
            {currentSummary.includes('Empty') ? 'Empty workflow' : 'Synced with canvas ✓'}
          </span>
          <span className="text-[9px] sm:text-[10px] opacity-70 shrink-0 hidden sm:inline">Enter to send, Shift+Enter for new line</span>
        </div>
      </div>
    </div>
    </>
  );
}

