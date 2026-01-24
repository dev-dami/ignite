FROM node:20-alpine

WORKDIR /app

COPY package*.json ./
RUN if [ -f package-lock.json ]; then npm ci --only=production; \
    elif [ -f package.json ]; then npm install --only=production; \
    fi

COPY . .

ARG ENTRY_FILE=index.js
ENV ENTRY_FILE=${ENTRY_FILE}

RUN printf '%s\n' \
  'const entryFile = process.env.ENTRY_FILE || "index.js";' \
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
  > /entrypoint.mjs

CMD ["node", "/entrypoint.mjs"]
