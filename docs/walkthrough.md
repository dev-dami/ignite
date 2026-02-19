# Walkthrough

This walkthrough builds a realistic service, runs preflight checks, executes it in audit mode, and exposes it through the HTTP API.

## 1) Create Service

```bash
ignite init data-processor
cd data-processor
```

## 2) Implement Logic

Edit `index.ts`:

```ts
interface Input {
  data: number[];
  operation: 'sum' | 'average' | 'max' | 'min';
}

interface Output {
  result: number;
  operation: Input['operation'];
  count: number;
  timestamp: string;
}

const input: Input = JSON.parse(
  process.env.IGNITE_INPUT || '{"data":[],"operation":"sum"}'
);

function calculate(data: number[], operation: Input['operation']): number {
  if (data.length === 0) return 0;

  switch (operation) {
    case 'sum':
      return data.reduce((a, b) => a + b, 0);
    case 'average':
      return data.reduce((a, b) => a + b, 0) / data.length;
    case 'max':
      return Math.max(...data);
    case 'min':
      return Math.min(...data);
  }
}

const output: Output = {
  result: calculate(input.data, input.operation),
  operation: input.operation,
  count: input.data.length,
  timestamp: new Date().toISOString(),
};

console.log(JSON.stringify(output));
```

## 3) Configure Service

Edit `service.yaml`:

```yaml
service:
  name: data-processor
  runtime: bun@1.3
  entry: index.ts
  memoryMb: 128
  cpuLimit: 1
  timeoutMs: 10000
  env:
    NODE_ENV: production
```

## 4) Run Preflight

```bash
ignite preflight .
```

If preflight fails, update config before execution.

## 5) Execute

```bash
ignite run . --input '{"data":[1,2,3,4],"operation":"sum"}'
```

Expected output includes the service JSON payload and execution report.

## 6) Execute With Audit

```bash
ignite run . --audit --input '{"data":[10,20,30],"operation":"average"}'
```

Use this mode for untrusted code paths.

## 7) Generate Report

```bash
ignite report . --json
```

Or save to file:

```bash
ignite report . --json --output report.json
```

## 8) Environment Locking

Create manifest:

```bash
ignite lock .
```

Check for drift:

```bash
ignite lock . --check
```

## 9) Expose Service via HTTP

Run server from parent directory containing services:

```bash
cd ..
ignite serve --services . --port 3000
```

Call execute endpoint:

```bash
curl -X POST http://localhost:3000/services/data-processor/execute \
  -H 'Content-Type: application/json' \
  -d '{"input":{"data":[5,10,15],"operation":"max"},"audit":true}'
```

## 10) Operational Recommendations

- Keep runtime versions pinned in `service.yaml`.
- Prefer `--audit` for user-provided or AI-generated code.
- Set conservative `memoryMb` and `timeoutMs` for each service.
- Keep services single-purpose; split complex workflows.
