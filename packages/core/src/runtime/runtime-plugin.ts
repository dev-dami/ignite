export interface RuntimePlugin {
  name: string;
  supportedVersions?: string[];
  defaultVersion?: string;
  defaultEntry: string;
  fileExtensions: string[];
  generateDockerfile(version?: string): string;
}

export interface RuntimePluginConfig {
  name: string;
  baseImage: string;
  defaultEntry: string;
  fileExtensions: string[];
  packageManager?: 'npm' | 'yarn' | 'pnpm' | 'bun' | 'none';
  installCommand?: string;
  runCommand: string;
  entrypointExt?: string;
  supportedVersions?: string[];
  defaultVersion?: string;
  customEntrypoint?: string;
}

const ENTRYPOINT_SCRIPT = `const entryFile = process.env.ENTRY_FILE || "index.ts";
const startTime = Date.now();

async function run() {
  try {
    await import("/app/" + entryFile);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}

run().finally(() => {
  const initTime = Date.now() - startTime;
  const mem = Math.round(process.memoryUsage().heapUsed / 1024 / 1024 * 100) / 100;
  process.stderr.write("IGNITE_INIT_TIME:" + initTime + "\\n");
  process.stderr.write("IGNITE_MEMORY_MB:" + mem + "\\n");
});`;

export function createRuntimePlugin(config: RuntimePluginConfig): RuntimePlugin {
  const lockfileMap: Record<string, string> = {
    npm: 'package-lock.json*',
    yarn: 'yarn.lock*',
    pnpm: 'pnpm-lock.yaml*',
    bun: 'bun.lockb*',
    none: '',
  };

  const installCommandMap: Record<string, string> = {
    npm: 'npm ci --omit=dev 2>/dev/null || npm install --omit=dev',
    yarn: 'yarn install --production --frozen-lockfile 2>/dev/null || yarn install --production',
    pnpm: 'pnpm install --prod --frozen-lockfile 2>/dev/null || pnpm install --prod',
    bun: 'bun install --production --frozen-lockfile 2>/dev/null || bun install --production',
    none: 'true',
  };

  const pm = config.packageManager ?? 'bun';
  const lockfile = lockfileMap[pm] ?? '';
  const installCmd = config.installCommand ?? installCommandMap[pm] ?? 'true';
  const ext = config.entrypointExt ?? (pm === 'bun' ? 'ts' : 'mjs');
  const entryScript = config.customEntrypoint ?? ENTRYPOINT_SCRIPT;

  return {
    name: config.name,
    supportedVersions: config.supportedVersions,
    defaultVersion: config.defaultVersion,
    defaultEntry: config.defaultEntry,
    fileExtensions: config.fileExtensions,

    generateDockerfile(version?: string): string {
      let baseImage = config.baseImage;
      if (version) {
        const versionPattern = /:[\w.-]+(-alpine)?$/;
        if (versionPattern.test(baseImage)) {
          const suffix = baseImage.includes('-alpine') ? '-alpine' : '';
          baseImage = baseImage.replace(versionPattern, `:${version}${suffix}`);
        }
      }

      const copyLockfile = lockfile ? `COPY package.json ${lockfile} ./` : 'COPY package.json* ./';
      const installStep = pm !== 'none' 
        ? `RUN if [ -f package.json ]; then ${installCmd}; fi`
        : '';

      return `FROM ${baseImage}

RUN adduser -D -u 1001 ignite

WORKDIR /app

${copyLockfile}
${installStep}

COPY --chown=ignite:ignite . .

ARG ENTRY_FILE=${config.defaultEntry}
ENV ENTRY_FILE=\${ENTRY_FILE}

RUN printf '%s\\n' \\
${entryScript.split('\n').map(line => `  '${line.replace(/'/g, "'\\''")}' \\`).join('\n')}
  > /entrypoint.${ext} && chown ignite:ignite /entrypoint.${ext}

USER ignite

CMD ["${config.runCommand}", "/entrypoint.${ext}"]
`;
    },
  };
}

export const BUN_RUNTIME: RuntimePlugin = createRuntimePlugin({
  name: 'bun',
  baseImage: 'oven/bun:1.3-alpine',
  defaultEntry: 'index.ts',
  fileExtensions: ['.ts', '.js', '.tsx', '.jsx'],
  packageManager: 'bun',
  runCommand: 'bun',
  entrypointExt: 'ts',
  supportedVersions: ['1.0', '1.1', '1.2', '1.3'],
  defaultVersion: '1.3',
});

export const NODE_RUNTIME: RuntimePlugin = createRuntimePlugin({
  name: 'node',
  baseImage: 'node:20-alpine',
  defaultEntry: 'index.js',
  fileExtensions: ['.js', '.mjs', '.cjs'],
  packageManager: 'npm',
  runCommand: 'node',
  entrypointExt: 'mjs',
  supportedVersions: ['18', '20', '22'],
  defaultVersion: '20',
});

export const DENO_RUNTIME: RuntimePlugin = createRuntimePlugin({
  name: 'deno',
  baseImage: 'denoland/deno:alpine-2.0',
  defaultEntry: 'index.ts',
  fileExtensions: ['.ts', '.js', '.tsx', '.jsx'],
  packageManager: 'none',
  runCommand: 'deno run --allow-env --allow-read=/app',
  entrypointExt: 'ts',
  supportedVersions: ['1.40', '1.41', '1.42', '2.0'],
  defaultVersion: '2.0',
});

export const QUICKJS_RUNTIME: RuntimePlugin = {
  name: 'quickjs',
  supportedVersions: ['2024-01-13', '2023-12-09', 'latest'],
  defaultVersion: 'latest',
  defaultEntry: 'index.js',
  fileExtensions: ['.js'],

  generateDockerfile(_version?: string): string {
    return `FROM alpine:3.19 AS builder

RUN apk add --no-cache git make gcc musl-dev

WORKDIR /build
RUN git clone --depth 1 https://github.com/nickg/quickjs.git . && \\
    make qjs && \\
    strip qjs

FROM alpine:3.19

RUN adduser -D -u 1001 ignite

COPY --from=builder /build/qjs /usr/local/bin/qjs

WORKDIR /app

COPY --chown=ignite:ignite . .

ARG ENTRY_FILE=index.js
ENV ENTRY_FILE=\${ENTRY_FILE}

RUN printf '%s\\n' \\
  'const entryFile = std.getenv("ENTRY_FILE") || "index.js";' \\
  'const startTime = Date.now();' \\
  '' \\
  'try {' \\
  '  std.loadScript("/app/" + entryFile);' \\
  '} catch (err) {' \\
  '  console.log("Error:", err);' \\
  '  std.exit(1);' \\
  '}' \\
  '' \\
  'const initTime = Date.now() - startTime;' \\
  'std.err.puts("IGNITE_INIT_TIME:" + initTime + "\\\\n");' \\
  'std.err.puts("IGNITE_MEMORY_MB:0\\\\n");' \\
  > /entrypoint.js && chown ignite:ignite /entrypoint.js

USER ignite

CMD ["qjs", "--std", "/entrypoint.js"]
`;
  },
};

export const BUILTIN_RUNTIMES: Record<string, RuntimePlugin> = {
  bun: BUN_RUNTIME,
  node: NODE_RUNTIME,
  deno: DENO_RUNTIME,
  quickjs: QUICKJS_RUNTIME,
};
