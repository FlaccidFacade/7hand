// profanity-filter.js - Username and display name profanity filtering
// Implements normalization and validation against slur list

const { SLUR_LIST, OBFUSCATION_PATTERNS } = require('./slur-list');

/**
 * Normalize text for profanity checking
 * - Converts to lowercase
 * - Strips diacritics (accents)
 * - Collapses repeated characters
 * 
 * @param {string} text - Text to normalize
 * @returns {string} Normalized text
 */
function normalizeText(text) {
  if (!text || typeof text !== 'string') {
    return '';
  }

  // Convert to lowercase
  let normalized = text.toLowerCase();

  // Strip diacritics/accents by decomposing and removing combining marks
  // NFD: Canonical decomposition (e.g., é → e + ´)
  // Then remove all combining diacritical marks (Unicode category Mn)
  normalized = normalized.normalize('NFD').replace(/[\u0300-\u036f]/g, '');

  // Collapse repeated characters (e.g., "fuuuuck" → "fuck")
  // Replace 3+ consecutive identical characters with just 2
  // This catches "faaag", "shiiiit", etc. while preserving legitimate doubles like "good"
  normalized = normalized.replace(/(.)\1{2,}/g, '$1$1');

  // Remove common separators that might be used to bypass filters
  // (spaces, dots, dashes, underscores)
  normalized = normalized.replace(/[\s._-]/g, '');

  return normalized;
}

/**
 * Check if text contains profanity
 * Uses both direct matching and regex patterns
 * 
 * @param {string} text - Text to check
 * @returns {boolean} True if profanity detected
 */
function containsProfanity(text) {
  if (!text || typeof text !== 'string') {
    return false;
  }

  const normalized = normalizeText(text);

  // Check against slur list (exact matches within the text)
  for (const slur of SLUR_LIST) {
    if (normalized.includes(slur)) {
      return true;
    }
  }

  // Check against obfuscation patterns
  // Note: We check the original text here to catch 1337 speak
  // that might have been normalized away
  const textWithoutSpaces = text.replace(/[\s._-]/g, '');
  for (const pattern of OBFUSCATION_PATTERNS) {
    if (pattern.test(textWithoutSpaces)) {
      return true;
    }
  }

  return false;
}

/**
 * Validate text against profanity filter
 * Returns a validation result with generic error message
 * 
 * @param {string} text - Text to validate
 * @param {string} fieldName - Name of the field being validated (for error message)
 * @returns {Object} { valid: boolean, error: string|null }
 */
function validateText(text, fieldName = 'Text') {
  if (containsProfanity(text)) {
    // Generic error - don't reveal which slur was detected
    return {
      valid: false,
      error: `${fieldName} contains inappropriate content`
    };
  }

  return {
    valid: true,
    error: null
  };
}

/**
 * Validate username against profanity filter
 * 
 * @param {string} username - Username to validate
 * @returns {Object} { valid: boolean, error: string|null }
 */
function validateUsername(username) {
  return validateText(username, 'Username');
}

/**
 * Validate display name against profanity filter
 * 
 * @param {string} displayName - Display name to validate
 * @returns {Object} { valid: boolean, error: string|null }
 */
function validateDisplayName(displayName) {
  return validateText(displayName, 'Display name');
}

module.exports = {
  normalizeText,
  containsProfanity,
  validateText,
  validateUsername,
  validateDisplayName
};
