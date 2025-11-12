/**
 * Cron Scheduler Service
 * Handles periodic execution of workflows with cron triggers
 */

import cron from 'node-cron';
import { executeWorkflow } from '../services/workflowExecutor.js';
import { getActiveWorkflows } from '../db/workflows.js';
import { parseCronExpression } from '../utils/cron.js';

class SchedulerService {
  constructor() {
    this.jobs = new Map(); // Map of workflowId -> cron job
    this.isRunning = false;
  }

  /**
   * Start the scheduler service
   */
  async start() {
    if (this.isRunning) {
      console.log('⚠️ Scheduler already running');
      return;
    }

    this.isRunning = true;
    console.log('⏰ Starting scheduler service...');

    // Load and schedule all active workflows
    await this.loadAndScheduleWorkflows();

    // Schedule periodic reload (every 5 minutes) to pick up new workflows
    this.reloadInterval = setInterval(async () => {
      await this.loadAndScheduleWorkflows();
    }, 5 * 60 * 1000); // 5 minutes

    console.log('✅ Scheduler service started');
  }

  /**
   * Stop the scheduler service
   */
  stop() {
    if (!this.isRunning) {
      return;
    }

    this.isRunning = false;
    console.log('⏰ Stopping scheduler service...');

    // Clear all jobs
    this.jobs.forEach((job, workflowId) => {
      job.stop();
      this.jobs.delete(workflowId);
    });

    // Clear reload interval
    if (this.reloadInterval) {
      clearInterval(this.reloadInterval);
    }

    console.log('✅ Scheduler service stopped');
  }

  /**
   * Load active workflows and schedule them
   */
  async loadAndScheduleWorkflows() {
    try {
      const workflows = await getActiveWorkflows();

      // Get current scheduled workflow IDs
      const scheduledIds = new Set(this.jobs.keys());

      // Schedule new workflows
      for (const workflow of workflows) {
        const workflowId = workflow.id;

        // Skip if already scheduled
        if (scheduledIds.has(workflowId)) {
          continue;
        }

        // Find cron trigger node
        const cronNode = workflow.nodes?.find(
          (node) => node.data?.kind === 'trigger.scheduler.cron'
        );

        if (!cronNode) {
          continue; // No cron trigger, skip
        }

        const cronExpression = cronNode.data?.config?.cron;
        if (!cronExpression) {
          console.warn(`⚠️ Workflow ${workflowId} has cron trigger but no cron expression`);
          continue;
        }

        // Validate cron expression
        if (!cron.validate(cronExpression)) {
          console.warn(`⚠️ Invalid cron expression for workflow ${workflowId}: ${cronExpression}`);
          continue;
        }

        // Schedule the workflow
        this.scheduleWorkflow(workflowId, cronExpression, workflow);
      }

      // Remove workflows that are no longer active
      const activeIds = new Set(workflows.map((w) => w.id));
      for (const workflowId of scheduledIds) {
        if (!activeIds.has(workflowId)) {
          const job = this.jobs.get(workflowId);
          if (job) {
            job.stop();
            this.jobs.delete(workflowId);
            console.log(`🗑️ Removed scheduled workflow: ${workflowId}`);
          }
        }
      }
    } catch (error) {
      console.error('❌ Error loading workflows for scheduling:', error);
    }
  }

  /**
   * Schedule a single workflow
   */
  scheduleWorkflow(workflowId, cronExpression, workflow) {
    // Stop existing job if any
    const existingJob = this.jobs.get(workflowId);
    if (existingJob) {
      existingJob.stop();
    }

    // Create new cron job
    const job = cron.schedule(cronExpression, async () => {
      console.log(`⏰ Executing scheduled workflow: ${workflowId} (${workflow.name || 'Unnamed'})`);
      
      try {
        const result = await executeWorkflow(workflow);
        
        if (result.success) {
          console.log(`✅ Workflow ${workflowId} executed successfully`);
        } else {
          console.error(`❌ Workflow ${workflowId} execution failed:`, result.error);
        }
      } catch (error) {
        console.error(`❌ Error executing workflow ${workflowId}:`, error);
      }
    }, {
      scheduled: true,
      timezone: process.env.TZ || 'UTC',
    });

    this.jobs.set(workflowId, job);
    console.log(`📅 Scheduled workflow: ${workflowId} with cron: ${cronExpression}`);
  }

  /**
   * Get status of scheduler
   */
  getStatus() {
    return {
      isRunning: this.isRunning,
      activeJobs: this.jobs.size,
      scheduledWorkflows: Array.from(this.jobs.keys()),
    };
  }
}

export const schedulerService = new SchedulerService();

