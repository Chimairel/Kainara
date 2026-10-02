import assert from 'node:assert/strict';
import test from 'node:test';
import http from 'node:http';
import type { AddressInfo } from 'node:net';
import express from 'express';
import type { AuthenticatedRequest } from '../src/types';
import { createLiveStreamHandler } from '../src/lib/live-stream';

test('aborts during asynchronous authentication do not leak slots; live slots stay bounded and reusable', async () => {
  const app = express();
  const stream = createLiveStreamHandler({ lifetimeMs: 5000, heartbeatMs: 1000 });
  let entered!: () => void;
  let completed!: () => void;
  const identify = (req: AuthenticatedRequest) => {
    req.user = { userId: 'live-stream-fixture', email: 'fixture@preview.invalid', role: 'USER' };
  };
  app.get('/late', (req: AuthenticatedRequest, res) => {
    // Model the database authentication result arriving after the socket closed.
    res.once('close', () => {
      identify(req);
      stream(req, res);
      completed();
    });
    entered();
  });
  app.get('/events', (req: AuthenticatedRequest, res) => {
    identify(req);
    stream(req, res);
  });
  const server = app.listen(0, '127.0.0.1');
  await new Promise<void>((resolve) => server.once('listening', resolve));
  const origin = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  const requests: http.ClientRequest[] = [];
  const open = () =>
    new Promise<http.IncomingMessage>((resolve, reject) => {
      const request = http.get(origin + '/events', resolve);
      requests.push(request);
      request.once('error', reject);
    });
  try {
    for (let index = 0; index < 7; index++) {
      const seen = new Promise<void>((resolve) => {
        entered = resolve;
      });
      const done = new Promise<void>((resolve) => {
        completed = resolve;
      });
      const request = http.get(origin + '/late');
      request.on('error', () => {});
      await seen;
      request.destroy();
      await done;
    }
    const active = await Promise.all(Array.from({ length: 5 }, open));
    assert.ok(active.every((response) => response.statusCode === 200));
    const limited = await open();
    assert.equal(limited.statusCode, 429);
    assert.equal(limited.headers['retry-after'], '30');
    limited.resume();
    const ended = new Promise<void>((resolve) => active[0].once('close', resolve));
    active[0].destroy();
    await ended;
    // Server-side close delivery follows the client's socket close.
    await new Promise((resolve) => setTimeout(resolve, 20));
    assert.equal((await open()).statusCode, 200);
  } finally {
    requests.forEach((request) => request.destroy());
    server.closeAllConnections();
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
});

test('normal stream completion releases a slot before the next connection', async () => {
  const app = express();
  const stream = createLiveStreamHandler({ limit: 1, lifetimeMs: 25, heartbeatMs: 1000 });
  app.get('/events', (req: AuthenticatedRequest, res) => {
    req.user = { userId: 'finished-fixture', email: 'fixture@preview.invalid', role: 'USER' };
    stream(req, res);
  });
  const server = app.listen(0, '127.0.0.1');
  await new Promise<void>((resolve) => server.once('listening', resolve));
  try {
    const origin = `http://127.0.0.1:${(server.address() as AddressInfo).port}/events`;
    for (let index = 0; index < 3; index++) {
      const response = await fetch(origin);
      assert.equal(response.status, 200);
      assert.match(await response.text(), /event: connected/);
    }
  } finally {
    server.closeAllConnections();
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
});
