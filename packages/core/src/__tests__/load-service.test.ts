import { loadService } from '@ignite/core';
import { join } from 'node:path';

const FIXTURES_PATH = join(process.cwd(), 'examples');

describe('loadService', () => {
  describe('given a valid service directory', () => {
    it('loads the hello-bun service correctly', async () => {
      const servicePath = join(FIXTURES_PATH, 'hello-bun');
      const service = await loadService(servicePath);

      expect(service.config.service.name).toBe('hello-bun');
      expect(service.config.service.runtime).toBe('bun');
      expect(service.config.service.entry).toBe('index.ts');
      expect(service.config.service.memoryMb).toBe(128);
      expect(service.config.service.timeoutMs).toBe(5000);
      expect(service.servicePath).toBe(servicePath);
    });

    it('loads the image-resizer service correctly', async () => {
      const servicePath = join(FIXTURES_PATH, 'image-resizer');
      const service = await loadService(servicePath);

      expect(service.config.service.name).toBe('image-resizer');
      expect(service.config.service.runtime).toBe('node');
    });
  });

  describe('given an invalid service directory', () => {
    it('throws ServiceError for missing service.yaml', async () => {
      const invalidPath = join(FIXTURES_PATH, 'nonexistent');

      await expect(loadService(invalidPath)).rejects.toThrow('Cannot read service.yaml');
    });
  });

  describe('given invalid service configuration', () => {
    it('throws ServiceError for missing required fields', async () => {
      const invalidPath = join(process.cwd(), 'packages/core/src/__tests__/fixtures/invalid-service');
      
      await expect(loadService(invalidPath)).rejects.toThrow();
    });
  });
});
