/**
 * Workflow Execution Service
 * Executes workflows using the frontend executor logic
 * 
 * Requires tsx to be installed for TypeScript support:
 * npm install -D tsx
 */

import { saveExecutionHistory } from '../db/executions.js';

/**
 * Execute a workflow
 * @param {Object} workflow - Workflow object with nodes and edges
 * @returns {Promise<Object>} Execution result
 */
export async function executeWorkflow(workflow) {
  const startTime = Date.now();
  
  try {
    const nodes = workflow.nodes || [];
    const edges = workflow.edges || [];
    
    if (nodes.length === 0) {
      throw new Error('Workflow has no nodes');
    }

    let result;
    
    try {
      // Import the TypeScript executor
      // This works with tsx (TypeScript executor for Node.js)
      const executorModule = await import('../../src/workflow/executor.ts');
      
      if (executorModule && executorModule.executeWorkflow) {
        result = await executorModule.executeWorkflow(nodes, edges, {});
      } else {
        throw new Error('Executor function not found in module');
      }
    } catch (importError) {
      console.error('❌ Could not import TypeScript executor:', importError.message);
      console.log('💡 Make sure tsx is installed: npm install -D tsx');
      console.log('💡 And run server with: npm run server (uses tsx)');
      
      // Return error result
      result = {
        success: false,
        error: `Executor import failed: ${importError.message}. Install tsx: npm install -D tsx`,
        results: [],
        totalDuration: Date.now() - startTime,
      };
    }

    // Save execution history
    await saveExecutionHistory({
      workflowId: workflow.id,
      workflowName: workflow.name,
      success: result.success,
      duration: result.totalDuration || (Date.now() - startTime),
      error: result.error,
      results: result.results || [],
      executedAt: new Date().toISOString(),
    });

    return result;
  } catch (error) {
    console.error('Workflow execution error:', error);
    
    // Save failed execution
    await saveExecutionHistory({
      workflowId: workflow.id,
      workflowName: workflow.name,
      success: false,
      duration: Date.now() - startTime,
      error: error.message,
      executedAt: new Date().toISOString(),
    });

    return {
      success: false,
      error: error.message,
      totalDuration: Date.now() - startTime,
      results: [],
    };
  }
}
