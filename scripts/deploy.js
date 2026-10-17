import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { getDefaultProjectId } from './lib/firebase-project.js';

if (existsSync('.env')) process.loadEnvFile('.env');

const projectId =
  process.env.VITE_FIREBASE_PROJECT_ID || (await getDefaultProjectId(process.cwd()));
delete process.env.FIRESTORE_EMULATOR_HOST;

if (!projectId) {
  console.error(
    'Set VITE_FIREBASE_PROJECT_ID in .env or configure a default project in .firebaserc.',
  );
  process.exitCode = 1;
} else {
  if (!process.env.FIREBASE_HOSTING_UPLOAD_CONCURRENCY) {
    process.env.FIREBASE_HOSTING_UPLOAD_CONCURRENCY = '1';
  }
  const args = ['deploy', '--only', 'firestore:rules,hosting', '--project', projectId];
  const command = process.platform === 'win32' ? 'firebase.cmd' : 'firebase';
  const deploy = spawn(command, args, { shell: process.platform === 'win32', stdio: 'inherit' });

  deploy.on('error', (error) => {
    console.error(`Could not start Firebase CLI: ${error.message}`);
    process.exitCode = 1;
  });
  deploy.on('exit', (code) => {
    process.exitCode = code ?? 1;
  });
}
