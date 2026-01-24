export interface DockerBuildOptions {
  contextPath: string;
  dockerfilePath: string;
  imageName: string;
  buildArgs?: Record<string, string>;
}

export interface DockerRunOptions {
  imageName: string;
  containerName: string;
  memoryLimitMb: number;
  timeoutMs: number;
  workDir: string;
  volumes: VolumeMount[];
  env: Record<string, string>;
  command?: string[];
}

export interface VolumeMount {
  hostPath: string;
  containerPath: string;
  readonly?: boolean;
}

export interface DockerRunResult {
  exitCode: number;
  stdout: string;
  stderr: string;
  durationMs: number;
  oomKilled: boolean;
}

export interface ImageInfo {
  id: string;
  size: number;
  created: string;
}
