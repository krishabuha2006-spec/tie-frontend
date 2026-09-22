/**
 * Validation utilities for Forms across the application.
 * Enforces:
 *  - 10-digit mobile/phone number validation (numeric only, starts with 6-9)
 *  - Standard RFC email format validation
 */

// Email regex matching standard format: local@domain.tld
export const EMAIL_REGEX = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;

// 10-digit Indian standard mobile regex (starts with 6, 7, 8, 9)
export const MOBILE_10_REGEX = /^[6-9]\d{9}$/;

// Generic 10-digit phone regex (any 10 digits)
export const PHONE_10_REGEX = /^\d{10}$/;

/**
 * Check if an email string is valid.
 */
export const isValidEmail = (email) => {
  if (!email || typeof email !== 'string') return false;
  return EMAIL_REGEX.test(email.trim());
};

/**
 * Check if a phone string is a valid 10-digit mobile number.
 * Accepts numbers with spaces/hyphens/country code (+91) if they resolve to 10 digits.
 */
export const isValidPhone = (phone, strictPrefix = true) => {
  if (!phone) return false;
  let digits = String(phone).replace(/\D/g, '');
  if (digits.length === 12 && digits.startsWith('91')) {
    digits = digits.slice(2);
  } else if (digits.length === 11 && digits.startsWith('0')) {
    digits = digits.slice(1);
  }
  if (digits.length !== 10) return false;
  return strictPrefix ? MOBILE_10_REGEX.test(digits) : PHONE_10_REGEX.test(digits);
};

/**
 * Clean phone to pure 10 digits.
 */
export const cleanPhone10 = (phone) => {
  if (!phone) return '';
  let digits = String(phone).replace(/\D/g, '');
  if (digits.length === 12 && digits.startsWith('91')) {
    digits = digits.slice(2);
  } else if (digits.length === 11 && digits.startsWith('0')) {
    digits = digits.slice(1);
  }
  return digits.slice(0, 10);
};

/**
 * Validate email field and return error string (or null if valid).
 */
export const validateEmail = (email, options = {}) => {
  const { required = true, fieldName = 'Email' } = options;
  const trimmed = String(email || '').trim();

  if (!trimmed) {
    return required ? `${fieldName} is required.` : null;
  }
  if (!isValidEmail(trimmed)) {
    return `Please enter a valid ${fieldName.toLowerCase()} (e.g. user@company.com).`;
  }
  return null;
};

/**
 * Validate phone field and return error string (or null if valid).
 */
export const validatePhone = (phone, options = {}) => {
  const { required = true, fieldName = 'Mobile number', strictPrefix = true } = options;
  const raw = String(phone || '').trim();

  if (!raw) {
    return required ? `${fieldName} is required.` : null;
  }

  let digits = raw.replace(/\D/g, '');
  if (digits.length === 12 && digits.startsWith('91')) {
    digits = digits.slice(2);
  } else if (digits.length === 11 && digits.startsWith('0')) {
    digits = digits.slice(1);
  }

  if (digits.length !== 10) {
    return `${fieldName} must be exactly 10 digits (${digits.length}/10 entered).`;
  }

  if (strictPrefix && !MOBILE_10_REGEX.test(digits)) {
    return `${fieldName} must start with 6, 7, 8, or 9.`;
  }

  return null;
};

export default {
  EMAIL_REGEX,
  MOBILE_10_REGEX,
  PHONE_10_REGEX,
  isValidEmail,
  isValidPhone,
  cleanPhone10,
  validateEmail,
  validatePhone,
};
