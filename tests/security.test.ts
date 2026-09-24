import http from 'node:http';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { validateZoneEntryUrl } from '../packages/treez-federal/src/host/virtual-loader';
import {
  getSharedContainer,
  getSharedModule,
  hasSharedModule,
  setSharedModule,
} from '../packages/treez-federal/src/runtime/index';
import { createProxyMiddleware } from '../packages/treez-federal/src/server/proxy-middleware';
import { createSharedVirtualModule } from '../packages/treez-federal/src/shared/externals';

describe('Security Audit Verifications', () => {
  describe('Proxy Middleware SSRF & Path Traversal Protections', () => {
    let mockRemoteServer: http.Server;
    let remotePort: number;
    let receivedHeaders: Record<string, string | string[] | undefined> = {};

    beforeAll(async () => {
      mockRemoteServer = http.createServer((req, res) => {
        receivedHeaders = req.headers;
        if (req.url === '/dashboard/assets/test.js') {
          res.writeHead(200, { 'Content-Type': 'application/javascript' });
          res.end('ok');
          return;
        }
        res.writeHead(404);
        res.end('not found');
      });

      await new Promise<void>((resolve) => {
        mockRemoteServer.listen(0, '127.0.0.1', () => {
          const addr = mockRemoteServer.address() as { port: number };
          remotePort = addr.port;
          resolve();
        });
      });
    });

    afterAll(async () => {
      await new Promise<void>((resolve) => {
        mockRemoteServer.close(() => resolve());
      });
    });

    it('rejects protocol-relative URL requests with 400', async () => {
      const middleware = createProxyMiddleware({
        zones: {
          dashboard: {
            basePath: '/dashboard',
            target: `http://127.0.0.1:${remotePort}`,
          },
        },
      });

      const server = http.createServer((req, res) => {
        middleware(req, res, () => {
          res.writeHead(200);
          res.end('fell through');
        });
      });

      await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', () => resolve()));
      const port = (server.address() as { port: number }).port;

      try {
        const client = http.request({
          host: '127.0.0.1',
          port,
          path: '//attacker.com/dashboard/assets/test.js',
          method: 'GET',
        });

        const status = await new Promise<number>((resolve) => {
          client.on('response', (res) => {
            resolve(res.statusCode || 0);
          });
          client.end();
        });

        expect(status).toBe(400);
      } finally {
        await new Promise<void>((resolve) => server.close(() => resolve()));
      }
    });

    it('blocks path traversal attempts with 403', async () => {
      const middleware = createProxyMiddleware({
        zones: {
          dashboard: {
            basePath: '/dashboard',
            target: `http://127.0.0.1:${remotePort}`,
          },
        },
      });

      const server = http.createServer((req, res) => {
        middleware(req, res, () => {
          res.writeHead(200);
          res.end('fallback');
        });
      });

      await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', () => resolve()));
      const port = (server.address() as { port: number }).port;

      try {
        const client = http.request({
          host: '127.0.0.1',
          port,
          path: '/dashboard/assets/%2e%2e/%2e%2e/admin',
          method: 'GET',
        });

        const { statusCode, body } = await new Promise<{ statusCode: number; body: string }>(
          (resolve) => {
            client.on('response', (res) => {
              let data = '';
              res.on('data', (chunk) => {
                data += chunk;
              });
              res.on('end', () => {
                resolve({ statusCode: res.statusCode || 0, body: data });
              });
            });
            client.end();
          },
        );

        expect(statusCode).toBe(403);
        expect(body).toContain('Path traversal');
      } finally {
        await new Promise<void>((resolve) => server.close(() => resolve()));
      }
    });

    it('strips hop-by-hop headers from proxied request', async () => {
      const middleware = createProxyMiddleware({
        zones: {
          dashboard: {
            basePath: '/dashboard',
            target: `http://127.0.0.1:${remotePort}`,
          },
        },
      });

      const server = http.createServer((req, res) => {
        middleware(req, res, () => {
          res.writeHead(404);
          res.end();
        });
      });

      await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', () => resolve()));
      const port = (server.address() as { port: number }).port;

      try {
        await fetch(`http://127.0.0.1:${port}/dashboard/assets/test.js`, {
          headers: {
            'x-custom-header': 'safe-header',
            'proxy-connection': 'keep-alive',
          },
        });

        expect(receivedHeaders['x-custom-header']).toBe('safe-header');
        expect(receivedHeaders['proxy-connection']).toBeUndefined();
      } finally {
        await new Promise<void>((resolve) => server.close(() => resolve()));
      }
    });
  });

  describe('Shared Container Prototype Pollution Protections', () => {
    it('prevents prototype pollution via __proto__, prototype, and constructor', () => {
      getSharedContainer();

      setSharedModule('__proto__', { polluted: true });
      setSharedModule('constructor', { polluted: true });
      setSharedModule('prototype', { polluted: true });

      expect(hasSharedModule('__proto__')).toBe(false);
      expect(hasSharedModule('constructor')).toBe(false);
      expect(hasSharedModule('prototype')).toBe(false);

      expect(getSharedModule('__proto__')).toBeUndefined();
      expect(getSharedModule('constructor')).toBeUndefined();

      // Check that standard Object.prototype is unpolluted
      const cleanObj: Record<string, unknown> = {};
      expect((cleanObj as any).polluted).toBeUndefined();
    });
  });

  describe('Virtual Loader URL Validation', () => {
    it('accepts safe relative and absolute http/https URLs', () => {
      expect(validateZoneEntryUrl('/dashboard/zoneEntry.js')).toBe('/dashboard/zoneEntry.js');
      expect(validateZoneEntryUrl('http://localhost:3001/dashboard/zoneEntry.js')).toBe(
        'http://localhost:3001/dashboard/zoneEntry.js',
      );
      expect(validateZoneEntryUrl('https://cdn.example.com/zoneEntry.js')).toBe(
        'https://cdn.example.com/zoneEntry.js',
      );
    });

    it('rejects protocol-relative URLs', () => {
      expect(() => validateZoneEntryUrl('//attacker.com/entry.js')).toThrow(
        'protocol-relative URLs are disallowed',
      );
    });

    it('rejects dangerous schemes (javascript:, data:, file:)', () => {
      expect(() => validateZoneEntryUrl('javascript:alert(1)')).toThrow(
        'only http: and https: are allowed',
      );
      expect(() => validateZoneEntryUrl('data:text/javascript,alert(1)')).toThrow(
        'only http: and https: are allowed',
      );
      expect(() => validateZoneEntryUrl('file:///etc/passwd')).toThrow(
        'only http: and https: are allowed',
      );
    });
  });

  describe('Shared Virtual Module Code Generation Safety', () => {
    it('filters out invalid identifiers and reserved keywords', () => {
      const code = createSharedVirtualModule('my-pkg', [
        'validExport',
        'another_1',
        'invalid-export',
        'delete',
        'class',
        'import',
        'alert(1)',
      ]);

      expect(code).toContain('export const validExport');
      expect(code).toContain('export const another_1');
      expect(code).not.toContain('export const invalid-export');
      expect(code).not.toContain('export const delete');
      expect(code).not.toContain('export const class');
      expect(code).not.toContain('alert(1)');
    });
  });
});
