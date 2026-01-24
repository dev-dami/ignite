import { isDockerAvailable, getImageInfo } from '@ignite/core';
import { executeService, buildServiceImage, getImageName, resetExecutionState } from '@ignite/core';
import { loadService } from '@ignite/core';
import { join } from 'node:path';

const EXAMPLES_PATH = join(process.cwd(), 'examples');
const HELLO_BUN_PATH = join(EXAMPLES_PATH, 'hello-bun');

describe('Docker Execution', () => {
  let dockerAvailable: boolean;

  beforeAll(async () => {
    dockerAvailable = await isDockerAvailable();
    if (!dockerAvailable) {
      console.warn('Docker is not available. Skipping Docker tests.');
    }
  });

  describe('isDockerAvailable', () => {
    it('returns a boolean indicating Docker availability', async () => {
      const result = await isDockerAvailable();
      expect(typeof result).toBe('boolean');
    });
  });

  describe('given Docker is available', () => {
    beforeEach(function () {
      if (!dockerAvailable) {
        pending('Docker is not available');
      }
    });

    describe('buildServiceImage', () => {
      it('builds the hello-bun service image', async () => {
        if (!dockerAvailable) return;

        const service = await loadService(HELLO_BUN_PATH);
        const imageName = getImageName(service.config.service.name);

        await buildServiceImage(service, imageName);

        const imageInfo = await getImageInfo(imageName);
        expect(imageInfo).not.toBeNull();
        expect(imageInfo?.id).toBeDefined();
      }, 120000);
    });

    describe('executeService', () => {
      it('executes hello-bun service without input', async () => {
        if (!dockerAvailable) return;

        const service = await loadService(HELLO_BUN_PATH);

        const metrics = await executeService(service);

        expect(metrics.exitCode).toBe(0);
        expect(metrics.executionTimeMs).toBeGreaterThan(0);
        expect(metrics.stdout).toContain('Hello');
      }, 120000);

      it('executes hello-bun service with input', async () => {
        if (!dockerAvailable) return;

        const service = await loadService(HELLO_BUN_PATH);

        const metrics = await executeService(service, {
          input: { name: 'Ignite', count: 3 },
        });

        expect(metrics.exitCode).toBe(0);
        expect(metrics.stdout).toContain('Ignite');
      }, 120000);

      it('returns correct cold start detection', async () => {
        if (!dockerAvailable) return;

        const service = await loadService(HELLO_BUN_PATH);
        resetExecutionState(service.config.service.name);

        const firstRun = await executeService(service, { skipBuild: true });
        expect(firstRun.coldStart).toBe(true);

        const secondRun = await executeService(service, { skipBuild: true });
        expect(secondRun.coldStart).toBe(false);
      }, 120000);
    });

    describe('getImageInfo', () => {
      it('returns null for non-existent image', async () => {
        if (!dockerAvailable) return;

        const info = await getImageInfo('ignite-nonexistent:latest');
        expect(info).toBeNull();
      });

      it('returns image info for existing image', async () => {
        if (!dockerAvailable) return;

        const service = await loadService(HELLO_BUN_PATH);
        const imageName = getImageName(service.config.service.name);
        await buildServiceImage(service, imageName);

        const info = await getImageInfo(imageName);

        expect(info).not.toBeNull();
        expect(info?.size).toBeGreaterThan(0);
      }, 120000);
    });
  });
});
