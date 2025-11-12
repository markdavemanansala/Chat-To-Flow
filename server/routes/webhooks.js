/**
 * Webhook Routes
 * Handles inbound webhook triggers
 */

import express from 'express';
import { getCredentials } from '../db/credentials.js';
import { getWorkflowsByTrigger } from '../db/workflows.js';
import { executeWorkflow } from '../services/workflowExecutor.js';
import crypto from 'crypto';

export const webhookRouter = express.Router();

// Middleware to parse JSON
webhookRouter.use(express.json());
webhookRouter.use(express.urlencoded({ extended: true }));

/**
 * POST /api/webhooks/:webhookId
 * Receive webhook payload
 */
webhookRouter.post('/:webhookId', async (req, res) => {
  try {
    const { webhookId } = req.params;
    const payload = req.body;
    const headers = req.headers;

    // Get webhook configuration
    const webhookCreds = await getCredentials(`webhook_${webhookId}`);
    
    if (!webhookCreds) {
      return res.status(404).json({ error: 'Webhook not found' });
    }

    const config = webhookCreds.credentials;

    // Verify secret if configured
    if (config.secret && config.verifySecret) {
      const providedSecret = headers['x-webhook-secret'] || headers['x-secret'];
      
      if (providedSecret !== config.secret) {
        return res.status(401).json({ error: 'Invalid webhook secret' });
      }
    }

    // Find workflows with this webhook trigger
    const workflows = await getWorkflowsByTrigger('trigger.webhook.inbound', {
      webhookId,
    });

    if (workflows.length === 0) {
      // Webhook received but no workflows configured
      return res.json({
        received: true,
        workflowsTriggered: 0,
        message: 'Webhook received but no workflows configured',
      });
    }

    // Execute all matching workflows
    const results = [];
    for (const workflow of workflows) {
      try {
        const result = await executeWorkflow({
          ...workflow,
          // Pass webhook payload as initial payload
        });

        results.push({
          workflowId: workflow.id,
          workflowName: workflow.name,
          success: result.success,
          error: result.error,
        });
      } catch (error) {
        results.push({
          workflowId: workflow.id,
          workflowName: workflow.name,
          success: false,
          error: error.message,
        });
      }
    }

    res.json({
      received: true,
      workflowsTriggered: workflows.length,
      results,
    });
  } catch (error) {
    console.error('Webhook error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/webhooks/:webhookId/verify
 * Verify webhook configuration (for webhook providers that require verification)
 */
webhookRouter.get('/:webhookId/verify', async (req, res) => {
  try {
    const { webhookId } = req.params;
    const { mode, token, challenge } = req.query;

    // Facebook webhook verification
    if (mode === 'subscribe') {
      const webhookCreds = await getCredentials(`webhook_${webhookId}`);
      const verifyToken = webhookCreds?.credentials?.verifyToken;

      if (token === verifyToken) {
        return res.send(challenge);
      } else {
        return res.status(403).send('Invalid verify token');
      }
    }

    res.json({
      webhookId,
      url: `${req.protocol}://${req.get('host')}/api/webhooks/${webhookId}`,
      verified: true,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

