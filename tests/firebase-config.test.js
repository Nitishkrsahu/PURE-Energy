import assert from 'node:assert/strict';
import test from 'node:test';
import { validateFirebaseConfig } from '../src/shared/firebase-config.js';

test('allows local demo mode only when explicitly enabled without Firebase credentials', () => {
  assert.deepEqual(
    validateFirebaseConfig(
      { apiKey: '', projectId: 'demo-project', appId: '' },
      { allowLocalDemo: true },
    ),
    {
      ready: false,
      error: '',
    },
  );
});

test('rejects unconfigured Firebase instead of silently using local storage', () => {
  const result = validateFirebaseConfig({ apiKey: '', projectId: 'demo-project', appId: '' });

  assert.equal(result.ready, false);
  assert.match(result.error, /VITE_ENABLE_DEMO_MODE=true/);
});

test('reports incomplete Firebase credentials even when local demo mode is enabled', () => {
  const result = validateFirebaseConfig({
    apiKey: 'configured',
    projectId: 'demo-project',
    appId: '',
  });

  assert.equal(result.ready, false);
  assert.match(result.error, /configuration is incomplete/);
});

test('accepts a complete Firebase client configuration', () => {
  assert.deepEqual(
    validateFirebaseConfig({
      apiKey: 'api-key',
      projectId: 'demo-project',
      appId: 'app-id',
    }),
    { ready: true, error: '' },
  );
});
