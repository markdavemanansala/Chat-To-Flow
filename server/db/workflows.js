/**
 * Workflow database operations
 */

import fs from 'fs/promises';
import { WORKFLOWS_FILE } from './index.js';

/**
 * Read all workflows
 */
async function readWorkflows() {
  try {
    const data = await fs.readFile(WORKFLOWS_FILE, 'utf-8');
    return JSON.parse(data);
  } catch (error) {
    console.error('Error reading workflows:', error);
    return [];
  }
}

/**
 * Write workflows
 */
async function writeWorkflows(workflows) {
  await fs.writeFile(WORKFLOWS_FILE, JSON.stringify(workflows, null, 2));
}

/**
 * Get all active workflows (with cron triggers)
 */
export async function getActiveWorkflows() {
  const workflows = await readWorkflows();
  return workflows.filter((w) => {
    // Filter for workflows that have cron triggers and are active
    const hasCronTrigger = w.nodes?.some(
      (node) => node.data?.kind === 'trigger.scheduler.cron'
    );
    return hasCronTrigger && w.active !== false;
  });
}

/**
 * Get workflow by ID
 */
export async function getWorkflowById(id) {
  const workflows = await readWorkflows();
  return workflows.find((w) => w.id === id);
}

/**
 * Save workflow
 */
export async function saveWorkflow(workflow) {
  const workflows = await readWorkflows();
  const index = workflows.findIndex((w) => w.id === workflow.id);
  
  if (index >= 0) {
    workflows[index] = { ...workflows[index], ...workflow, updatedAt: new Date().toISOString() };
  } else {
    workflows.push({
      ...workflow,
      id: workflow.id || `workflow_${Date.now()}`,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      active: workflow.active !== undefined ? workflow.active : true,
    });
  }
  
  await writeWorkflows(workflows);
  return workflows.find((w) => w.id === workflow.id);
}

/**
 * Delete workflow
 */
export async function deleteWorkflow(id) {
  const workflows = await readWorkflows();
  const filtered = workflows.filter((w) => w.id !== id);
  await writeWorkflows(filtered);
  return filtered.length < workflows.length;
}

/**
 * Get workflows by trigger kind
 */
export async function getWorkflowsByTrigger(triggerKind, filter = {}) {
  const workflows = await readWorkflows();
  return workflows.filter((w) => {
    if (w.active === false) {
      return false;
    }

    // Check if workflow has the specified trigger
    const hasTrigger = w.nodes?.some(
      (node) => node.data?.kind === triggerKind
    );

    if (!hasTrigger) {
      return false;
    }

    // Apply additional filters
    if (filter.webhookId) {
      const triggerNode = w.nodes?.find(
        (node) => node.data?.kind === triggerKind
      );
      const webhookId = triggerNode?.data?.config?.webhookId;
      return webhookId === filter.webhookId;
    }

    return true;
  });
}

