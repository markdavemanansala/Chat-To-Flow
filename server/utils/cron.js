/**
 * Cron expression utilities
 */

/**
 * Parse and validate cron expression
 */
export function parseCronExpression(expression) {
  // Basic validation - node-cron will do the actual validation
  const parts = expression.trim().split(/\s+/);
  
  if (parts.length < 5 || parts.length > 6) {
    throw new Error('Invalid cron expression: must have 5 or 6 parts');
  }
  
  return expression;
}

/**
 * Convert human-readable schedule to cron expression
 */
export function humanToCron(schedule) {
  const lower = schedule.toLowerCase();
  
  if (lower.includes('every 15 minutes') || lower.includes('15 min')) {
    return '*/15 * * * *';
  } else if (lower.includes('every hour') || lower.includes('hourly')) {
    return '0 * * * *';
  } else if (lower.includes('daily') || lower.includes('every day')) {
    return '0 0 * * *';
  } else if (lower.includes('weekly') || lower.includes('every week')) {
    return '0 0 * * 0';
  } else if (lower.includes('monthly') || lower.includes('every month')) {
    return '0 0 1 * *';
  }
  
  // Default to daily
  return '0 0 * * *';
}

