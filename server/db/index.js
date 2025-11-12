/**
 * Database initialization
 * Using JSON file storage for simplicity (can be replaced with MongoDB/PostgreSQL)
 */

import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DB_DIR = path.join(__dirname, '../data');
const WORKFLOWS_FILE = path.join(DB_DIR, 'workflows.json');
const EXECUTIONS_FILE = path.join(DB_DIR, 'executions.json');

/**
 * Ensure database directory exists
 */
async function ensureDbDir() {
  try {
    await fs.mkdir(DB_DIR, { recursive: true });
  } catch (error) {
    if (error.code !== 'EEXIST') {
      throw error;
    }
  }
}

/**
 * Initialize database files
 */
export async function initDatabase() {
  await ensureDbDir();

  // Initialize workflows file if it doesn't exist
  try {
    await fs.access(WORKFLOWS_FILE);
  } catch {
    await fs.writeFile(WORKFLOWS_FILE, JSON.stringify([], null, 2));
  }

  // Initialize executions file if it doesn't exist
  try {
    await fs.access(EXECUTIONS_FILE);
  } catch {
    await fs.writeFile(EXECUTIONS_FILE, JSON.stringify([], null, 2));
  }

  console.log('✅ Database files initialized');
}

export { WORKFLOWS_FILE, EXECUTIONS_FILE };

