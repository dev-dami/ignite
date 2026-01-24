FROM oven/bun:1.3-alpine

RUN adduser -D -u 1001 ignite

WORKDIR /app

COPY package.json bun.lockb* ./
RUN if [ -f package.json ]; then bun install --production --frozen-lockfile 2>/dev/null || bun install --production; fi

COPY --chown=ignite:ignite . .

ARG ENTRY_FILE=index.ts
ENV ENTRY_FILE=${ENTRY_FILE}

RUN printf '%s\n' \
  'const entryFile = process.env.ENTRY_FILE || "index.ts";' \
  'const startTime = Date.now();' \
  '' \
  'async function run() {' \
  '  try {' \
  '    await import("/app/" + entryFile);' \
  '  } catch (err) {' \
  '    console.error(err);' \
  '    process.exit(1);' \
  '  }' \
  '}' \
  '' \
  'run().finally(() => {' \
  '  const initTime = Date.now() - startTime;' \
  '  const mem = Math.round(process.memoryUsage().heapUsed / 1024 / 1024 * 100) / 100;' \
  '  process.stderr.write("IGNITE_INIT_TIME:" + initTime + "\\n");' \
  '  process.stderr.write("IGNITE_MEMORY_MB:" + mem + "\\n");' \
  '});' \
  > /entrypoint.ts && chown ignite:ignite /entrypoint.ts

USER ignite

CMD ["bun", "run", "/entrypoint.ts"]
