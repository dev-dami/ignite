import { describe, it, expect } from '@jest/globals';
import { buildDockerRunArgs } from '../runtime/docker-runtime';

describe('buildDockerRunArgs', () => {
  it('does not include --rm so the container can be inspected after exit', () => {
    const args = buildDockerRunArgs({
      imageName: 'ignite-test',
      containerName: 'ignite-test-container',
      memoryLimitMb: 64,
      timeoutMs: 1000,
      workDir: '/app',
      env: {},
      volumes: [],
    });

    expect(args).not.toContain('--rm');
    expect(args).toContain('run');
    expect(args).toContain('--name');
    expect(args).toContain('ignite-test-container');
  });
});
