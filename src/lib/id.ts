/**
 * ID generation utilities
 */

/**
 * Generate a unique ID for nodes/edges
 * @param prefix - Prefix for the ID
 * @returns Unique ID string
 */
export function generateId(prefix = 'id'): string {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

