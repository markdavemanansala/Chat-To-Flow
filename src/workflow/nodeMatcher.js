/**
 * @fileoverview Direct node matching and manipulation utilities
 * This provides a simpler, more direct way for the AI to manipulate nodes
 */

/**
 * Find a node by matching user intent to node labels/IDs
 * @param {import('reactflow').Node[]} nodes
 * @param {string} intent - User's intent (e.g., "remove facebook reply", "delete sheets node")
 * @returns {import('reactflow').Node | null}
 */
export function findNodeByIntent(nodes, intent) {
  const lower = intent.toLowerCase();
  
  // Extract keywords from intent
  const keywords = extractKeywords(lower);
  
  console.log('🔍 Finding node for intent:', intent);
  console.log('🔍 Extracted keywords:', keywords);
  console.log('📋 Available nodes:', nodes.map(n => ({ id: n.id, label: n.data?.label, kind: n.data?.kind })));
  
  // Try multiple matching strategies
  for (const node of nodes) {
    const label = (node.data?.label || '').toLowerCase();
    const kind = (node.data?.kind || '').toLowerCase();
    const id = node.id.toLowerCase();
    
    // Strategy 1: Exact label match
    if (keywords.some(k => label === k)) {
      console.log(`✅ Exact match: "${intent}" → node "${node.id}" (${node.data?.label})`);
      return node;
    }
    
    // Strategy 2: Label contains keyword (bidirectional)
    if (keywords.some(k => {
      if (k.length < 3) return false; // Skip short keywords
      return label.includes(k) || k.includes(label);
    })) {
      console.log(`✅ Partial match: "${intent}" → node "${node.id}" (${node.data?.label})`);
      return node;
    }
    
    // Strategy 3: Multi-word phrase match (e.g., "validate information" matches "Validate Information to ensure...")
    const intentPhrase = lower.replace(/remove|delete|the|node|step|action|trigger/g, '').trim();
    if (intentPhrase.length > 5 && label.includes(intentPhrase)) {
      console.log(`✅ Phrase match: "${intent}" → node "${node.id}" (${node.data?.label})`);
      return node;
    }
    
    // Strategy 4: All keywords present in label (for multi-word matches)
    if (keywords.length > 1 && keywords.every(k => k.length > 3 && label.includes(k))) {
      console.log(`✅ All keywords match: "${intent}" → node "${node.id}" (${node.data?.label})`);
      return node;
    }
    
    // Strategy 5: Kind match (e.g., "facebook reply" matches "action.facebook.reply")
    if (keywords.some(k => kind.includes(k) || k.includes(kind.split('.').pop()))) {
      console.log(`✅ Kind match: "${intent}" → node "${node.id}" (${node.data?.kind})`);
      return node;
    }
    
    // Strategy 6: Individual word match
    if (keywords.some(k => {
      const labelWords = label.split(/\s+/);
      const kindParts = kind.split('.');
      return labelWords.includes(k) || kindParts.includes(k);
    })) {
      console.log(`✅ Word match: "${intent}" → node "${node.id}"`);
      return node;
    }
    
    // Strategy 7: ID match (for step_0, step_1, etc.)
    if (keywords.some(k => id.includes(k))) {
      console.log(`✅ ID match: "${intent}" → node "${node.id}"`);
      return node;
    }
  }
  
  console.warn(`⚠️ No node found for intent: "${intent}"`);
  return null;
}

/**
 * Extract keywords from user intent
 * @param {string} intent
 * @returns {string[]}
 */
function extractKeywords(intent) {
  // Remove common words
  const stopWords = ['remove', 'delete', 'the', 'node', 'step', 'action', 'trigger', 'a', 'an'];
  const words = intent.split(/\s+/).filter(w => w.length > 2 && !stopWords.includes(w));
  
  // Also extract common patterns
  const patterns = [
    'facebook',
    'sheets',
    'google sheets',
    'email',
    'telegram',
    'reply',
    'dm',
    'direct message',
    'http',
    'webhook',
    'filter',
    'guard',
    'generate',
    'comment',
    'validate',
    'validation',
    'information',
    'validate information',
    'validate info',
    'data validation',
    'form',
    'crm',
    'lead',
    'welcome',
    'email series',
  ];
  
  const foundPatterns = patterns.filter(p => intent.includes(p));
  
  // Add multi-word patterns that match the intent
  if (intent.includes('validate') && intent.includes('information')) {
    foundPatterns.push('validate information');
  }
  if (intent.includes('validate') && intent.includes('info')) {
    foundPatterns.push('validate info');
  }
  
  return [...new Set([...words, ...foundPatterns])];
}

/**
 * Find multiple nodes by intent (for batch operations)
 * @param {import('reactflow').Node[]} nodes
 * @param {string} intent
 * @returns {import('reactflow').Node[]}
 */
export function findNodesByIntent(nodes, intent) {
  const lower = intent.toLowerCase();
  const results = [];
  
  // If intent mentions "all" or specific patterns, match multiple
  if (lower.includes('all') || lower.includes('every')) {
    const keywords = extractKeywords(intent);
    return nodes.filter(node => {
      const label = (node.data?.label || '').toLowerCase();
      const kind = (node.data?.kind || '').toLowerCase();
      return keywords.some(k => label.includes(k) || kind.includes(k));
    });
  }
  
  // Single node match
  const node = findNodeByIntent(nodes, intent);
  if (node) {
    results.push(node);
  }
  
  return results;
}

