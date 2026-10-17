import { createSign } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const FIRESTORE_SCOPE = 'https://www.googleapis.com/auth/datastore';
const OAUTH_TOKEN_URL = 'https://oauth2.googleapis.com/token';
const OAUTH_GRANT_TYPE = 'urn:ietf:params:oauth:grant-type:jwt-bearer';

function encodeJwtPart(value) {
  return Buffer.from(JSON.stringify(value)).toString('base64url');
}

function createServiceAccountAssertion(serviceAccount) {
  const issuedAt = Math.floor(Date.now() / 1000);
  const unsignedToken = [
    encodeJwtPart({ alg: 'RS256', typ: 'JWT' }),
    encodeJwtPart({
      iss: serviceAccount.client_email,
      scope: FIRESTORE_SCOPE,
      aud: OAUTH_TOKEN_URL,
      iat: issuedAt,
      exp: issuedAt + 3600,
    }),
  ].join('.');
  const signer = createSign('RSA-SHA256');
  signer.update(unsignedToken);
  signer.end();
  return `${unsignedToken}.${signer.sign(serviceAccount.private_key).toString('base64url')}`;
}

export async function getAccessToken(serviceAccount) {
  const assertion = createServiceAccountAssertion(serviceAccount);
  const response = await fetch(OAUTH_TOKEN_URL, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: OAUTH_GRANT_TYPE,
      assertion,
    }),
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    const detail = body.error_description || body.error || response.statusText;
    throw new Error(`Google OAuth request failed: ${detail}`);
  }
  if (typeof body.access_token !== 'string' || !body.access_token.trim()) {
    throw new Error('Google OAuth did not return an access token.');
  }
  return body.access_token;
}

export async function firestoreRequest(url, token, { allowNotFound = false, ...options } = {}) {
  const response = await fetch(url, {
    ...options,
    headers: {
      authorization: `Bearer ${token}`,
      ...(options.body ? { 'content-type': 'application/json' } : {}),
      ...options.headers,
    },
  });
  const body = await response.json().catch(() => ({}));
  if (response.status === 404 && allowNotFound) return null;
  if (!response.ok) {
    const detail = body.error?.message || `${response.status} ${response.statusText}`;
    throw new Error(`Firestore request failed: ${detail}`);
  }
  return body;
}

function encodeFields(lead) {
  return Object.fromEntries(
    Object.entries({
      ...lead,
      createdAt: `${lead.createdOn}T00:00:00.000Z`,
      updatedAt: `${lead.createdOn}T00:00:00.000Z`,
    }).map(([key, value]) => [
      key,
      key === 'sourceRow'
        ? { integerValue: String(value) }
        : key === 'createdAt' || key === 'updatedAt'
          ? { timestampValue: value }
          : { stringValue: String(value) },
    ]),
  );
}

function createDocumentId(lead) {
  const safeId = lead.leadId.replace(/[^A-Za-z0-9_-]/g, '_');
  return `legacy-${String(lead.sourceRow).padStart(3, '0')}-${safeId}`;
}

export async function importLeadsToFirestore(leads, { serviceAccountPath, projectId }) {
  if (!serviceAccountPath)
    throw new Error(
      'Set FIREBASE_SERVICE_ACCOUNT_PATH to the downloaded service-account JSON file.',
    );
  const serviceAccount = JSON.parse(await readFile(resolve(serviceAccountPath), 'utf8'));
  const resolvedProjectId = projectId || serviceAccount.project_id;
  if (!resolvedProjectId || !serviceAccount.client_email || !serviceAccount.private_key) {
    throw new Error(
      'The service-account file must contain project_id, client_email, and private_key.',
    );
  }

  const token = await getAccessToken(serviceAccount);
  const root = `https://firestore.googleapis.com/v1/projects/${resolvedProjectId}/databases/(default)/documents`;
  let imported = 0;
  let alreadyPresent = 0;

  for (const lead of leads) {
    const documentId = createDocumentId(lead);
    const indexPath = `mobileIndex/${lead.phone}`;
    const leadPath = `leads/${documentId}`;
    const indexUrl = `${root}/${indexPath}`;
    const existing = await firestoreRequest(indexUrl, token, { allowNotFound: true });

    if (existing) {
      const existingLeadId = existing.fields?.leadId?.stringValue;
      if (existingLeadId === documentId) {
        alreadyPresent += 1;
        continue;
      }
      throw new Error(
        `Mobile ${lead.phone} already belongs to another lead in Firestore; resolve it before importing.`,
      );
    }

    await firestoreRequest(`${root}:commit`, token, {
      method: 'POST',
      body: JSON.stringify({
        writes: [
          {
            update: { name: `${root}/${leadPath}`, fields: encodeFields(lead) },
            currentDocument: { exists: false },
          },
          {
            update: {
              name: `${root}/${indexPath}`,
              fields: { leadId: { stringValue: documentId }, phone: { stringValue: lead.phone } },
            },
            currentDocument: { exists: false },
          },
        ],
      }),
    });
    imported += 1;
  }

  return { imported, alreadyPresent };
}
