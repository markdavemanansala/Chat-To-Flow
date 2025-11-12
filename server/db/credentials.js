/**
 * Credentials database operations
 */

import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DB_DIR = path.join(__dirname, '../data');
const CREDENTIALS_FILE = path.join(DB_DIR, 'credentials.json');

/**
 * Read all credentials
 */
async function readCredentials() {
  try {
    await fs.mkdir(DB_DIR, { recursive: true });
    const data = await fs.readFile(CREDENTIALS_FILE, 'utf-8');
    return JSON.parse(data);
  } catch (error) {
    if (error.code === 'ENOENT') {
      return {};
    }
    console.error('Error reading credentials:', error);
    return {};
  }
}

/**
 * Write credentials
 */
async function writeCredentials(credentials) {
  await fs.mkdir(DB_DIR, { recursive: true });
  await fs.writeFile(CREDENTIALS_FILE, JSON.stringify(credentials, null, 2));
}

/**
 * Get credentials for a provider
 */
export async function getCredentials(providerId) {
  const all = await readCredentials();
  return all[providerId] || null;
}

/**
 * Save credentials for a provider
 */
export async function saveCredentials(providerId, credentials, metadata = {}) {
  const all = await readCredentials();
  
  all[providerId] = {
    providerId,
    credentials,
    ...metadata,
    updatedAt: new Date().toISOString(),
  };

  await writeCredentials(all);
  return all[providerId];
}

/**
 * Delete credentials for a provider
 */
export async function deleteCredentials(providerId) {
  const all = await readCredentials();
  
  if (!all[providerId]) {
    return false;
  }

  delete all[providerId];
  await writeCredentials(all);
  return true;
}

/**
 * Get all credentials (for status endpoint)
 */
export async function getAllCredentials() {
  return await readCredentials();
}

