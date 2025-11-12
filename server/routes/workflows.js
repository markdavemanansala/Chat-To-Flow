/**
 * Workflow API Routes
 */

import express from 'express';
import { getWorkflowById, saveWorkflow, deleteWorkflow, getActiveWorkflows } from '../db/workflows.js';
import { executeWorkflow } from '../services/workflowExecutor.js';
import { getExecutionHistory } from '../db/executions.js';
import { schedulerService } from '../services/scheduler.js';

export const workflowRouter = express.Router();

/**
 * GET /api/workflows
 * Get all workflows
 */
workflowRouter.get('/', async (req, res) => {
  try {
    const workflows = await getActiveWorkflows();
    res.json(workflows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/workflows/:id
 * Get workflow by ID
 */
workflowRouter.get('/:id', async (req, res) => {
  try {
    const workflow = await getWorkflowById(req.params.id);
    if (!workflow) {
      return res.status(404).json({ error: 'Workflow not found' });
    }
    res.json(workflow);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/workflows
 * Create or update workflow
 */
workflowRouter.post('/', async (req, res) => {
  try {
    const workflow = await saveWorkflow(req.body);
    
    // Reload scheduler to pick up new/updated workflow
    await schedulerService.loadAndScheduleWorkflows();
    
    res.json(workflow);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * PUT /api/workflows/:id
 * Update workflow
 */
workflowRouter.put('/:id', async (req, res) => {
  try {
    const workflow = await saveWorkflow({ ...req.body, id: req.params.id });
    
    // Reload scheduler
    await schedulerService.loadAndScheduleWorkflows();
    
    res.json(workflow);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * DELETE /api/workflows/:id
 * Delete workflow
 */
workflowRouter.delete('/:id', async (req, res) => {
  try {
    const deleted = await deleteWorkflow(req.params.id);
    if (!deleted) {
      return res.status(404).json({ error: 'Workflow not found' });
    }
    
    // Reload scheduler
    await schedulerService.loadAndScheduleWorkflows();
    
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/workflows/:id/execute
 * Manually execute a workflow
 */
workflowRouter.post('/:id/execute', async (req, res) => {
  try {
    const workflow = await getWorkflowById(req.params.id);
    if (!workflow) {
      return res.status(404).json({ error: 'Workflow not found' });
    }

    const result = await executeWorkflow(workflow);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/workflows/:id/executions
 * Get execution history for a workflow
 */
workflowRouter.get('/:id/executions', async (req, res) => {
  try {
    const limit = parseInt(req.query.limit || '50');
    const executions = await getExecutionHistory(req.params.id, limit);
    res.json(executions);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/workflows/scheduler/status
 * Get scheduler status
 */
workflowRouter.get('/scheduler/status', (req, res) => {
  res.json(schedulerService.getStatus());
});

