import { join } from 'node:path';

const EXAMPLES_PATH = join(process.cwd(), 'examples');

interface HealthResponse {
  status: string;
  version: string;
  uptime: number;
}

interface ServicesResponse {
  services: string[];
}

interface PreflightResponse {
  serviceName: string;
  preflight: {
    checks: unknown[];
  };
  error?: string;
}

interface ExecuteResponse {
  success: boolean;
  serviceName: string;
  metrics?: {
    exitCode: number;
    stdout: string;
  };
  preflight?: unknown;
  error?: string;
}

describe('HTTP Server', () => {
  let handle: (request: Request) => Promise<Response>;

  beforeAll(async () => {
    const { createServer } = await import('../server.js');
    const server = createServer({
      port: 0,
      host: 'localhost',
      servicesPath: EXAMPLES_PATH,
    });
    handle = server.handle;
  });

  describe('GET /health', () => {
    it('returns health status', async () => {
      const request = new Request('http://localhost/health', { method: 'GET' });
      const response = await handle(request);
      const data = (await response.json()) as HealthResponse;

      expect(response.status).toBe(200);
      expect(data.status).toBe('ok');
      expect(data.version).toBe('0.1.0');
      expect(typeof data.uptime).toBe('number');
    });
  });

  describe('GET /services', () => {
    it('lists available services', async () => {
      const request = new Request('http://localhost/services', { method: 'GET' });
      const response = await handle(request);
      const data = (await response.json()) as ServicesResponse;

      expect(response.status).toBe(200);
      expect(data.services).toContain('hello-bun');
      expect(data.services).toContain('image-resizer');
    });
  });

  describe('GET /services/:serviceName/preflight', () => {
    it('returns preflight results for valid service', async () => {
      const request = new Request('http://localhost/services/hello-bun/preflight', { method: 'GET' });
      const response = await handle(request);
      const data = (await response.json()) as PreflightResponse;

      expect(response.status).toBe(200);
      expect(data.serviceName).toBe('hello-bun');
      expect(data.preflight).toBeDefined();
      expect(data.preflight.checks).toBeDefined();
    }, 120000);

    it('returns error for non-existent service', async () => {
      const request = new Request('http://localhost/services/nonexistent/preflight', { method: 'GET' });
      const response = await handle(request);
      const data = (await response.json()) as PreflightResponse;

      expect(response.status).toBe(500);
      expect(data.error).toBeDefined();
    });
  });

  describe('POST /services/:serviceName/execute', () => {
    it('executes service without input', async () => {
      const request = new Request('http://localhost/services/hello-bun/execute', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
      const response = await handle(request);
      const data = (await response.json()) as ExecuteResponse;

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.serviceName).toBe('hello-bun');
      expect(data.metrics).toBeDefined();
      expect(data.metrics?.exitCode).toBe(0);
    }, 120000);

    it('executes service with input', async () => {
      const request = new Request('http://localhost/services/hello-bun/execute', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ input: { name: 'Elysia' } }),
      });
      const response = await handle(request);
      const data = (await response.json()) as ExecuteResponse;

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.metrics?.stdout).toContain('Elysia');
    }, 120000);

    it('skips preflight when requested', async () => {
      const request = new Request('http://localhost/services/hello-bun/execute', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ skipPreflight: true }),
      });
      const response = await handle(request);
      const data = (await response.json()) as ExecuteResponse;

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.preflight).toBeUndefined();
    }, 120000);

    it('returns error for non-existent service', async () => {
      const request = new Request('http://localhost/services/nonexistent/execute', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
      const response = await handle(request);
      const data = (await response.json()) as ExecuteResponse;

      expect(response.status).toBe(500);
      expect(data.success).toBe(false);
      expect(data.error).toBeDefined();
    });
  });
});
