import { describe, it, expect, afterEach } from '@jest/globals';
import { getRuntimeConfig, isValidRuntime, getSupportedRuntimes, registerRuntime, unregisterRuntime, getRuntimePlugin } from '../runtime/runtime-registry';
import { createRuntimePlugin } from '../runtime/runtime-plugin';

describe('RuntimeRegistry', () => {
  describe('getRuntimeConfig', () => {
    it('returns correct config for bun runtime', () => {
      const config = getRuntimeConfig('bun');

      expect(config.name).toBe('bun');
      expect(config.dockerfileDir).toBe('runtime-bun');
      expect(config.defaultEntry).toBe('index.ts');
      expect(config.fileExtensions).toEqual(['.ts', '.js', '.tsx', '.jsx']);
      expect(config.version).toBe('1.3');
      expect(config.plugin).toBeDefined();
    });

    it('returns correct config for node runtime', () => {
      const config = getRuntimeConfig('node');

      expect(config.name).toBe('node');
      expect(config.dockerfileDir).toBe('runtime-node');
      expect(config.defaultEntry).toBe('index.js');
      expect(config.version).toBe('20');
    });

    it('returns correct config for quickjs runtime', () => {
      const config = getRuntimeConfig('quickjs');

      expect(config.name).toBe('quickjs');
      expect(config.dockerfileDir).toBe('runtime-quickjs');
      expect(config.defaultEntry).toBe('index.js');
    });

    it('parses versioned runtime string', () => {
      const config = getRuntimeConfig('bun@1.2');

      expect(config.name).toBe('bun');
      expect(config.version).toBe('1.2');
    });

    it('throws for unknown runtime', () => {
      expect(() => getRuntimeConfig('unknown')).toThrow('Unknown runtime: unknown');
    });
  });

  describe('isValidRuntime', () => {
    it('returns true for bun', () => {
      expect(isValidRuntime('bun')).toBe(true);
    });

    it('returns true for node', () => {
      expect(isValidRuntime('node')).toBe(true);
    });

    it('returns true for deno', () => {
      expect(isValidRuntime('deno')).toBe(true);
    });

    it('returns true for quickjs', () => {
      expect(isValidRuntime('quickjs')).toBe(true);
    });

    it('returns true for versioned runtime', () => {
      expect(isValidRuntime('bun@1.3')).toBe(true);
    });

    it('returns false for invalid runtime', () => {
      expect(isValidRuntime('python')).toBe(false);
      expect(isValidRuntime('')).toBe(false);
      expect(isValidRuntime('nodejs')).toBe(false);
    });
  });

  describe('getSupportedRuntimes', () => {
    it('returns all built-in runtimes', () => {
      const runtimes = getSupportedRuntimes();

      expect(runtimes).toContain('bun');
      expect(runtimes).toContain('node');
      expect(runtimes).toContain('deno');
      expect(runtimes).toContain('quickjs');
      expect(runtimes.length).toBeGreaterThanOrEqual(4);
    });
  });

  describe('custom runtime registration', () => {
    const customRuntime = createRuntimePlugin({
      name: 'custom-test',
      baseImage: 'alpine:latest',
      defaultEntry: 'main.js',
      fileExtensions: ['.js'],
      packageManager: 'none',
      runCommand: 'node',
    });

    afterEach(() => {
      unregisterRuntime('custom-test');
    });

    it('allows registering custom runtimes', () => {
      registerRuntime(customRuntime);

      expect(isValidRuntime('custom-test')).toBe(true);
      expect(getSupportedRuntimes()).toContain('custom-test');
    });

    it('allows unregistering custom runtimes', () => {
      registerRuntime(customRuntime);
      expect(isValidRuntime('custom-test')).toBe(true);

      unregisterRuntime('custom-test');
      expect(isValidRuntime('custom-test')).toBe(false);
    });

    it('returns plugin for custom runtime', () => {
      registerRuntime(customRuntime);

      const plugin = getRuntimePlugin('custom-test');
      expect(plugin).toBeDefined();
      expect(plugin?.name).toBe('custom-test');
    });
  });
});
