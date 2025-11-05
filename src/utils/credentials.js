/**
 * Check if a node kind requires credentials/API keys
 * @param {string} nodeKind - The node kind (e.g., 'action.facebook.reply')
 * @returns {boolean} True if the node requires credentials
 */
export function nodeRequiresCredentials(nodeKind) {
  if (!nodeKind) return false
  
  return (
    nodeKind.includes('facebook') ||
    nodeKind.includes('telegram') ||
    nodeKind.includes('email') ||
    nodeKind.includes('sheets') ||
    nodeKind.includes('api')
  )
}

/**
 * Check if a node has the required credentials stored
 * @param {string} nodeKind - The node kind
 * @returns {boolean} True if credentials exist for this node
 */
export function hasNodeCredentials(nodeKind) {
  if (!nodeRequiresCredentials(nodeKind)) return true // Doesn't need creds, so "has" them
  
  try {
    const secrets = JSON.parse(localStorage.getItem('workflow_secrets') || '[]')
    return secrets.some(secret => 
      secret.nodeKinds && secret.nodeKinds.includes(nodeKind)
    )
  } catch (e) {
    console.error('Failed to check credentials', e)
    return false
  }
}

/**
 * Get a user-friendly name for the credential type needed by a node
 * @param {string} nodeKind - The node kind
 * @returns {string} The credential type name
 */
export function getCredentialTypeName(nodeKind) {
  if (!nodeKind) return 'API key'
  
  if (nodeKind.includes('facebook')) return 'Facebook API Key'
  if (nodeKind.includes('telegram')) return 'Telegram Bot Token'
  if (nodeKind.includes('email')) return 'Email API Key'
  if (nodeKind.includes('sheets')) return 'Google Sheets API Key'
  if (nodeKind.includes('api')) return 'API Key'
  
  return 'API key'
}

/**
 * Check credentials status for a node
 * @param {string} nodeKind - The node kind
 * @returns {{ requires: boolean, has: boolean, typeName: string }}
 */
export function checkNodeCredentials(nodeKind) {
  const requires = nodeRequiresCredentials(nodeKind)
  const has = hasNodeCredentials(nodeKind)
  const typeName = getCredentialTypeName(nodeKind)
  
  return { requires, has, typeName }
}

