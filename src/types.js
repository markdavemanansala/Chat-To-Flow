/**
 * @typedef {Object} Template
 * @property {string} id
 * @property {string} name
 * @property {string} description
 * @property {"F&B" | "Retail" | "Real Estate" | "Education" | "Healthcare" | "VA/Freelance" | "Generic"} industry
 * @property {string} promptHint - natural language hint the LLM could use later
 * @property {string} sampleIntent - a one-liner task description
 * @property {Array<{key: string, label: string, placeholder?: string}>} [variables]
 */

/**
 * @typedef {Object} WorkflowSummary
 * @property {string} name
 * @property {string} trigger - e.g., "facebook.comment (match='price')"
 * @property {string[]} steps - human-readable actions
 * @property {string[]} integrations - e.g., ["Facebook", "Google Sheets"]
 * @property {string} [notes]
 * @property {"template" | "chat"} source
 * @property {string} [id] - Unique identifier
 * @property {string} [savedAt] - ISO timestamp when saved
 * @property {"draft" | "live" | "archived"} [status] - Workflow status
 */

export {};

