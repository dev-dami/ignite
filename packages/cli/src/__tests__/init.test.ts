import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { mkdtemp, rm, mkdir, writeFile, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { initCommand } from '../commands/init';

describe('initCommand', () => {
  let originalCwd: string;
  let sandboxDir: string;

  beforeEach(async () => {
    originalCwd = process.cwd();
    sandboxDir = await mkdtemp(join(tmpdir(), 'ignite-init-'));
    process.chdir(sandboxDir);
  });

  afterEach(async () => {
    process.chdir(originalCwd);
    await rm(sandboxDir, { recursive: true, force: true });
    jest.restoreAllMocks();
  });

  it('creates a new service in an empty target directory', async () => {
    await initCommand('demo-service', {});

    const servicePath = join(sandboxDir, 'demo-service');
    const serviceYaml = await readFile(join(servicePath, 'service.yaml'), 'utf8');
    const packageJson = await readFile(join(servicePath, 'package.json'), 'utf8');

    expect(serviceYaml).toContain('name: demo-service');
    expect(packageJson).toContain('"name": "demo-service"');
  });

  it('refuses to overwrite existing service files', async () => {
    await mkdir(join(sandboxDir, 'demo-service'), { recursive: true });
    const yamlPath = join(sandboxDir, 'demo-service', 'service.yaml');
    await writeFile(yamlPath, 'existing-service-config');

    const exitSpy = jest.spyOn(process, 'exit').mockImplementation((code?: string | number | null) => {
      throw new Error(`process.exit:${code ?? 0}`);
    });

    await expect(initCommand('demo-service', {})).rejects.toThrow('process.exit:1');

    expect(exitSpy).toHaveBeenCalledWith(1);
    await expect(readFile(yamlPath, 'utf8')).resolves.toBe('existing-service-config');
  });
});
