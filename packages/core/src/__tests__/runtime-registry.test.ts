import { getRuntimeConfig, isValidRuntime, getSupportedRuntimes } from '../runtime/runtime-registry';

describe('RuntimeRegistry', () => {
  describe('getRuntimeConfig', () => {
    it('returns correct config for bun runtime', () => {
      const config = getRuntimeConfig('bun');

      expect(config).toEqual({
        name: 'bun',
        dockerfileDir: 'runtime-bun',
        defaultEntry: 'index.ts',
        fileExtensions: ['.ts', '.js', '.tsx', '.jsx'],
      });
    });

    it('returns correct config for node runtime', () => {
      const config = getRuntimeConfig('node');

      expect(config).toEqual({
        name: 'node',
        dockerfileDir: 'runtime-node',
        defaultEntry: 'index.js',
        fileExtensions: ['.js', '.mjs', '.cjs'],
      });
    });
  });

  describe('isValidRuntime', () => {
    it('returns true for bun', () => {
      expect(isValidRuntime('bun')).toBe(true);
    });

    it('returns true for node', () => {
      expect(isValidRuntime('node')).toBe(true);
    });

    it('returns false for invalid runtime', () => {
      expect(isValidRuntime('deno')).toBe(false);
      expect(isValidRuntime('')).toBe(false);
      expect(isValidRuntime('nodejs')).toBe(false);
    });
  });

  describe('getSupportedRuntimes', () => {
    it('returns all supported runtimes', () => {
      const runtimes = getSupportedRuntimes();

      expect(runtimes).toContain('bun');
      expect(runtimes).toContain('node');
      expect(runtimes).toHaveLength(2);
    });
  });
});
