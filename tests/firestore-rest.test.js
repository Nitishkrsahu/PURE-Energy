import assert from 'node:assert/strict';
import { createVerify, generateKeyPairSync } from 'node:crypto';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import {
  firestoreRequest,
  getAccessToken,
  importLeadsToFirestore,
} from '../scripts/lib/firestore-rest.js';

test('exchanges a signed service-account assertion for an OAuth access token', async () => {
  const { privateKey, publicKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
  const serviceAccount = {
    client_email: 'importer@example.iam.gserviceaccount.com',
    private_key: privateKey.export({ format: 'pem', type: 'pkcs8' }).toString(),
  };
  const originalFetch = globalThis.fetch;
  let requestUrl;
  let requestOptions;
  globalThis.fetch = async (url, options) => {
    requestUrl = url;
    requestOptions = options;
    return new Response(JSON.stringify({ access_token: 'test-access-token' }), { status: 200 });
  };

  try {
    assert.equal(await getAccessToken(serviceAccount), 'test-access-token');
    assert.equal(requestUrl, 'https://oauth2.googleapis.com/token');
    assert.equal(requestOptions.method, 'POST');
    assert.equal(requestOptions.headers['content-type'], 'application/x-www-form-urlencoded');

    const form = new URLSearchParams(requestOptions.body);
    assert.equal(form.get('grant_type'), 'urn:ietf:params:oauth:grant-type:jwt-bearer');
    const [header, payload, signature] = form.get('assertion').split('.');
    const verifier = createVerify('RSA-SHA256');
    verifier.update(`${header}.${payload}`);
    verifier.end();
    assert.equal(verifier.verify(publicKey, Buffer.from(signature, 'base64url')), true);

    const claims = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
    assert.equal(claims.iss, serviceAccount.client_email);
    assert.equal(claims.scope, 'https://www.googleapis.com/auth/datastore');
    assert.equal(claims.aud, 'https://oauth2.googleapis.com/token');
    assert.equal(claims.exp - claims.iat, 3600);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('only mobile-index lookups treat Firestore 404 as an absent document', async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () =>
    new Response(JSON.stringify({ error: { message: 'Document not found' } }), {
      status: 404,
      statusText: 'Not Found',
    });

  try {
    assert.equal(
      await firestoreRequest('https://firestore.test/index', 'token', { allowNotFound: true }),
      null,
    );
    await assert.rejects(
      firestoreRequest('https://firestore.test/commit', 'token', { method: 'POST' }),
      /Firestore request failed: Document not found/,
    );
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('uses Firestore resource names in atomic lead and mobile-index writes', async () => {
  const { privateKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
  const directory = await mkdtemp(join(tmpdir(), 'firestore-rest-'));
  const serviceAccountPath = join(directory, 'service-account.json');
  const originalFetch = globalThis.fetch;
  const commits = [];

  await writeFile(
    serviceAccountPath,
    JSON.stringify({
      client_email: 'importer@example.iam.gserviceaccount.com',
      private_key: privateKey.export({ format: 'pem', type: 'pkcs8' }).toString(),
    }),
  );
  globalThis.fetch = async (url, options = {}) => {
    if (url === 'https://oauth2.googleapis.com/token') {
      return new Response(JSON.stringify({ access_token: 'test-access-token' }), { status: 200 });
    }
    if (url.endsWith(':commit')) {
      commits.push(JSON.parse(options.body));
      return new Response('{}', { status: 200 });
    }
    return new Response(JSON.stringify({ error: { message: 'Document not found' } }), {
      status: 404,
      statusText: 'Not Found',
    });
  };

  try {
    const result = await importLeadsToFirestore(
      [
        {
          leadId: 'L1001',
          sourceRow: 1,
          phone: '9876543210',
          pincode: '502285',
          product: 'PuREPower Home 5kWh',
          source: 'Website',
          dealerId: 'D02',
          dealerName: 'Kandi Energy Point',
          status: 'New',
          createdOn: '2026-10-14',
          sourceType: 'legacy',
        },
      ],
      { serviceAccountPath, projectId: 'test-project' },
    );

    assert.deepEqual(result, { imported: 1, alreadyPresent: 0 });
    assert.equal(commits.length, 1);
    assert.equal(
      commits[0].writes[0].update.name,
      'projects/test-project/databases/(default)/documents/leads/legacy-001-L1001',
    );
    assert.equal(
      commits[0].writes[1].update.name,
      'projects/test-project/databases/(default)/documents/mobileIndex/9876543210',
    );
  } finally {
    globalThis.fetch = originalFetch;
    await rm(directory, { recursive: true, force: true });
  }
});
