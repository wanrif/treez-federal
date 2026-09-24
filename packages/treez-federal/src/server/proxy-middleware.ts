import type { IncomingMessage, ServerResponse } from 'node:http';

import http from 'node:http';
import https from 'node:https';

import type { MiddlewareHandler, ProxyMiddlewareOptions } from '../types';

import { isZoneAssetRequest, matchZone } from '../host/zone-matcher';

export function shouldProxyRequest(req: IncomingMessage, basePath: string): boolean {
  const url = req.url ? req.url : '';
  if (!url) {
    return false;
  }

  const acceptHeader = req.headers.accept ? req.headers.accept : '';
  const isHtmlNavigation =
    acceptHeader.includes('text/html') &&
    !acceptHeader.includes('application/javascript') &&
    !acceptHeader.includes('application/json');

  if (isHtmlNavigation) {
    return false;
  }

  return isZoneAssetRequest(url, basePath);
}

const HOP_BY_HOP_HEADERS = new Set([
  'connection',
  'keep-alive',
  'proxy-authenticate',
  'proxy-authorization',
  'te',
  'trailer',
  'transfer-encoding',
  'upgrade',
  'proxy-connection',
]);

export function createProxyMiddleware(options: ProxyMiddlewareOptions): MiddlewareHandler {
  return function proxyMiddleware(
    req: IncomingMessage,
    res: ServerResponse,
    next: (err?: unknown) => void,
  ): void {
    const rawUrl = req.url ? req.url : '';
    if (!rawUrl) {
      next();
      return;
    }

    // Prevent protocol-relative URL abuse (e.g. //attacker.com/...)
    if (rawUrl.startsWith('//')) {
      res.statusCode = 400;
      res.setHeader('Content-Type', 'text/plain; charset=utf-8');
      res.end('[treez-federal] Bad Request: Invalid protocol-relative URL');
      return;
    }

    // Path traversal check: decode URL and ensure no dot-dot segment
    let decodedUrl = rawUrl;
    try {
      decodedUrl = decodeURIComponent(rawUrl);
    } catch {
      res.statusCode = 400;
      res.setHeader('Content-Type', 'text/plain; charset=utf-8');
      res.end('[treez-federal] Bad Request: Malformed URI component');
      return;
    }

    if (
      decodedUrl.includes('/../') ||
      decodedUrl.endsWith('/..') ||
      decodedUrl.includes('/..\\') ||
      decodedUrl.includes('\\..\\')
    ) {
      res.statusCode = 403;
      res.setHeader('Content-Type', 'text/plain; charset=utf-8');
      res.end('[treez-federal] Forbidden: Path traversal detected');
      return;
    }

    const match = matchZone(rawUrl, options.zones);
    if (!match || !match.config.target) {
      next();
      return;
    }

    const { zoneName, config } = match;
    const targetString = config.target;
    if (!targetString) {
      next();
      return;
    }

    if (!shouldProxyRequest(req, config.basePath)) {
      next();
      return;
    }

    let targetUrl: URL;
    try {
      // Parse relative to target base URL:
      const targetBase = new URL(targetString);
      targetUrl = new URL(rawUrl, targetBase);

      // Verify origin matches target origin (prevent scheme/host replacement via absolute req.url)
      if (targetUrl.origin !== targetBase.origin) {
        res.statusCode = 403;
        res.setHeader('Content-Type', 'text/plain; charset=utf-8');
        res.end('[treez-federal] Forbidden: Cross-origin proxy target mismatch');
        return;
      }

      // Path traversal check: targetUrl.pathname must stay within normalized zone basePath
      const expectedPrefix = config.basePath.startsWith('/')
        ? config.basePath.replace(/\/+$/, '')
        : '/' + config.basePath.replace(/\/+$/, '');

      if (
        targetUrl.pathname !== expectedPrefix &&
        !targetUrl.pathname.startsWith(expectedPrefix + '/')
      ) {
        res.statusCode = 403;
        res.setHeader('Content-Type', 'text/plain; charset=utf-8');
        res.end('[treez-federal] Forbidden: Path traversal outside zone base path');
        return;
      }
    } catch {
      next();
      return;
    }

    const isHttps = targetUrl.protocol === 'https:';
    const requestFn = isHttps ? https.request : http.request;

    // Filter hop-by-hop headers to prevent smuggling / protocol confusion
    const proxyHeaders: Record<string, string | string[] | undefined> = {};
    for (const [key, value] of Object.entries(req.headers)) {
      const lowerKey = key.toLowerCase();
      if (!HOP_BY_HOP_HEADERS.has(lowerKey)) {
        proxyHeaders[lowerKey] = value;
      }
    }

    proxyHeaders.host = targetUrl.host;
    proxyHeaders['x-forwarded-host'] = req.headers.host;
    proxyHeaders['x-forwarded-proto'] = isHttps ? 'https' : 'http';

    const clientReq = requestFn(
      targetUrl,
      {
        method: req.method,
        headers: proxyHeaders,
        timeout: 30000,
      },
      function handleProxyResponse(proxyRes: IncomingMessage): void {
        const statusCode = proxyRes.statusCode ? proxyRes.statusCode : 200;
        res.writeHead(statusCode, proxyRes.statusMessage, proxyRes.headers);
        proxyRes.pipe(res);
      },
    );

    // Handle client disconnection and socket cleanup
    req.on('aborted', function onReqAborted(): void {
      clientReq.destroy();
    });

    clientReq.on('timeout', function onProxyTimeout(): void {
      clientReq.destroy(new Error('Gateway Timeout'));
    });

    clientReq.on('error', function handleProxyError(err: Error): void {
      if (options.verbose) {
        console.error(
          `[treez-federal] Proxy failed for zone "${zoneName}" (${rawUrl} -> ${targetUrl.toString()}):`,
          err.message,
        );
      }

      if (!res.headersSent) {
        res.statusCode = 502;
        res.setHeader('Content-Type', 'text/plain; charset=utf-8');
        res.end(
          `[treez-federal] Proxy error: Remote zone "${zoneName}" at "${config.target}" unreachable.\n` +
            `Error: ${err.message}`,
        );
      }
    });

    req.pipe(clientReq);
  };
}
