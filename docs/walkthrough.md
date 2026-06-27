# Walkthrough

This walkthrough builds a realistic service, runs preflight checks, executes it in a virtualized microVM sandbox, and exposes it through the HTTP API.

## 1) Create Service

```bash
ignite init data-processor
cd data-processor
```

## 2) Implement Logic

Edit `index.js`:

```js
const input = process.env.IGNITE_INPUT ? JSON.parse(process.env.IGNITE_INPUT) : {"data":[],"operation":"sum"};

function calculate(data, operation) {
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

const output = {
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
  entry: index.js
  memoryMb: 128
  cpuLimit: 1
  timeoutMs: 10000
  env:
    NODE_ENV: production
```

## 4) Run Preflight Checks

Run preflight checks to validate configurations and memory limits:

```bash
ignite preflight .
```

If checks return `FAIL`, optimize the configurations or dependencies before executing the service.

## 5) Execute Sandbox VM

Run the service inside the hardware-isolated microVM:

```bash
ignite run . --input '{"data":[1,2,3,4],"operation":"sum"}'
```

To see trace timings for the formatting of the virtual block device images and KVM launch steps, add the `--verbose` flag:

```bash
ignite run . --input '{"data":[1,2,3,4],"operation":"sum"}' --verbose
```

## 6) Expose Service via HTTP REST API

Run the server pointing to the folder containing the services:

```bash
cd ..
ignite serve --services ./services --port 3000
```

Now, invoke execution from a client using curl:

```bash
curl -X POST http://localhost:3000/services/data-processor/execute \
  -H 'Content-Type: application/json' \
  -d '{"input":{"data":[5,10,15],"operation":"max"}}'
```

---

## 7) Operational Recommendations

- **Pin Versions**: Always keep runtime versions pinned in `service.yaml` (e.g., `bun@1.3`, `node@20`) to guarantee deterministic block mounting on the host.
- **Resource Constraints**: Set conservative `memoryMb` and `timeoutMs` for each service to bound untrusted execution loops.
- **Single Purpose**: Keep services modular; decouple large tasks into separate services.
