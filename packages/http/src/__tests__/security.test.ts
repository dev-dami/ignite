import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import { join } from 'node:path';
import { isDockerAvailable } from '@ignite/core';

const EXAMPLES_PATH = join(process.cwd(), 'examples');

describe('HTTP Server Security', () => {
  describe('Authentication', () => {
    let handleWithAuth: (request: Request) => Promise<Response>;
    let handleNoAuth: (request: Request) => Promise<Response>;
    let stopWithAuth: () => void;
    let stopNoAuth: () => void;

    beforeAll(async () => {
      const { createServer } = await import('../server.js');
      
      const serverWithAuth = createServer({
        port: 0,
        host: 'localhost',
        servicesPath: EXAMPLES_PATH,
        apiKey: 'test-secret-key',
      });
      handleWithAuth = serverWithAuth.handle;
      stopWithAuth = serverWithAuth.stop;

      const serverNoAuth = createServer({
        port: 0,
        host: 'localhost',
        servicesPath: EXAMPLES_PATH,
      });
      handleNoAuth = serverNoAuth.handle;
      stopNoAuth = serverNoAuth.stop;
    });

    afterAll(() => {
      stopWithAuth?.();
      stopNoAuth?.();
    });

    it('allows health check without auth', async () => {
      const request = new Request('http://localhost/health', { method: 'GET' });
      const response = await handleWithAuth(request);
      expect(response.status).toBe(200);
    });

    it('rejects requests without auth header when apiKey is set', async () => {
      const request = new Request('http://localhost/services', { method: 'GET' });
      const response = await handleWithAuth(request);
      expect(response.status).toBe(401);
      const data = await response.json() as { error?: string };
      expect(data.error).toContain('Unauthorized');
    });

    it('rejects requests with wrong auth token', async () => {
      const request = new Request('http://localhost/services', {
        method: 'GET',
        headers: { 'Authorization': 'Bearer wrong-token' },
      });
      const response = await handleWithAuth(request);
      expect(response.status).toBe(401);
    });

    it('accepts requests with correct auth token', async () => {
      const request = new Request('http://localhost/services', {
        method: 'GET',
        headers: { 'Authorization': 'Bearer test-secret-key' },
      });
      const response = await handleWithAuth(request);
      expect(response.status).toBe(200);
    });

    it('allows all requests when apiKey is not set', async () => {
      const request = new Request('http://localhost/services', { method: 'GET' });
      const response = await handleNoAuth(request);
      expect(response.status).toBe(200);
    });
  });

  describe('Rate Limiting', () => {
    let handle: (request: Request) => Promise<Response>;
    let stop: () => void;

    beforeAll(async () => {
      const { createServer } = await import('../server.js');
      const server = createServer({
        port: 0,
        host: 'localhost',
        servicesPath: EXAMPLES_PATH,
        rateLimit: 3,
        rateLimitWindow: 60000,
      });
      handle = server.handle;
      stop = server.stop;
    });

    afterAll(() => {
      stop?.();
    });

    it('allows requests within rate limit', async () => {
      const request = new Request('http://localhost/services', {
        method: 'GET',
        headers: { 'X-Forwarded-For': 'rate-test-1' },
      });
      
      const response1 = await handle(request);
      expect(response1.status).toBe(200);

      const response2 = await handle(new Request('http://localhost/services', {
        method: 'GET',
        headers: { 'X-Forwarded-For': 'rate-test-1' },
      }));
      expect(response2.status).toBe(200);
    });

    it('blocks requests exceeding rate limit', async () => {
      const makeRequest = () => new Request('http://localhost/services', {
        method: 'GET',
        headers: { 'X-Forwarded-For': 'rate-test-exceed' },
      });

      await handle(makeRequest());
      await handle(makeRequest());
      await handle(makeRequest());
      
      const response = await handle(makeRequest());
      expect(response.status).toBe(429);
      expect(response.headers.get('Retry-After')).toBeDefined();
    });

    it('tracks rate limits per client IP', async () => {
      const request1 = new Request('http://localhost/services', {
        method: 'GET',
        headers: { 'X-Forwarded-For': 'client-a' },
      });
      const request2 = new Request('http://localhost/services', {
        method: 'GET',
        headers: { 'X-Forwarded-For': 'client-b' },
      });

      const responseA = await handle(request1);
      const responseB = await handle(request2);
      
      expect(responseA.status).toBe(200);
      expect(responseB.status).toBe(200);
    });
  });

  describe('Service Name Validation', () => {
    let handle: (request: Request) => Promise<Response>;
    let stop: () => void;
    let dockerAvailable = false;

    beforeAll(async () => {
      dockerAvailable = await isDockerAvailable();
      const { createServer } = await import('../server.js');
      const server = createServer({
        port: 0,
        host: 'localhost',
        servicesPath: EXAMPLES_PATH,
      });
      handle = server.handle;
      stop = server.stop;
    });

    afterAll(() => {
      stop?.();
    });

    it('rejects path traversal attempts with ..', async () => {
      const request = new Request('http://localhost/services/hello..world/execute', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
      const response = await handle(request);
      expect(response.status).toBe(400);
      const data = await response.json() as { error?: string };
      expect(data.error).toContain('invalid');
    });

    it('rejects service names with backslashes', async () => {
      const request = new Request('http://localhost/services/path%5Cto%5Cservice/execute', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
      const response = await handle(request);
      expect(response.status).toBe(400);
    });

    it('rejects uppercase service names', async () => {
      const request = new Request('http://localhost/services/HelloWorld/execute', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
      const response = await handle(request);
      expect(response.status).toBe(400);
    });

    it('accepts valid lowercase service names', async () => {
      if (!dockerAvailable) return;
      const request = new Request('http://localhost/services/hello-bun/preflight', {
        method: 'GET',
      });
      const response = await handle(request);
      expect(response.status).toBe(200);
    }, 120000);
  });
});
