import { getApp, getApps, initializeApp } from 'firebase/app';
import { validateFirebaseConfig } from '../shared/firebase-config.js';
const projectId = import.meta.env.VITE_FIREBASE_PROJECT_ID;

const config = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || `${projectId}.firebaseapp.com`,
  projectId,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

const configStatus = validateFirebaseConfig(config, {
  allowLocalDemo: import.meta.env.VITE_ENABLE_DEMO_MODE === 'true',
});
export const firebaseReady = configStatus.ready;
export const firebaseConfigurationError = configStatus.error;
export const firebaseApp = firebaseReady
  ? getApps().length
    ? getApp()
    : initializeApp(config)
  : null;
