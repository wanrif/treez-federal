import http, { type IncomingMessage } from 'node:http';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import {
  createProxyMiddleware,
  shouldProxyRequest,
} from '../packages/treez-federal/src/server/proxy-middleware';

describe('proxy-middleware', () => {
  let mockRemoteServer: http.Server;
  let remotePort: number;

  beforeAll(async () => {
    mockRemoteServer = http.createServer((req, res) => {
      if (req.url === '/dashboard/assets/test.js') {
        res.writeHead(200, { 'Content-Type': 'application/javascript' });
        res.end('console.log("remote asset loaded");');
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

  it('determines whether requests should be proxied', () => {
    const htmlReq = {
      url: '/dashboard',
      headers: { accept: 'text/html,application/xhtml+xml' },
    } as IncomingMessage;
    expect(shouldProxyRequest(htmlReq, '/dashboard')).toBe(false);

    const assetReq = {
      url: '/dashboard/assets/main.js',
      headers: { accept: '*/*' },
    } as IncomingMessage;
    expect(shouldProxyRequest(assetReq, '/dashboard')).toBe(true);

    const entryReq = {
      url: '/dashboard/zoneEntry.js',
      headers: { accept: 'application/javascript' },
    } as IncomingMessage;
    expect(shouldProxyRequest(entryReq, '/dashboard')).toBe(true);
  });

  it('transparently proxies asset requests to the remote target', async () => {
    const middleware = createProxyMiddleware({
      zones: {
        dashboard: {
          basePath: '/dashboard',
          target: `http://127.0.0.1:${remotePort}`,
        },
      },
    });

    // Test proxying via a local server that uses the middleware:
    const testHostServer = http.createServer((req, res) => {
      middleware(req, res, () => {
        res.writeHead(200, { 'Content-Type': 'text/html' });
        res.end('<h1>Host Shell</h1>');
      });
    });

    await new Promise<void>((resolve) => testHostServer.listen(0, '127.0.0.1', () => resolve()));
    const hostPort = (testHostServer.address() as { port: number }).port;

    try {
      // 1. Asset request should be proxied to mock remote server:
      const assetRes = await fetch(`http://127.0.0.1:${hostPort}/dashboard/assets/test.js`);
      expect(assetRes.status).toBe(200);
      expect(assetRes.headers.get('content-type')).toContain('application/javascript');
      const body = await assetRes.text();
      expect(body).toBe('console.log("remote asset loaded");');

      // 2. HTML navigation should fall through to host shell:
      const htmlRes = await fetch(`http://127.0.0.1:${hostPort}/dashboard`, {
        headers: { Accept: 'text/html' },
      });
      expect(htmlRes.status).toBe(200);
      const htmlBody = await htmlRes.text();
      expect(htmlBody).toBe('<h1>Host Shell</h1>');
    } finally {
      await new Promise<void>((resolve) => testHostServer.close(() => resolve()));
    }
  });

  it('handles remote server unreachable error with 502', async () => {
    const middleware = createProxyMiddleware({
      zones: {
        dashboard: {
          basePath: '/dashboard',
          target: 'http://127.0.0.1:49999', // Non-existent port
        },
      },
    });

    const testHostServer = http.createServer((req, res) => {
      middleware(req, res, () => {
        res.writeHead(404);
        res.end();
      });
    });

    await new Promise<void>((resolve) => testHostServer.listen(0, '127.0.0.1', () => resolve()));
    const hostPort = (testHostServer.address() as { port: number }).port;

    try {
      const res = await fetch(`http://127.0.0.1:${hostPort}/dashboard/assets/failed.js`);
      expect(res.status).toBe(502);
      const text = await res.text();
      expect(text).toContain('[treez-federal] Proxy error');
    } finally {
      await new Promise<void>((resolve) => testHostServer.close(() => resolve()));
    }
  });
});
