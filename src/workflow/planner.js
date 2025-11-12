/**
 * @fileoverview AI planner that converts chat intent to graph patches
 */

import { createNode, connect, getDefaultLabel } from './utils.js';
import { getNodeRole } from './graphTypes.js';
import { generateNodeLabel } from './labeler.js';

/**
 * Plan a graph patch from user intent
 * @param {string} intent - User's intent/message
 * @param {string} contextSummary - Current graph summary
 * @param {import('reactflow').Node[]} [nodes] - Actual nodes for ID matching (optional)
 * @returns {Promise<import('./graphTypes').GraphPatch>}
 */
export async function planFromIntent(intent, contextSummary, nodes = [], originalIntent = '') {
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

    const systemPrompt = `You are a workflow planner. You receive the user's request and a short summary of the current workflow. Output a minimal JSON patch to modify the graph so it matches the request.

AVAILABLE NODE KINDS:
- Triggers: trigger.facebook.comment, trigger.webhook.inbound, trigger.scheduler.cron
- Actions: 
  * action.facebook.reply (for replying to Facebook comments)
  * action.facebook.dm (for sending Facebook direct messages)
  * action.telegram.sendMessage (for Telegram messages)
  * action.email.send (for sending emails)
  * action.sheets.appendRow (for saving to Google Sheets)
  * action.http.request (for generic API calls - use this for posting to Facebook/Instagram/Twitter/LinkedIn, fetching data, etc.)
- Logic: logic.filter, ai.guard, ai.generate

IMPORTANT RULES:
- When the user asks to REMOVE or DELETE a node, you MUST use REMOVE_NODE operation with the exact node ID from the available nodes list
- Use the exact node ID provided in the "Available nodes" section - do NOT make up IDs
- For REMOVE_NODE operations, the format is: {"op": "REMOVE_NODE", "id": "exact_node_id_here"}
- If removing multiple nodes, use BULK operation with multiple REMOVE_NODE ops
- Prefer UPDATE_NODE and REWIRE over delete+add for modifications
- Keep exactly one trigger (never remove the only trigger)
- Maintain a sensible linear flow unless branching is requested
- For HTTP requests, include helpful context in the config like {"url": "...", "method": "POST", "platform": "Facebook"} or {"url": "...", "method": "POST", "service": "Instagram"} to help with labeling
- Output only valid JSON for the GraphPatch shape—no prose or explanations`;

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
      const nodeIdMap = nodes.map((n, idx) => {
        const label = n.data?.label || 'Untitled';
        const kind = n.data?.kind || 'unknown';
        const role = n.data?.role || 'UNKNOWN';
        return `  ${idx + 1}. "${label}" (${kind}, ${role}): id="${n.id}"`;
      }).join('\n');
      enhancedContext = `${contextSummary}\n\nAvailable nodes (use the exact id for REMOVE_NODE operations):\n${nodeIdMap}`;
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
    console.log('📦 AI function call message:', completion.choices[0].message);
    
    // Validate args structure
    if (!args.ops || !Array.isArray(args.ops) || args.ops.length === 0) {
      console.warn('⚠️ AI returned invalid ops array, falling back to rule-based planner');
      console.warn('⚠️ Args received:', args);
      return planFromIntentFallback(intent, contextSummary, nodes || []);
    }
    
    // Log each operation for debugging
    args.ops.forEach((op, idx) => {
      console.log(`📦 Operation ${idx + 1}:`, JSON.stringify(op, null, 2));
    });
    
    // Normalize all operations first
    // Build a kind->id mapping as we normalize nodes
    const kindToIdMap = new Map();
    const normalizedOps = args.ops
      .filter(op => op && op.op) // Filter out invalid operations
      .map(op => {
        // Check if AI returned node properties at top level instead of nested
        if (op.op === 'ADD_NODE' && !op.node && (op.id || op.kind || op.label || op.data)) {
          console.warn('⚠️ AI returned ADD_NODE with node properties at top level, restructuring...');
          // Extract kind from id if it looks like a kind (e.g., "trigger.scheduler.cron" or "action.http.request")
          let nodeKind = op.kind;
          if (!nodeKind && op.id && (op.id.includes('action.') || op.id.includes('trigger.') || op.id.includes('logic.') || op.id.includes('ai.'))) {
            nodeKind = op.id; // Use the id as the kind if it looks like a kind
            console.log(`📝 Extracted kind "${nodeKind}" from id "${op.id}"`);
          }
          if (!nodeKind) {
            nodeKind = 'action.http.request'; // Fallback default
          }
          // Generate unique ID if not provided or if it looks like a kind
          let nodeId = op.id;
          if (!nodeId || nodeId === nodeKind || nodeId.includes('action.') || nodeId.includes('trigger.') || nodeId.includes('logic.') || nodeId.includes('ai.')) {
            nodeId = undefined; // Let createNode generate a unique ID
            console.warn('⚠️ Generated new unique ID for node. Kind:', nodeKind);
          }
          op.node = {
            id: nodeId,
            type: op.type || 'default',
            position: op.position || { x: 100, y: 100 },
            data: op.data || {
              kind: nodeKind,
              label: op.label || 'Untitled Node',
              config: op.config || {}
            }
          };
        }
        const normalized = normalizePatch(op);
        // For HTTP requests, try to add platform context from intent if not in config
        if (normalized && normalized.op === 'ADD_NODE' && normalized.node && normalized.node.data?.kind === 'action.http.request') {
          const lowerIntent = (originalIntent || intent).toLowerCase();
          if (!normalized.node.data.config.platform && !normalized.node.data.config.service) {
            if (lowerIntent.includes('facebook') || lowerIntent.includes('fb')) {
              normalized.node.data.config.platform = 'Facebook';
            } else if (lowerIntent.includes('instagram')) {
              normalized.node.data.config.platform = 'Instagram';
            } else if (lowerIntent.includes('twitter')) {
              normalized.node.data.config.platform = 'Twitter';
            } else if (lowerIntent.includes('linkedin')) {
              normalized.node.data.config.platform = 'LinkedIn';
            }
          }
          // Regenerate label with updated config
          if (normalized.node.data.config.platform || normalized.node.data.config.service) {
            normalized.node.data.label = generateNodeLabel(normalized.node.data.kind, normalized.node.data.config);
          }
        }
        // Track kind->id mapping for edge resolution
        if (normalized && normalized.op === 'ADD_NODE' && normalized.node && normalized.node.data?.kind) {
          const kind = normalized.node.data.kind;
          const id = normalized.node.id;
          if (!kindToIdMap.has(kind)) {
            kindToIdMap.set(kind, []);
          }
          kindToIdMap.get(kind).push({ id, node: normalized.node });
          console.log(`📝 Mapped kind "${kind}" -> id "${id}"`);
        }
        // Also track edges that need fixing
        if (normalized && normalized.op === 'ADD_EDGE') {
          const sourceId = normalized.from || (normalized.edge && normalized.edge.source);
          const targetId = normalized.to || (normalized.edge && normalized.edge.target);
          if (sourceId && (sourceId.includes('action.') || sourceId.includes('trigger.'))) {
            console.log(`⚠️ Edge with kind-based source detected: "${sourceId}"`);
          }
          if (targetId && (targetId.includes('action.') || targetId.includes('trigger.'))) {
            console.log(`⚠️ Edge with kind-based target detected: "${targetId}"`);
          }
        }
        return normalized;
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
    
    // Post-process: fix edge source/target IDs that use kinds instead of actual IDs
    // Do this AFTER all nodes are normalized and added to the mapping
    console.log('🔍 Kind to ID mapping (before edge fixing):', Array.from(kindToIdMap.entries()).map(([k, v]) => `${k} -> [${v.map(n => n.id).join(', ')}]`));
    console.log('🔍 Normalized operations count:', normalizedOps.length);
    
    // Helper function to fix edges in an operation
    const fixEdgesInOp = (op) => {
      if (!op || !op.op) return op;
      
      // Fix ADD_EDGE operations
      if (op.op === 'ADD_EDGE') {
        let sourceId = op.from || (op.edge && op.edge.source);
        let targetId = op.to || (op.edge && op.edge.target);
        let sourceFixed = false;
        let targetFixed = false;
        
        console.log(`🔍 Processing edge: source="${sourceId}", target="${targetId}"`);
        
        // Check if source/target look like kinds and resolve them
        if (sourceId && (sourceId.includes('action.') || sourceId.includes('trigger.') || kindToIdMap.has(sourceId))) {
          const nodesOfKind = kindToIdMap.get(sourceId);
          if (nodesOfKind && nodesOfKind.length > 0) {
            const oldSourceId = sourceId;
            sourceId = nodesOfKind[0].id;
            sourceFixed = true;
            console.log(`🔗 Fixed edge source: "${oldSourceId}" -> "${sourceId}"`);
          } else {
            console.warn(`⚠️ Could not find nodes for kind "${sourceId}" in mapping. Available kinds:`, Array.from(kindToIdMap.keys()));
          }
        }
        
        if (targetId && (targetId.includes('action.') || targetId.includes('trigger.') || kindToIdMap.has(targetId))) {
          const nodesOfKind = kindToIdMap.get(targetId);
          if (nodesOfKind && nodesOfKind.length > 0) {
            const oldTargetId = targetId;
            targetId = nodesOfKind[0].id;
            targetFixed = true;
            console.log(`🔗 Fixed edge target: "${oldTargetId}" -> "${targetId}"`);
          } else {
            console.warn(`⚠️ Could not find nodes for kind "${targetId}" in mapping. Available kinds:`, Array.from(kindToIdMap.keys()));
          }
        }
        
        if (sourceFixed || targetFixed) {
          console.log(`✅ Updated edge: source="${sourceId}", target="${targetId}"`);
          // Create a new object to ensure mutation is preserved
          if (op.edge) {
            return {
              ...op,
              edge: {
                ...op.edge,
                source: sourceId,
                target: targetId
              }
            };
          } else {
            return {
              ...op,
              from: sourceId,
              to: targetId
            };
          }
        }
        return op;
      }
      
      // Fix REWIRE operations
      if (op.op === 'REWIRE') {
        let fromId = op.from;
        let toId = op.to;
        let fromFixed = false;
        let toFixed = false;
        
        if (fromId && (fromId.includes('action.') || fromId.includes('trigger.') || kindToIdMap.has(fromId))) {
          const nodesOfKind = kindToIdMap.get(fromId);
          if (nodesOfKind && nodesOfKind.length > 0) {
            fromId = nodesOfKind[0].id;
            fromFixed = true;
            console.log(`🔗 Fixed REWIRE from: ${op.from} -> ${fromId}`);
          }
        }
        
        if (toId && (toId.includes('action.') || toId.includes('trigger.') || kindToIdMap.has(toId))) {
          const nodesOfKind = kindToIdMap.get(toId);
          if (nodesOfKind && nodesOfKind.length > 0) {
            toId = nodesOfKind[0].id;
            toFixed = true;
            console.log(`🔗 Fixed REWIRE to: ${op.to} -> ${toId}`);
          }
        }
        
        if (fromFixed || toFixed) {
          // Create a new object to ensure mutation is preserved
          return {
            ...op,
            from: fromId,
            to: toId
          };
        }
      }
      
      // Recursively fix edges in BULK operations
      if (op.op === 'BULK' && op.ops && Array.isArray(op.ops)) {
        const fixedOps = op.ops.map(nestedOp => fixEdgesInOp(nestedOp));
        // Create a new object to ensure mutation is preserved
        return { ...op, ops: fixedOps };
      }
      
      return op;
    };
    
    // First, fix all edges in all operations (including nested BULK ops)
    let processedOps = normalizedOps.map((op, idx) => {
      console.log(`🔧 Processing operation ${idx + 1}/${normalizedOps.length}: ${op.op}`);
      const fixed = fixEdgesInOp(op);
      if (fixed !== op) {
        console.log(`✅ Operation ${idx + 1} was modified by edge fixing`);
      }
      return fixed;
    });
    
    // Then process REMOVE_NODE/UPDATE_NODE matching (this might create new objects, so we need to preserve edge fixes)
    processedOps = processedOps.map(op => {
      if ((op.op === 'REMOVE_NODE' || op.op === 'UPDATE_NODE') && op.id) {
        // Try to match by ID first (exact match)
        let matchedNode = nodes.find(n => n.id === op.id);
        
        // If not found, try to match by label (AI might return a label instead of ID)
        if (!matchedNode && nodes.length > 0) {
          const searchId = op.id.toLowerCase().trim();
          console.log(`🔍 Trying to match "${op.id}" to a node...`);
          
          matchedNode = nodes.find(n => {
            const nodeLabel = (n.data?.label || '').toLowerCase().trim();
            const nodeId = n.id.toLowerCase();
            const nodeKind = (n.data?.kind || '').toLowerCase();
            
            // Strategy 1: Exact label match
            if (nodeLabel === searchId) {
              console.log(`  ✓ Exact label match: "${nodeLabel}"`);
              return true;
            }
            
            // Strategy 2: Exact ID match (case-insensitive)
            if (nodeId === searchId) {
              console.log(`  ✓ Exact ID match: "${nodeId}"`);
              return true;
            }
            
            // Strategy 3: Label contains search term or vice versa
            if (nodeLabel.includes(searchId) || searchId.includes(nodeLabel)) {
              console.log(`  ✓ Partial label match: "${nodeLabel}" contains "${searchId}"`);
              return true;
            }
            
            // Strategy 4: Word match - check if any words in search match words in label
            const searchWords = searchId.split(/\s+/).filter(w => w.length > 2);
            const labelWords = nodeLabel.split(/\s+/);
            if (searchWords.length > 0 && searchWords.some(w => labelWords.includes(w))) {
              console.log(`  ✓ Word match: "${searchWords.join(', ')}" found in "${nodeLabel}"`);
              return true;
            }
            
            // Strategy 5: Match by kind keywords (e.g., "facebook reply" matches "action.facebook.reply")
            const kindKeywords = ['facebook', 'sheets', 'email', 'telegram', 'reply', 'dm', 'http', 'webhook', 'scheduler'];
            const matchingKeyword = kindKeywords.find(k => searchId.includes(k) && nodeKind.includes(k));
            if (matchingKeyword) {
              console.log(`  ✓ Kind keyword match: "${matchingKeyword}" found in both search and kind`);
              return true;
            }
            
            // Strategy 6: Match step numbers (e.g., "step 1", "first step")
            const stepMatch = searchId.match(/(?:step|first|second|third|fourth|fifth|1st|2nd|3rd|4th|5th)\s*(\d+)?/);
            if (stepMatch) {
              const stepNum = stepMatch[1] ? parseInt(stepMatch[1]) : 1;
              // This would require knowing the order, but we can't do that here easily
              // Skip this strategy for now
            }
            
            return false;
          });
        }
        
        if (matchedNode) {
          console.log(`✅ Matched AI's "${op.id}" to node:`, matchedNode.id, `(${matchedNode.data?.label})`);
          return { ...op, id: matchedNode.id };
        } else {
          console.error(`❌ Could not match AI's "${op.id}" to any node.`);
          console.error(`Available nodes:`, nodes.map(n => ({ 
            id: n.id, 
            label: n.data?.label,
            kind: n.data?.kind 
          })));
          // Don't return the patch if we can't match it - it will fail anyway
          return null;
        }
      }
      return op;
    }).filter(op => op !== null); // Filter out nulls from failed matches
    
    // Check if we have any valid operations after processing
    if (processedOps.length === 0) {
      console.error('❌ No valid operations after processing. All operations were filtered out.');
      console.error('❌ Original operations:', normalizedOps);
      // Fall back to rule-based planner
      return planFromIntentFallback(intent, contextSummary, nodes || []);
    }
    
    // Log final operations to verify edges are fixed
    console.log('🔍 Final processed operations:');
    processedOps.forEach((op, idx) => {
      if (op.op === 'ADD_EDGE') {
        const sourceId = op.from || (op.edge && op.edge.source);
        const targetId = op.to || (op.edge && op.edge.target);
        console.log(`  Edge ${idx + 1}: source="${sourceId}", target="${targetId}"`);
        // Double-check: if still has kind-based ID, try to fix it one more time
        if (sourceId && (sourceId.includes('action.') || sourceId.includes('trigger.'))) {
          const nodesOfKind = kindToIdMap.get(sourceId);
          if (nodesOfKind && nodesOfKind.length > 0) {
            console.warn(`⚠️ Edge ${idx + 1} still has kind-based source "${sourceId}", fixing now...`);
            if (op.edge) {
              op.edge.source = nodesOfKind[0].id;
            } else {
              op.from = nodesOfKind[0].id;
            }
            console.log(`  ✅ Fixed edge ${idx + 1} source to "${nodesOfKind[0].id}"`);
          }
        }
        if (targetId && (targetId.includes('action.') || targetId.includes('trigger.'))) {
          const nodesOfKind = kindToIdMap.get(targetId);
          if (nodesOfKind && nodesOfKind.length > 0) {
            console.warn(`⚠️ Edge ${idx + 1} still has kind-based target "${targetId}", fixing now...`);
            if (op.edge) {
              op.edge.target = nodesOfKind[0].id;
            } else {
              op.to = nodesOfKind[0].id;
            }
            console.log(`  ✅ Fixed edge ${idx + 1} target to "${nodesOfKind[0].id}"`);
          }
        }
      } else if (op.op === 'BULK' && op.ops) {
        console.log(`  BULK ${idx + 1} with ${op.ops.length} nested ops`);
        op.ops.forEach((nestedOp, nestedIdx) => {
          if (nestedOp.op === 'ADD_EDGE') {
            const sourceId = nestedOp.from || (nestedOp.edge && nestedOp.edge.source);
            const targetId = nestedOp.to || (nestedOp.edge && nestedOp.edge.target);
            console.log(`    Nested Edge ${nestedIdx + 1}: source="${sourceId}", target="${targetId}"`);
            // Fix nested edges too
            if (sourceId && (sourceId.includes('action.') || sourceId.includes('trigger.'))) {
              const nodesOfKind = kindToIdMap.get(sourceId);
              if (nodesOfKind && nodesOfKind.length > 0) {
                if (nestedOp.edge) {
                  nestedOp.edge.source = nodesOfKind[0].id;
                } else {
                  nestedOp.from = nodesOfKind[0].id;
                }
              }
            }
            if (targetId && (targetId.includes('action.') || targetId.includes('trigger.'))) {
              const nodesOfKind = kindToIdMap.get(targetId);
              if (nodesOfKind && nodesOfKind.length > 0) {
                if (nestedOp.edge) {
                  nestedOp.edge.target = nodesOfKind[0].id;
                } else {
                  nestedOp.to = nodesOfKind[0].id;
                }
              }
            }
          }
        });
      }
    });
    
    if (processedOps.length === 1) {
      console.log('✅ Returning single operation:', processedOps[0].op);
      return processedOps[0];
    }
    
    console.log(`✅ Returning BULK operation with ${processedOps.length} operations`);
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
        const nodeKind = patch.kind || 'action.http.request';
        // Generate unique ID if not provided or if it looks like a kind
        let nodeId = patch.id;
        if (!nodeId || nodeId === nodeKind || nodeId.includes('action.') || nodeId.includes('trigger.')) {
          nodeId = undefined; // Let createNode generate a unique ID
          console.warn('⚠️ Patch id looks like a kind, will generate unique ID. Kind:', nodeKind);
        }
        patch.node = createNode(nodeKind, {
          id: nodeId,
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
    if (!patch.node.data) {
      patch.node.data = {};
    }
    
    if (!patch.node.data.kind) {
      console.warn('⚠️ Node missing kind:', patch.node);
      // Try to infer from label or set default
      patch.node.data.kind = 'action.http.request';
    }
    
    // Check and fix ID after we know the kind
    if (!patch.node.id) {
      console.warn('⚠️ Node missing id, generating one');
      patch.node.id = `node_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    } else if (patch.node.id === patch.node.data.kind || patch.node.id.includes('action.') || patch.node.id.includes('trigger.')) {
      // If AI mistakenly used the kind as the ID, generate a new unique ID
      console.warn('⚠️ Node id matches kind or looks like a kind, generating new unique id. Old id:', patch.node.id, 'Kind:', patch.node.data.kind);
      patch.node.id = `node_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
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
    
    if (!patch.node.data.label || patch.node.data.label.trim() === '' || patch.node.data.label === 'Untitled Node') {
      // Use generateNodeLabel for better labels based on config
      // For HTTP requests, try to infer platform from intent if not in config
      let config = patch.node.data.config || {};
      if (patch.node.data.kind === 'action.http.request' && !config.platform && !config.service) {
        // Try to infer from the original intent (we'll pass this through context if needed)
        // For now, just use the labeler which will check the URL
      }
      patch.node.data.label = generateNodeLabel(patch.node.data.kind, config) || getDefaultLabel(patch.node.data.kind) || patch.node.data.kind || 'Untitled Node';
      console.log('📝 Setting label in normalizePatch:', patch.node.data.kind, '→', patch.node.data.label);
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
        data: { 
          label: generateNodeLabel('trigger.facebook.comment', {}),
          config: {}
        }
      });
      patches.push({ op: 'ADD_NODE', node: triggerNode });
      cursorX += 250;
    } else if (lower.includes('schedule') || lower.includes('daily') || lower.includes('weekly') || lower.includes('every') || lower.includes('hour')) {
      const schedule = lower.includes('daily') || lower.includes('day') ? '0 0 * * *' : 
                      lower.includes('hourly') || lower.includes('hour') ? '0 * * * *' :
                      lower.includes('weekly') || lower.includes('monday') ? '0 0 * * 0' : '0 0 * * *';
      triggerNode = createNode('trigger.scheduler.cron', {
        position: { x: cursorX, y },
        data: { 
          label: generateNodeLabel('trigger.scheduler.cron', { schedule }),
          config: { schedule }
        }
      });
      patches.push({ op: 'ADD_NODE', node: triggerNode });
      cursorX += 250;
    } else if (lower.includes('webhook') || lower.includes('form') || lower.includes('submit')) {
      triggerNode = createNode('trigger.webhook.inbound', {
        position: { x: cursorX, y },
        data: { 
          label: generateNodeLabel('trigger.webhook.inbound', {}),
          config: {}
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
        data: { 
          label: generateNodeLabel('action.facebook.reply', {}),
          config: {}
        }
      });
      actionNodes.push(node);
      cursorX += 250;
    }
    
    if (lower.includes('facebook') && (lower.includes('dm') || lower.includes('direct message'))) {
      const node = createNode('action.facebook.dm', {
        position: { x: cursorX, y },
        data: { 
          label: generateNodeLabel('action.facebook.dm', {}),
          config: {}
        }
      });
      actionNodes.push(node);
      cursorX += 250;
    }
    
    if (lower.includes('sheet') || lower.includes('google') || lower.includes('save') || lower.includes('log')) {
      const node = createNode('action.sheets.appendRow', {
        position: { x: cursorX, y },
        data: { 
          label: generateNodeLabel('action.sheets.appendRow', {}),
          config: {}
        }
      });
      actionNodes.push(node);
      cursorX += 250;
    }
    
    if (lower.includes('email') || lower.includes('send') || lower.includes('remind') || lower.includes('alert') || lower.includes('notify')) {
      const node = createNode('action.email.send', {
        position: { x: cursorX, y },
        data: { 
          label: generateNodeLabel('action.email.send', {}),
          config: {}
        }
      });
      actionNodes.push(node);
      cursorX += 250;
    }
    
    if (lower.includes('telegram') || lower.includes('sms')) {
      const node = createNode('action.telegram.sendMessage', {
        position: { x: cursorX, y },
        data: { 
          label: generateNodeLabel('action.telegram.sendMessage', {}),
          config: {}
        }
      });
      actionNodes.push(node);
      cursorX += 250;
    }
    
    if (lower.includes('http') || lower.includes('api') || lower.includes('fetch') || lower.includes('collect') || lower.includes('get data')) {
      const node = createNode('action.http.request', {
        position: { x: cursorX, y },
        data: { 
          label: generateNodeLabel('action.http.request', { method: 'GET' }),
          config: { method: 'GET' }
        }
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
    console.log('🔍 Fallback planner: Detected remove/delete request');
    console.log('🔍 Intent:', intent);
    console.log('🔍 Available nodes:', existingNodes);
    
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
    
    console.log(`🔍 Extracted node name: "${nodeName}"`);
    
    if (nodeName) {
      // Try to match against existing nodes with multiple strategies
      const matchingNode = existingNodes.find(n => {
        const label = (n.label || '').toLowerCase();
        const name = nodeName.toLowerCase();
        const nodeId = (n.id || '').toLowerCase();
        const kind = (n.kind || '').toLowerCase();
        
        // Strategy 1: Exact label match
        if (label === name) {
          console.log(`  ✓ Exact label match: "${label}"`);
          return true;
        }
        
        // Strategy 2: Label contains name or vice versa
        if (label.includes(name) || name.includes(label)) {
          console.log(`  ✓ Partial label match: "${label}" contains "${name}"`);
          return true;
        }
        
        // Strategy 3: First word match
        const firstWord = name.split(' ')[0];
        if (firstWord && label.includes(firstWord)) {
          console.log(`  ✓ First word match: "${firstWord}" in "${label}"`);
          return true;
        }
        
        // Strategy 4: ID contains name (for step_0, step_1, etc.)
        if (nodeId.includes(name) || name.includes(nodeId)) {
          console.log(`  ✓ ID match: "${nodeId}" contains "${name}"`);
          return true;
        }
        
        // Strategy 5: Match by kind keywords (facebook, sheets, email, etc.)
        const keywords = ['facebook', 'sheets', 'email', 'telegram', 'reply', 'dm', 'http', 'webhook', 'scheduler'];
        const matchingKeyword = keywords.find(k => name.includes(k) && (label.includes(k) || kind.includes(k)));
        if (matchingKeyword) {
          console.log(`  ✓ Keyword match: "${matchingKeyword}" found`);
          return true;
        }
        
        return false;
      });
      
      if (matchingNode) {
        console.log(`✅ Fallback: Matched "${nodeName}" to node:`, matchingNode.id, matchingNode.label);
        patches.push({ op: 'REMOVE_NODE', id: matchingNode.id });
      } else {
        console.error(`❌ Fallback: Could not match "${nodeName}" to any node.`);
        console.error(`Available nodes:`, existingNodes.map(n => ({ id: n.id, label: n.label, kind: n.kind })));
      }
    } else {
      console.warn('⚠️ Fallback: Could not extract node name from intent:', intent);
      // If we can't extract a name, try to remove the last node (common pattern)
      if (existingNodes.length > 1) {
        const lastNode = existingNodes[existingNodes.length - 1];
        console.log(`⚠️ Fallback: Attempting to remove last node as fallback:`, lastNode.id, lastNode.label);
        patches.push({ op: 'REMOVE_NODE', id: lastNode.id });
      }
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

