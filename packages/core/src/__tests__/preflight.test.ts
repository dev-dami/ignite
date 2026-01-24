import { analyzeMemory, analyzeDependencies } from '../preflight/analyze-memory';
import { analyzeTimeout } from '../preflight/analyze-timeout';
import type { LoadedService } from '../service/service.types';

function createMockService(overrides: Partial<LoadedService> = {}): LoadedService {
  return {
    config: {
      service: {
        name: 'test-service',
        runtime: 'bun',
        entry: 'index.ts',
        memoryMb: 128,
        timeoutMs: 5000,
        ...overrides.config?.service,
      },
    },
    servicePath: '/test/path',
    entryPath: '/test/path/index.ts',
    hasNodeModules: false,
    dependencyCount: 0,
    ...overrides,
  };
}

describe('Preflight Analysis', () => {
  describe('analyzeMemory', () => {
    it('passes when memory exceeds estimated need', () => {
      const service = createMockService({
        config: { service: { name: 'test', runtime: 'bun', entry: 'index.ts', memoryMb: 128, timeoutMs: 5000 } },
        dependencyCount: 10,
      });

      const result = analyzeMemory(service);

      expect(result.status).toBe('pass');
      expect(result.name).toBe('memory-allocation');
    });

    it('warns when memory is close to estimated need', () => {
      const service = createMockService({
        config: { service: { name: 'test', runtime: 'bun', entry: 'index.ts', memoryMb: 55, timeoutMs: 5000 } },
        dependencyCount: 5,
      });

      const result = analyzeMemory(service);

      expect(result.status).toBe('warn');
    });

    it('fails when memory is below 80% of estimated need', () => {
      const service = createMockService({
        config: { service: { name: 'test', runtime: 'bun', entry: 'index.ts', memoryMb: 30, timeoutMs: 5000 } },
        dependencyCount: 10,
      });

      const result = analyzeMemory(service);

      expect(result.status).toBe('fail');
    });
  });

  describe('analyzeDependencies', () => {
    it('passes with low dependency count', () => {
      const service = createMockService({ dependencyCount: 10 });

      const result = analyzeDependencies(service);

      expect(result.status).toBe('pass');
      expect(result.message).toContain('Low dependency count');
    });

    it('passes with moderate dependency count', () => {
      const service = createMockService({ dependencyCount: 60 });

      const result = analyzeDependencies(service);

      expect(result.status).toBe('pass');
      expect(result.message).toContain('Moderate dependency count');
    });

    it('warns with high dependency count', () => {
      const service = createMockService({ dependencyCount: 150 });

      const result = analyzeDependencies(service);

      expect(result.status).toBe('warn');
      expect(result.message).toContain('High dependency count');
    });
  });

  describe('analyzeTimeout', () => {
    it('passes with valid timeout', () => {
      const service = createMockService({
        config: { service: { name: 'test', runtime: 'bun', entry: 'index.ts', memoryMb: 128, timeoutMs: 5000 } },
      });

      const result = analyzeTimeout(service);

      expect(result.status).toBe('pass');
    });

    it('fails when timeout is below minimum', () => {
      const service = createMockService({
        config: { service: { name: 'test', runtime: 'bun', entry: 'index.ts', memoryMb: 128, timeoutMs: 50 } },
      });

      const result = analyzeTimeout(service);

      expect(result.status).toBe('fail');
      expect(result.message).toContain('below minimum');
    });

    it('warns when timeout exceeds maximum', () => {
      const service = createMockService({
        config: { service: { name: 'test', runtime: 'bun', entry: 'index.ts', memoryMb: 128, timeoutMs: 60000 } },
      });

      const result = analyzeTimeout(service);

      expect(result.status).toBe('warn');
      expect(result.message).toContain('exceeds recommended maximum');
    });

    it('warns when timeout is too short based on last execution', () => {
      const service = createMockService({
        config: { service: { name: 'test', runtime: 'bun', entry: 'index.ts', memoryMb: 128, timeoutMs: 1000 } },
      });

      const result = analyzeTimeout(service, 800);

      expect(result.status).toBe('warn');
      expect(result.message).toContain('may be too short');
    });
  });
});
