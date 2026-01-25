import { spawn } from 'node:child_process';
import { RuntimeError, logger } from '@ignite/shared';
import type {
  DockerBuildOptions,
  DockerRunOptions,
  DockerRunResult,
  ImageInfo,
} from './runtime.types.js';

export async function dockerBuild(options: DockerBuildOptions): Promise<void> {
  const args = [
    'build',
    '-t',
    options.imageName,
    '-f',
    options.dockerfilePath,
  ];

  if (options.buildArgs) {
    for (const [key, value] of Object.entries(options.buildArgs)) {
      args.push('--build-arg', `${key}=${value}`);
    }
  }

  args.push(options.contextPath);

  logger.debug(`Running: docker ${args.join(' ')}`);

  const result = await execDocker(args);

  if (result.exitCode !== 0) {
    throw new RuntimeError(`Docker build failed: ${result.stderr}`);
  }
}

export async function dockerRun(options: DockerRunOptions): Promise<DockerRunResult> {
  const args = [
    'run',
    '--rm',
    '--name',
    options.containerName,
    '-m',
    `${options.memoryLimitMb}m`,
    '--memory-swap',
    `${options.memoryLimitMb}m`,
    '--cpus',
    `${options.cpuLimit ?? 1}`,
    '-w',
    options.workDir,
  ];

  if (options.security) {
    if (options.security.networkDisabled) {
      args.push('--network', 'none');
    }
    if (options.security.readOnlyRootfs) {
      args.push('--read-only');
    }
    if (options.security.dropCapabilities) {
      args.push('--cap-drop', 'ALL');
    }
    if (options.security.noNewPrivileges) {
      args.push('--security-opt', 'no-new-privileges');
    }
    if (options.security.tmpfsPaths) {
      for (const tmpfsPath of options.security.tmpfsPaths) {
        args.push('--tmpfs', `${tmpfsPath}:rw,noexec,nosuid,size=64m`);
      }
    }
  }

  for (const volume of options.volumes) {
    const mode = volume.readonly ? 'ro' : 'rw';
    args.push('-v', `${volume.hostPath}:${volume.containerPath}:${mode}`);
  }

  for (const [key, value] of Object.entries(options.env)) {
    args.push('-e', `${key}=${value}`);
  }

  args.push(options.imageName);

  if (options.command) {
    args.push(...options.command);
  }

  logger.debug(`Running: docker ${args.join(' ')}`);

  const startTime = Date.now();
  const result = await execDockerWithTimeout(args, options.timeoutMs);
  const durationMs = Date.now() - startTime;

  const inspectResult = await inspectExitedContainer(options.containerName).catch(() => null);
  
  await removeContainer(options.containerName).catch(() => {});

  return {
    exitCode: result.exitCode,
    stdout: result.stdout,
    stderr: result.stderr,
    durationMs,
    oomKilled: inspectResult?.oomKilled ?? false,
  };
}

export async function getImageInfo(imageName: string): Promise<ImageInfo | null> {
  const args = [
    'image',
    'inspect',
    imageName,
    '--format',
    '{{.Id}}\t{{.Size}}\t{{.Created}}',
  ];

  const result = await execDocker(args);

  if (result.exitCode !== 0) {
    return null;
  }

  const [id, sizeStr, created] = result.stdout.trim().split('\t');
  if (!id || !sizeStr || !created) return null;

  return {
    id,
    size: parseInt(sizeStr, 10),
    created,
  };
}

export async function removeContainer(containerName: string): Promise<void> {
  await execDocker(['rm', '-f', containerName]);
}

export async function isDockerAvailable(): Promise<boolean> {
  const result = await execDocker(['version', '--format', '{{.Server.Version}}']);
  return result.exitCode === 0;
}

async function inspectExitedContainer(
  containerName: string
): Promise<{ oomKilled: boolean } | null> {
  const args = ['inspect', containerName, '--format', '{{.State.OOMKilled}}'];
  const result = await execDocker(args);

  if (result.exitCode !== 0) {
    return null;
  }

  return {
    oomKilled: result.stdout.trim() === 'true',
  };
}

interface ExecResult {
  exitCode: number;
  stdout: string;
  stderr: string;
}

function execDocker(args: string[]): Promise<ExecResult> {
  return new Promise((resolve) => {
    const proc = spawn('docker', args, { stdio: ['ignore', 'pipe', 'pipe'] });

    let stdout = '';
    let stderr = '';

    proc.stdout.on('data', (data: Buffer) => {
      stdout += data.toString();
    });

    proc.stderr.on('data', (data: Buffer) => {
      stderr += data.toString();
    });

    proc.on('close', (code) => {
      resolve({ exitCode: code ?? 1, stdout, stderr });
    });

    proc.on('error', (err) => {
      resolve({ exitCode: 1, stdout, stderr: err.message });
    });
  });
}

function execDockerWithTimeout(args: string[], timeoutMs: number): Promise<ExecResult> {
  return new Promise((resolve) => {
    const proc = spawn('docker', args, { stdio: ['ignore', 'pipe', 'pipe'] });

    let stdout = '';
    let stderr = '';
    let killed = false;

    const timer = setTimeout(() => {
      killed = true;
      proc.kill('SIGKILL');
    }, timeoutMs);

    proc.stdout.on('data', (data: Buffer) => {
      stdout += data.toString();
    });

    proc.stderr.on('data', (data: Buffer) => {
      stderr += data.toString();
    });

    proc.on('close', (code) => {
      clearTimeout(timer);
      if (killed) {
        resolve({ exitCode: 124, stdout, stderr: stderr + '\nProcess killed: timeout exceeded' });
      } else {
        resolve({ exitCode: code ?? 1, stdout, stderr });
      }
    });

    proc.on('error', (err) => {
      clearTimeout(timer);
      resolve({ exitCode: 1, stdout, stderr: err.message });
    });
  });
}
