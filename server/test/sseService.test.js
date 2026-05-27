import assert from 'node:assert/strict';
import { once } from 'node:events';
import http from 'node:http';
import test from 'node:test';

import cors from 'cors';
import express from 'express';

import { setupSSEHeaders } from '../services/sseService.js';

function buildCorsOriginOption() {
  const origins = process.env.CORS_ORIGIN?.split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);

  return origins?.length ? origins : true;
}

async function withStreamServer(t) {
  const app = express();

  app.use(cors({
    origin: buildCorsOriginOption(),
    credentials: false,
  }));

  app.get('/stream', setupSSEHeaders, (req, res) => {
    res.end('ok');
  });

  const server = http.createServer(app);
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');

  t.after(() => {
    server.close();
  });

  const address = server.address();
  return `http://127.0.0.1:${address.port}/stream`;
}

test('setupSSEHeaders preserves the matching allowed origin selected by cors()', async (t) => {
  const previousCorsOrigin = process.env.CORS_ORIGIN;
  const previousPublicAppUrl = process.env.PUBLIC_APP_URL;

  process.env.CORS_ORIGIN = 'https://prod.example.com, https://preview.example.com';
  process.env.PUBLIC_APP_URL = 'https://prod.example.com';

  t.after(() => {
    process.env.CORS_ORIGIN = previousCorsOrigin;
    process.env.PUBLIC_APP_URL = previousPublicAppUrl;
  });

  const url = await withStreamServer(t);
  const response = await fetch(url, {
    headers: {
      Origin: 'https://preview.example.com',
    },
  });

  assert.equal(response.headers.get('access-control-allow-origin'), 'https://preview.example.com');

  await response.body?.cancel();
});

test('setupSSEHeaders does not emit a CORS allow-origin header for disallowed origins', async (t) => {
  const previousCorsOrigin = process.env.CORS_ORIGIN;
  const previousPublicAppUrl = process.env.PUBLIC_APP_URL;

  process.env.CORS_ORIGIN = 'https://prod.example.com, https://preview.example.com';
  process.env.PUBLIC_APP_URL = 'https://prod.example.com';

  t.after(() => {
    process.env.CORS_ORIGIN = previousCorsOrigin;
    process.env.PUBLIC_APP_URL = previousPublicAppUrl;
  });

  const url = await withStreamServer(t);
  const response = await fetch(url, {
    headers: {
      Origin: 'https://rogue.example.com',
    },
  });

  assert.equal(response.headers.get('access-control-allow-origin'), null);

  await response.body?.cancel();
});
