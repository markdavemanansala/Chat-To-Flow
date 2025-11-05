import { en } from "./en"
import { tl } from "./tl"
import { vi } from "./vi"

const translations = { en, tl, vi }

/**
 * Get translation function for a specific locale
 * @param {"en" | "tl" | "vi"} locale - The locale to use
 * @returns {function} Translation function that accepts dot-notation keys (e.g., 'nav.templates')
 */
export function getT(locale) {
  const t = translations[locale] || translations.en

  /**
   * Translation function with dot-notation support
   * @param {string} key - Dot-notation key path (e.g., 'nav.templates')
   * @param {any} defaultValue - Optional default value if key not found
   * @returns {string} Translated string
   */
  return (key, defaultValue) => {
    const keys = key.split('.')
    let value = t

    for (const k of keys) {
      if (value && typeof value === 'object' && k in value) {
        value = value[k]
      } else {
        return defaultValue || key
      }
    }

    return value
  }
}

/**
 * Get current locale from localStorage or default to 'en'
 * @returns {"en" | "tl" | "vi"}
 */
export function getCurrentLocale() {
  return localStorage.getItem('locale') || 'en'
}

/**
 * Set locale in localStorage
 * @param {"en" | "tl" | "vi"} locale
 */
export function setLocale(locale) {
  localStorage.setItem('locale', locale)
}

