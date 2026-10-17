import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

export async function getDefaultProjectId(root) {
  try {
    const config = JSON.parse(await readFile(resolve(root, '.firebaserc'), 'utf8'));
    return config.projects?.default || null;
  } catch (error) {
    if (error.code === 'ENOENT') return null;
    throw new Error(`Unable to read .firebaserc: ${error.message}`, { cause: error });
  }
}
