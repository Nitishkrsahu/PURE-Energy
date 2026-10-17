import { readFileSync } from 'node:fs';
import { defineConfig } from 'vite';
import { loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
  const environment = loadEnv(mode, process.cwd(), 'VITE_');
  const firebaseProject = JSON.parse(readFileSync('.firebaserc', 'utf8'));

  return {
    plugins: [react()],
    define: {
      'import.meta.env.VITE_FIREBASE_PROJECT_ID': JSON.stringify(
        environment.VITE_FIREBASE_PROJECT_ID || firebaseProject.projects?.default || '',
      ),
    },
  };
});
