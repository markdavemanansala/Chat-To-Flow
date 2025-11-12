/**
 * Execution history database operations
 */

import fs from 'fs/promises';
import { EXECUTIONS_FILE } from './index.js';

/**
 * Read all executions
 */
async function readExecutions() {
  try {
    const data = await fs.readFile(EXECUTIONS_FILE, 'utf-8');
    return JSON.parse(data);
  } catch (error) {
    console.error('Error reading executions:', error);
    return [];
  }
}

/**
 * Write executions
 */
async function writeExecutions(executions) {
  await fs.writeFile(EXECUTIONS_FILE, JSON.stringify(executions, null, 2));
}

/**
 * Save execution history
 */
export async function saveExecutionHistory(execution) {
  const executions = await readExecutions();
  executions.push({
    ...execution,
    id: execution.id || `exec_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
  });
  
  // Keep only last 1000 executions
  if (executions.length > 1000) {
    executions.splice(0, executions.length - 1000);
  }
  
  await writeExecutions(executions);
  return execution;
}

/**
 * Get execution history for a workflow
 */
export async function getExecutionHistory(workflowId, limit = 50) {
  const executions = await readExecutions();
  return executions
    .filter((e) => e.workflowId === workflowId)
    .sort((a, b) => new Date(b.executedAt) - new Date(a.executedAt))
    .slice(0, limit);
}

/**
 * Get all recent executions
 */
export async function getRecentExecutions(limit = 100) {
  const executions = await readExecutions();
  return executions
    .sort((a, b) => new Date(b.executedAt) - new Date(a.executedAt))
    .slice(0, limit);
}

