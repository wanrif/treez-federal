import http, { type IncomingMessage } from 'node:http';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

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

    // Missing accept header
    const noAcceptReq = {
      url: '/dashboard/assets/main.js',
      headers: {},
    } as IncomingMessage;
    expect(shouldProxyRequest(noAcceptReq, '/dashboard')).toBe(true);

    // Accept header with both text/html and application/json
    const jsonReq = {
      url: '/dashboard/assets/data.json',
      headers: { accept: 'text/html,application/json' },
    } as IncomingMessage;
    expect(shouldProxyRequest(jsonReq, '/dashboard')).toBe(true);
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
      verbose: true,
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

  it('tests edge cases and branch coverage in proxy middleware and shouldProxyRequest', async () => {
    // 1. shouldProxyRequest branches:
    expect(shouldProxyRequest({ url: '' } as any, '/dash')).toBe(false);
    expect(
      shouldProxyRequest(
        {
          url: '/dash/assets/app.js',
          headers: { accept: 'text/html, application/json' },
        } as any,
        '/dash',
      ),
    ).toBe(true);

    const middleware = createProxyMiddleware({
      zones: {
        dash: {
          basePath: 'dash', // No leading slash
          target: 'http://127.0.0.1:3000',
        },
        noTarget: {
          basePath: '/notarget',
        },
        badTarget: {
          basePath: '/badtarget',
          target: 'invalid-url-format',
        },
        httpsZone: {
          basePath: '/httpszone',
          target: 'https://127.0.0.1:3443',
        },
      },
    });

    // 2. Empty rawUrl calls next()
    let nextCalled = false;
    middleware({ url: '' } as any, {} as any, () => {
      nextCalled = true;
    });
    expect(nextCalled).toBe(true);

    // 3. Malformed URI component returns 400
    let statusCode = 0;
    let headerSent = '';
    let endBody = '';
    const mockRes1: any = {
      setHeader: (_name: string, val: string) => {
        headerSent = val;
      },
      end: (msg: string) => {
        endBody = msg;
      },
    };
    Object.defineProperty(mockRes1, 'statusCode', {
      set(code) {
        statusCode = code;
      },
    });
    middleware({ url: '/dash/assets/%E0%A4%A' } as any, mockRes1, () => {});
    expect(statusCode).toBe(400);
    expect(headerSent).toBe('text/plain; charset=utf-8');
    expect(endBody).toContain('Malformed URI component');

    // 4. No matching zone calls next()
    nextCalled = false;
    middleware({ url: '/unmatched/assets/app.js' } as any, {} as any, () => {
      nextCalled = true;
    });
    expect(nextCalled).toBe(true);

    // 5. Matching zone without target calls next()
    nextCalled = false;
    middleware({ url: '/notarget/assets/app.js' } as any, {} as any, () => {
      nextCalled = true;
    });
    expect(nextCalled).toBe(true);

    // 6. Matching zone but shouldProxyRequest returns false calls next()
    nextCalled = false;
    middleware({ url: '/dash', headers: { accept: 'text/html' } } as any, {} as any, () => {
      nextCalled = true;
    });
    expect(nextCalled).toBe(true);

    // 7. Cross-origin target mismatch returns 403
    statusCode = 0;
    endBody = '';
    middleware(
      {
        url: 'http://evil.com/dash/assets/app.js',
        headers: { accept: '*/*' },
      } as any,
      mockRes1,
      () => {},
    );
    expect(statusCode).toBe(403);
    expect(endBody).toContain('Cross-origin proxy target mismatch');

    // 8. Path traversal outside base path returns 403
    const prefixMiddleware = createProxyMiddleware({
      zones: {
        dash: {
          basePath: 'dash',
          target: 'http://127.0.0.1:3000/prefix/',
        },
      },
    });
    statusCode = 0;
    endBody = '';
    prefixMiddleware(
      {
        url: 'dash/assets/app.js',
        headers: { accept: '*/*' },
      } as any,
      mockRes1,
      () => {},
    );
    expect(statusCode).toBe(403);
    expect(endBody).toContain('Path traversal outside zone base path');

    // 9. Bad target URL syntax catches error and calls next()
    nextCalled = false;
    middleware(
      {
        url: '/badtarget/assets/app.js',
        headers: { accept: '*/*' },
      } as any,
      {} as any,
      () => {
        nextCalled = true;
      },
    );
    expect(nextCalled).toBe(true);

    // 10. Test abort, timeout, error with headersSent, and status code fallback
    const { EventEmitter } = await import('node:events');
    const https = await import('node:https');
    let responseHandler: any = null;
    let destroyedWith: any = null;
    let activeClientReq: any = new EventEmitter();
    activeClientReq.destroy = (err?: any) => {
      destroyedWith = err ?? true;
    };
    activeClientReq.headers = {};

    const httpsSpy = vi.spyOn(https.default, 'request').mockImplementation(((
      _url: any,
      _opts: any,
      cb: any,
    ) => {
      responseHandler = cb;
      return activeClientReq;
    }) as any);

    const mockReq: any = new EventEmitter();
    mockReq.url = '/httpszone/assets/test.js';
    mockReq.method = 'GET';
    mockReq.headers = { host: 'localhost:3000', accept: '*/*' };
    mockReq.pipe = () => {};

    const mockRes2: any = new EventEmitter();
    mockRes2.headersSent = true;
    mockRes2.setHeader = () => {};
    mockRes2.end = () => {};

    const verboseMiddleware = createProxyMiddleware({
      zones: {
        httpszone: {
          basePath: '/httpszone',
          target: 'https://127.0.0.1:9999',
        },
      },
      verbose: true,
    });

    verboseMiddleware(mockReq, mockRes2, () => {});

    // Abort request
    mockReq.emit('aborted');
    expect(destroyedWith).toBe(true);

    // Timeout request
    activeClientReq.emit('timeout');
    expect(destroyedWith).toBeInstanceOf(Error);
    expect((destroyedWith as Error).message).toBe('Gateway Timeout');

    // Error when headersSent is true
    activeClientReq.emit('error', new Error('mock error'));

    // Test proxy response with missing statusCode (fallback to 200)
    let writtenStatus = 0;
    const mockRes3: any = new EventEmitter();
    mockRes3.writeHead = (status: number) => {
      writtenStatus = status;
    };
    mockRes3.setHeader = () => {};
    mockRes3.end = () => {};

    activeClientReq = new EventEmitter();
    activeClientReq.destroy = () => {};
    activeClientReq.headers = {};

    verboseMiddleware(mockReq, mockRes3, () => {});

    const mockProxyRes: any = new EventEmitter();
    mockProxyRes.statusCode = undefined;
    mockProxyRes.statusMessage = 'OK';
    mockProxyRes.headers = {};
    mockProxyRes.pipe = () => {};

    expect(responseHandler).toBeDefined();
    responseHandler(mockProxyRes);
    expect(writtenStatus).toBe(200);

    // Test non-verbose error branch (options.verbose is false)
    const nonVerboseMiddleware = createProxyMiddleware({
      zones: {
        httpszone: {
          basePath: '/httpszone',
          target: 'https://127.0.0.1:9999',
        },
      },
    });

    activeClientReq = new EventEmitter();
    activeClientReq.destroy = () => {};
    activeClientReq.headers = {};

    const mockRes4: any = new EventEmitter();
    let status502 = 0;
    mockRes4.headersSent = false;
    mockRes4.setHeader = () => {};
    mockRes4.end = () => {};
    Object.defineProperty(mockRes4, 'statusCode', {
      set(code) {
        status502 = code;
      },
    });
    nonVerboseMiddleware(mockReq, mockRes4, () => {});
    activeClientReq.emit('error', new Error('silent error'));
    expect(status502).toBe(502);

    httpsSpy.mockRestore();
  });
});
