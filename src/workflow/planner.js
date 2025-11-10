/**
 * @fileoverview AI planner that converts chat intent to graph patches
 */

import { createNode, connect, getDefaultLabel } from './utils.js';
import { getNodeRole } from './graphTypes.js';

/**
 * Plan a graph patch from user intent
 * @param {string} intent - User's intent/message
 * @param {string} contextSummary - Current graph summary
 * @param {import('reactflow').Node[]} [nodes] - Actual nodes for ID matching (optional)
 * @returns {Promise<import('./graphTypes').GraphPatch>}
 */
export async function planFromIntent(intent, contextSummary, nodes = []) {
  const { OPENAI_API_KEY } = await import('../lib/config.js');
  
  // If no API key, use rule-based fallback
  if (!OPENAI_API_KEY || !OPENAI_API_KEY.trim()) {
    return planFromIntentFallback(intent, contextSummary, nodes);
  }

  try {
    const OpenAI = (await import('openai')).default;
    const openai = new OpenAI({
      apiKey: OPENAI_API_KEY,
      dangerouslyAllowBrowser: true
    });

    const systemPrompt = `You are a workflow planner. You receive the user's request and a short summary of the current workflow. Output a minimal JSON patch to modify the graph so it matches the request. Prefer UPDATE_NODE and REWIRE over delete+add. Keep exactly one trigger. Maintain a sensible linear flow unless branching is requested. If ambiguous, ask a brief clarifying question. Output only valid JSON for the GraphPatch shape—no prose.`;

    const functionSchema = {
      name: "update_workflow",
      description: "Apply minimal changes to the existing graph",
      parameters: {
        type: "object",
        properties: {
          ops: {
            type: "array",
            items: {
              type: "object",
              properties: {
                op: {
                  type: "string",
                  enum: ["ADD_NODE", "UPDATE_NODE", "REMOVE_NODE", "ADD_EDGE", "REMOVE_EDGE", "REWIRE", "SET_NAME", "BULK"]
                },
                node: { type: "object" },
                id: { type: "string" },
                data: { type: "object" },
                position: { type: "object" },
                edge: { type: "object" },
                from: { type: "string" },
                to: { type: "string" },
                edgeId: { type: "string" },
                name: { type: "string" },
                ops: { 
                  type: "array",
                  items: {
                    type: "object",
                    description: "Nested operation for BULK patches"
                  }
                }
              },
              required: ["op"]
            }
          }
        },
        required: ["ops"]
      }
    };

    // Enhance context with node ID mapping for better matching
    let enhancedContext = contextSummary;
    if (nodes.length > 0) {
      const nodeIdMap = nodes.map(n => `  - "${n.data?.label || n.id}": id="${n.id}"`).join('\n');
      enhancedContext = `${contextSummary}\n\nNode ID mapping:\n${nodeIdMap}`;
    }

    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "assistant", content: `Current workflow summary:\n${enhancedContext}` },
        { role: "user", content: intent }
      ],
      functions: [functionSchema],
      function_call: { name: "update_workflow" },
      temperature: 0.3
    });

    const functionCall = completion.choices[0].message.function_call;
    if (!functionCall || functionCall.name !== "update_workflow") {
      return planFromIntentFallback(intent, contextSummary);
    }

    const args = JSON.parse(functionCall.arguments);
    
    console.log('📦 AI returned patch args:', JSON.stringify(args, null, 2));
    
    // Validate args structure
    if (!args.ops || !Array.isArray(args.ops) || args.ops.length === 0) {
      console.warn('⚠️ AI returned invalid ops array, falling back to rule-based planner');
      return planFromIntentFallback(intent, contextSummary, nodes || []);
    }
    
    // Normalize all operations first
    const normalizedOps = args.ops
      .filter(op => op && op.op) // Filter out invalid operations
      .map(op => {
        // Check if AI returned node properties at top level instead of nested
        if (op.op === 'ADD_NODE' && !op.node && (op.id || op.kind || op.label || op.data)) {
          console.warn('⚠️ AI returned ADD_NODE with node properties at top level, restructuring...');
          op.node = {
            id: op.id,
            type: op.type || 'default',
            position: op.position || { x: 100, y: 100 },
            data: op.data || {
              kind: op.kind || 'action.http.request',
              label: op.label || 'Untitled Node',
              config: op.config || {}
            }
          };
        }
        return normalizePatch(op);
      })
      .filter(op => {
        // Filter out empty BULK patches and invalid patches
        if (!op || !op.op) return false;
        if (op.op === 'BULK' && (!op.ops || op.ops.length === 0)) return false;
        if (op.op === 'ADD_NODE' && !op.node) {
          console.error('❌ Filtering out ADD_NODE patch without node:', op);
          return false;
        }
        return true;
      });
    
    // If no valid operations after normalization, fall back to rule-based planner
    if (normalizedOps.length === 0) {
      console.warn('⚠️ No valid operations after normalization, falling back to rule-based planner');
      return planFromIntentFallback(intent, contextSummary, nodes || []);
    }
    
    // Convert to GraphPatch format
    if (normalizedOps.length === 1) {
      return normalizedOps[0];
    }
    
    // Post-process: match node IDs from labels if needed
    const processedOps = normalizedOps.map(op => {
      if ((op.op === 'REMOVE_NODE' || op.op === 'UPDATE_NODE') && op.id) {
        // Try to match by ID first
        let matchedNode = nodes.find(n => n.id === op.id);
        
        // If not found, try to match by label (AI might return a label instead of ID)
        if (!matchedNode && nodes.length > 0) {
          const searchId = op.id.toLowerCase();
          matchedNode = nodes.find(n => {
            const nodeLabel = (n.data?.label || '').toLowerCase();
            const nodeId = n.id.toLowerCase();
            
            // Direct match
            if (nodeId === searchId || nodeLabel === searchId) return true;
            
            // Partial match
            if (nodeLabel.includes(searchId) || searchId.includes(nodeLabel)) return true;
            
            // Word match
            const searchWords = searchId.split(/\s+/);
            const labelWords = nodeLabel.split(/\s+/);
            if (searchWords.some(w => labelWords.includes(w))) return true;
            
            return false;
          });
        }
        
        if (matchedNode) {
          console.log(`🎯 Matched AI's "${op.id}" to node:`, matchedNode.id, matchedNode.data?.label);
          return { ...op, id: matchedNode.id };
        } else {
          console.warn(`⚠️ Could not match AI's "${op.id}" to any node. Available:`, nodes.map(n => ({ id: n.id, label: n.data?.label })));
        }
      }
      return op;
    });
    
    if (processedOps.length === 1) {
      return processedOps[0];
    }
    
    return { op: "BULK", ops: processedOps };
  } catch (error) {
    console.error("Error planning from intent:", error);
    return planFromIntentFallback(intent, contextSummary, nodes || []);
  }
}

