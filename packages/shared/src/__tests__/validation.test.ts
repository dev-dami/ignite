import { describe, it, expect } from '@jest/globals';
import { validateDockerName, isValidDockerName, DOCKER_NAME_REGEX } from '../validation.js';

describe('validateDockerName', () => {
  describe('valid names', () => {
    it('accepts single lowercase letter', () => {
      expect(validateDockerName('a')).toEqual({ valid: true });
    });

    it('accepts single digit', () => {
      expect(validateDockerName('1')).toEqual({ valid: true });
    });

    it('accepts lowercase alphanumeric', () => {
      expect(validateDockerName('hello123')).toEqual({ valid: true });
    });

    it('accepts hyphens in middle', () => {
      expect(validateDockerName('hello-world')).toEqual({ valid: true });
    });

    it('accepts multiple hyphens', () => {
      expect(validateDockerName('my-cool-service')).toEqual({ valid: true });
    });

    it('accepts 63 character name', () => {
      const name = 'a'.repeat(63);
      expect(validateDockerName(name)).toEqual({ valid: true });
    });
  });

  describe('invalid names', () => {
    it('rejects empty string', () => {
      const result = validateDockerName('');
      expect(result.valid).toBe(false);
      expect(result.error).toContain('required');
    });

    it('rejects null/undefined', () => {
      expect(validateDockerName(null as unknown as string).valid).toBe(false);
      expect(validateDockerName(undefined as unknown as string).valid).toBe(false);
    });

    it('rejects uppercase letters', () => {
      const result = validateDockerName('HelloWorld');
      expect(result.valid).toBe(false);
    });

    it('rejects leading hyphen', () => {
      const result = validateDockerName('-hello');
      expect(result.valid).toBe(false);
    });

    it('rejects trailing hyphen', () => {
      const result = validateDockerName('hello-');
      expect(result.valid).toBe(false);
    });

    it('rejects underscores', () => {
      const result = validateDockerName('hello_world');
      expect(result.valid).toBe(false);
    });

    it('rejects spaces', () => {
      const result = validateDockerName('hello world');
      expect(result.valid).toBe(false);
    });

    it('rejects 64+ character name', () => {
      const name = 'a'.repeat(64);
      expect(validateDockerName(name).valid).toBe(false);
    });
  });

  describe('path traversal prevention', () => {
    it('rejects double dots', () => {
      const result = validateDockerName('../etc');
      expect(result.valid).toBe(false);
      expect(result.error).toContain('invalid characters');
    });

    it('rejects forward slash', () => {
      const result = validateDockerName('path/to/service');
      expect(result.valid).toBe(false);
      expect(result.error).toContain('invalid characters');
    });

    it('rejects backslash', () => {
      const result = validateDockerName('path\\to\\service');
      expect(result.valid).toBe(false);
      expect(result.error).toContain('invalid characters');
    });

    it('rejects hidden traversal attempts', () => {
      expect(validateDockerName('..').valid).toBe(false);
      expect(validateDockerName('a..b').valid).toBe(false);
      expect(validateDockerName('service/..').valid).toBe(false);
    });
  });
});

describe('isValidDockerName', () => {
  it('returns true for valid names', () => {
    expect(isValidDockerName('my-service')).toBe(true);
  });

  it('returns false for invalid names', () => {
    expect(isValidDockerName('../exploit')).toBe(false);
  });
});

describe('DOCKER_NAME_REGEX', () => {
  it('matches single char', () => {
    expect(DOCKER_NAME_REGEX.test('a')).toBe(true);
    expect(DOCKER_NAME_REGEX.test('1')).toBe(true);
  });

  it('matches multi-char without hyphens at edges', () => {
    expect(DOCKER_NAME_REGEX.test('ab')).toBe(true);
    expect(DOCKER_NAME_REGEX.test('a-b')).toBe(true);
  });

  it('rejects hyphen at start for multi-char', () => {
    expect(DOCKER_NAME_REGEX.test('-ab')).toBe(false);
  });

  it('rejects hyphen at end for multi-char', () => {
    expect(DOCKER_NAME_REGEX.test('ab-')).toBe(false);
  });
});
