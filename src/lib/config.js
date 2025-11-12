/**
 * Application configuration
 */

export const IS_MOCK = false // Backend is now available

// API Configuration
export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000/api'
export const PARSE_APP_ID = import.meta.env.VITE_PARSE_APP_ID || ''
export const PARSE_JS_KEY = import.meta.env.VITE_PARSE_JS_KEY || ''
export const PARSE_SERVER_URL = import.meta.env.VITE_PARSE_SERVER_URL || 'https://parseapi.back4app.com'
export const OPENAI_API_KEY = import.meta.env.VITE_OPENAI_API_KEY || ''

// LocalStorage keys
export const LOCAL_STORAGE_KEYS = {
  DRAFT_WORKFLOWS: 'draftWorkflows',
  LOCALE: 'locale',
  THEME: 'theme',
}

/**
 * Get API configuration based on environment
 */
export function getApiConfig() {
  return {
    baseURL: API_BASE_URL,
    parseAppId: PARSE_APP_ID,
    parseJsKey: PARSE_JS_KEY,
    parseServerURL: PARSE_SERVER_URL,
    isMock: IS_MOCK,
  }
}

/**
 * Check if OpenAI is configured and available
 * @returns {boolean} True if OpenAI API key is set (regardless of mock mode)
 */
export function isOpenAIAvailable() {
  return OPENAI_API_KEY && OPENAI_API_KEY.trim().length > 0
}

