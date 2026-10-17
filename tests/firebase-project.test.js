import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { getDefaultProjectId } from '../scripts/lib/firebase-project.js';

test('resolves Firebase project from the repository alias and handles no alias', async () => {
  assert.equal(await getDefaultProjectId(process.cwd()), 'purepower-lead-router-261016');

  const emptyDirectory = await mkdtemp(join(tmpdir(), 'dealer-router-'));
  try {
    assert.equal(await getDefaultProjectId(emptyDirectory), null);
  } finally {
    await rm(emptyDirectory, { recursive: true, force: true });
  }
});
