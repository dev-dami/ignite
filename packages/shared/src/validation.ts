/**
 * Docker name: lowercase alphanumeric with hyphens, 1-63 chars
 * Single char names allowed, multi-char cannot start/end with hyphen
 */
export const DOCKER_NAME_REGEX = /^[a-z0-9][a-z0-9-]{0,61}[a-z0-9]$|^[a-z0-9]$/;

export interface ValidationResult {
  valid: boolean;
  error?: string;
}

export function validateDockerName(name: string): ValidationResult {
  if (!name || typeof name !== 'string') {
    return { valid: false, error: 'Name is required' };
  }

  if (name.includes('..') || name.includes('/') || name.includes('\\')) {
    return { valid: false, error: 'Name contains invalid characters' };
  }

  if (!DOCKER_NAME_REGEX.test(name)) {
    return { valid: false, error: 'Name must be lowercase alphanumeric with hyphens (1-63 chars)' };
  }

  return { valid: true };
}

export function isValidDockerName(name: string): boolean {
  return validateDockerName(name).valid;
}