/**
 * Normalize a patch from AI output to our GraphPatch format
 * @param {any} patch
 * @returns {import('./graphTypes').GraphPatch}
 */
function normalizePatch(patch) {
  if (!patch || !patch.op) {
    console.error('⚠️ Invalid patch (missing op):', patch);
    return patch;
  }
  
  // Normalize ADD_EDGE operations - handle both formats
  if (patch.op === 'ADD_EDGE') {
    // If AI returned from/to at top level, convert to edge format
    if (patch.from && patch.to && !patch.edge) {
      // Keep from/to format - applyPatch will handle it
      // Just ensure we have the required properties
      if (!patch.from || !patch.to) {
        console.error('⚠️ ADD_EDGE patch missing from/to:', patch);
        return { op: 'BULK', ops: [] };
      }
    } else if (patch.edge) {
      // Standard format - ensure edge has required properties
      if (!patch.edge.source || !patch.edge.target) {
        console.error('⚠️ ADD_EDGE patch.edge missing source/target:', patch);
        return { op: 'BULK', ops: [] };
      }
    } else {
      console.error('⚠️ ADD_EDGE patch missing edge or from/to:', patch);
      return { op: 'BULK', ops: [] };
    }
  }
  
  // Ensure node has proper structure
  if (patch.op === 'ADD_NODE') {
    if (!patch.node) {
      console.error('⚠️ ADD_NODE patch missing node property:', patch);
      // Try to create a default node if we have some info
      if (patch.id || patch.kind || patch.label) {
        console.warn('⚠️ Attempting to reconstruct node from patch properties');
        patch.node = createNode(patch.kind || 'action.http.request', {
          id: patch.id,
          data: {
            label: patch.label || patch.id || 'Untitled Node',
            ...(patch.data || {})
          },
          position: patch.position || { x: 100, y: 100 }
        });
      } else {
        console.error('❌ Cannot normalize ADD_NODE patch - no node and no fallback info');
        // Return a valid but empty patch that will be caught by validation
        return { op: 'BULK', ops: [] };
      }
    }
    
    // Ensure node has all required properties
    if (!patch.node.id) {
      console.warn('⚠️ Node missing id, generating one');
      patch.node.id = `node_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }
    
    if (!patch.node.data) {
      patch.node.data = {};
    }
    
    if (!patch.node.data.kind) {
      console.warn('⚠️ Node missing kind:', patch.node);
      // Try to infer from label or set default
      patch.node.data.kind = 'action.http.request';
    }
    
    if (patch.node.data.kind && !patch.node.data.role) {
      patch.node.data.role = getNodeRole(patch.node.data.kind);
    }
    
    if (!patch.node.position) {
      patch.node.position = { x: 100, y: 100 };
    }
    
    if (!patch.node.type) {
      patch.node.type = 'default';
    }
    
    if (!patch.node.data.label || patch.node.data.label.trim() === '') {
      patch.node.data.label = getDefaultLabel(patch.node.data.kind) || patch.node.data.kind || 'Untitled Node';
      console.log('📝 Setting default label in normalizePatch:', patch.node.data.kind, '→', patch.node.data.label);
    }
    
    if (!patch.node.data.config) {
      patch.node.data.config = {};
    }
  }
  
  return patch;
}

/**
 * Fallback rule-based planner when OpenAI is not available
 * @param {string} intent
 * @param {string} contextSummary
 * @param {import('reactflow').Node[]} [nodes] - Actual nodes for ID matching
 * @returns {import('./graphTypes').GraphPatch}
 */
function planFromIntentFallback(intent, contextSummary, nodes = []) {
  const lower = intent.toLowerCase();
  const patches = [];
  
  // Use actual nodes if available, otherwise parse from summary
  const existingNodes = nodes.length > 0 
    ? nodes.map(n => ({ id: n.id, label: n.data?.label || n.id, kind: n.data?.kind }))
    : [];
  
  // If no nodes provided, try to extract from summary
  if (existingNodes.length === 0) {
    const hasExistingWorkflow = !contextSummary.includes('Empty workflow');
    if (hasExistingWorkflow) {
      // Extract steps from summary
      const stepMatch = contextSummary.match(/Steps \(in order\):\n((?:\d+\. .+\n?)+)/);
      if (stepMatch) {
        const steps = stepMatch[1].split('\n').filter(Boolean).map(line => {
          const match = line.match(/\d+\. (.+?)(?:\s+{.*})?$/);
          return match ? match[1].trim() : null;
        }).filter(Boolean);
        // Create placeholder node IDs (will fail if no actual nodes, but better than nothing)
        existingNodes.push(...steps.map((label, idx) => ({ id: `step_${idx}`, label })));
      }
    }
  }
  
  // If no existing workflow, create a new one from scratch
  const isEmptyWorkflow = existingNodes.length === 0 && contextSummary.includes('Empty workflow');
  if (isEmptyWorkflow) {
    console.log('🆕 Creating new workflow from intent:', intent);
    
    // Create trigger node based on intent
    let triggerNode = null;
    let cursorX = 100;
    const y = 100;
    
    if (lower.includes('facebook') && (lower.includes('comment') || lower.includes('reply'))) {
      triggerNode = createNode('trigger.facebook.comment', {
        position: { x: cursorX, y },
        data: { label: 'Facebook Comment' }
      });
      patches.push({ op: 'ADD_NODE', node: triggerNode });
      cursorX += 250;
    } else if (lower.includes('schedule') || lower.includes('daily') || lower.includes('weekly')) {
      triggerNode = createNode('trigger.scheduler.cron', {
        position: { x: cursorX, y },
        data: { 
          label: lower.includes('daily') ? 'Daily Schedule' : 'Scheduled Trigger',
          config: { schedule: lower.includes('daily') ? '0 0 * * *' : '0 * * * *' }
        }
      });
      patches.push({ op: 'ADD_NODE', node: triggerNode });
      cursorX += 250;
    }
    
    // Create action nodes based on intent
    const actionNodes = [];
    
    if (lower.includes('facebook') && (lower.includes('reply') || lower.includes('comment'))) {
      const node = createNode('action.facebook.reply', {
        position: { x: cursorX, y },
        data: { label: 'Reply to Facebook Comment' }
      });
      actionNodes.push(node);
      cursorX += 250;
    }
    
    if (lower.includes('facebook') && (lower.includes('dm') || lower.includes('direct message'))) {
      const node = createNode('action.facebook.dm', {
        position: { x: cursorX, y },
        data: { label: 'Send Facebook DM' }
      });
      actionNodes.push(node);
      cursorX += 250;
    }
    
    if (lower.includes('sheet') || lower.includes('google')) {
      const node = createNode('action.sheets.appendRow', {
        position: { x: cursorX, y },
        data: { label: 'Add to Google Sheets' }
      });
      actionNodes.push(node);
      cursorX += 250;
    }
    
    if (lower.includes('email')) {
      const node = createNode('action.email.send', {
        position: { x: cursorX, y },
        data: { label: 'Send Email' }
      });
      actionNodes.push(node);
      cursorX += 250;
    }
    
    // Add all action nodes
    actionNodes.forEach(node => {
      patches.push({ op: 'ADD_NODE', node });
    });
    
    // Connect nodes in sequence
    const allNodes = triggerNode ? [triggerNode, ...actionNodes] : actionNodes;
    for (let i = 0; i < allNodes.length - 1; i++) {
      patches.push({ 
        op: 'ADD_EDGE', 
        edge: connect(allNodes[i].id, allNodes[i + 1].id) 
      });
    }
    
    // If we created nodes, return the patches
    if (patches.length > 0) {
      console.log(`✅ Created new workflow with ${patches.length} operations`);
      if (patches.length === 1) {
        return patches[0];
      }
      return { op: 'BULK', ops: patches };
    }
  }
  
  // Handle simple confirmations or responses that don't require workflow changes
  if (lower.match(/^(yes|yeah|yep|ok|okay|sure|alright|correct|right|that's right|exactly)$/i)) {
    console.log('✅ User confirmed - no workflow changes needed');
    return { op: 'BULK', ops: [] };
  }
  
  // Handle scheduling/time-related requests when no workflow exists
  if (existingNodes.length === 0 && (lower.includes('daily') || lower.includes('schedule') || lower.includes('every'))) {
    console.log('📅 Creating scheduled workflow from intent:', intent);
    const scheduleNode = createNode('trigger.scheduler.cron', {
      position: { x: 100, y: 100 },
      data: { 
        label: lower.includes('daily') ? 'Daily Schedule' : 'Scheduled Trigger',
        config: { schedule: lower.includes('daily') ? '0 0 * * *' : '0 * * * *' }
      }
    });
    patches.push({ op: 'ADD_NODE', node: scheduleNode });
  }

  // Simple pattern matching for common operations
  if (lower.includes('add') && (lower.includes('google sheets') || lower.includes('sheet'))) {
    // Add a sheets node after the last action
    const node = createNode('action.sheets.appendRow', {
      position: { x: 400, y: 100 },
      data: { label: 'Add to Google Sheets' }
    });
    patches.push({ op: 'ADD_NODE', node });
    
    // If we have existing nodes, add an edge connecting to the new node
    if (existingNodes.length > 0) {
      const lastNodeId = existingNodes[existingNodes.length - 1].id;
      patches.push({ op: 'ADD_EDGE', edge: connect(lastNodeId, node.id) });
    }
  }

  if (lower.includes('remove') || lower.includes('delete')) {
    // Extract node name from intent - more flexible matching
    const nodeMatch = intent.match(/(?:remove|delete)\s+(?:the\s+)?([a-z\s]+?)(?:\s+node|\s+step|$)/i);
    let nodeName = nodeMatch ? nodeMatch[1].trim() : '';
    
    // If no match, try to extract from phrases like "remove reply" or "delete sheets"
    if (!nodeName) {
      const words = intent.toLowerCase().split(/\s+/);
      const removeIndex = words.findIndex(w => w === 'remove' || w === 'delete');
      if (removeIndex >= 0 && removeIndex < words.length - 1) {
        nodeName = words.slice(removeIndex + 1).join(' ').replace(/node|step|the/gi, '').trim();
      }
    }
    
    if (nodeName) {
      console.log(`🔍 Looking for node matching: "${nodeName}"`);
      console.log(`📋 Available nodes:`, existingNodes.map(n => ({ id: n.id, label: n.label })));
      
      // Try to match against existing nodes with multiple strategies
      const matchingNode = existingNodes.find(n => {
        const label = (n.label || '').toLowerCase();
        const name = nodeName.toLowerCase();
        const nodeId = (n.id || '').toLowerCase();
        
        // Strategy 1: Exact label match
        if (label === name) return true;
        
        // Strategy 2: Label contains name or vice versa
        if (label.includes(name) || name.includes(label)) return true;
        
        // Strategy 3: First word match
        const firstWord = name.split(' ')[0];
        if (firstWord && label.includes(firstWord)) return true;
        
        // Strategy 4: ID contains name (for step_0, step_1, etc.)
        if (nodeId.includes(name) || name.includes(nodeId)) return true;
        
        // Strategy 5: Match by kind keywords (facebook, sheets, email, etc.)
        const keywords = ['facebook', 'sheets', 'email', 'telegram', 'reply', 'dm', 'http'];
        const matchingKeyword = keywords.find(k => name.includes(k) && label.includes(k));
        if (matchingKeyword) return true;
        
        return false;
      });
      
      if (matchingNode) {
        console.log(`✅ Matched "${nodeName}" to node:`, matchingNode.id, matchingNode.label);
        patches.push({ op: 'REMOVE_NODE', id: matchingNode.id });
      } else {
        console.warn(`⚠️ Could not match "${nodeName}" to any node.`);
        console.warn(`Available nodes:`, existingNodes.map(n => ({ id: n.id, label: n.label })));
      }
    } else {
      console.warn('⚠️ Could not extract node name from intent:', intent);
    }
  }

  if (lower.includes('change') || lower.includes('update')) {
    // Extract what to change
    const changeMatch = intent.match(/(?:change|update)\s+(?:the\s+)?([a-z\s]+?)\s+(?:to|with)\s+["']?([^"']+)["']?/i);
    if (changeMatch) {
      const nodeName = changeMatch[1].trim();
      const newValue = changeMatch[2].trim();
      
      // Try to match against existing nodes
      const matchingNode = existingNodes.find(n => 
        n.label.toLowerCase().includes(nodeName.toLowerCase())
      );
      
      if (matchingNode) {
        patches.push({
          op: 'UPDATE_NODE',
          id: matchingNode.id,
          data: { config: { value: newValue } }
        });
      } else if (nodeName.toLowerCase().includes('facebook') && nodeName.toLowerCase().includes('comment')) {
        // Update trigger config
        const triggerNode = existingNodes.find(n => n.label.toLowerCase().includes('facebook'));
        if (triggerNode) {
          patches.push({
            op: 'UPDATE_NODE',
            id: triggerNode.id,
            data: { config: { match: newValue } }
          });
        }
      }
    }
  }

  if (patches.length === 0) {
    console.warn('⚠️ No patches generated from intent:', intent);
    console.warn('📋 Context summary:', contextSummary);
    console.warn('📋 Existing nodes:', existingNodes);
    
    // If this looks like a confirmation or simple response, return empty patch
    if (lower.match(/^(yes|yeah|yep|ok|okay|sure|alright|correct|right|that's right|exactly|daily|schedule)$/i)) {
      console.log('✅ Intent appears to be a confirmation - no action needed');
      return { op: 'BULK', ops: [] };
    }
    
    // Return empty bulk patch
    return { op: 'BULK', ops: [] };
  }

  if (patches.length === 1) {
    console.log('✅ Generated single patch:', patches[0].op, patches[0].id || 'N/A');
    return patches[0];
  }

  console.log(`✅ Generated ${patches.length} patches in BULK operation`);
  return { op: 'BULK', ops: patches };
}

