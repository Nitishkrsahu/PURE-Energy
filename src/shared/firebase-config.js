export function validateFirebaseConfig(config, { allowLocalDemo = false } = {}) {
  const missing = ['apiKey', 'projectId', 'appId'].filter(
    (key) => typeof config[key] !== 'string' || !config[key].trim(),
  );
  const hasFirebaseCredentials = Boolean(config.apiKey || config.appId);

  if (!hasFirebaseCredentials && allowLocalDemo) {
    return { ready: false, error: '' };
  }

  return {
    ready: missing.length === 0,
    error: missing.length
      ? hasFirebaseCredentials
        ? 'Firebase configuration is incomplete. Set VITE_FIREBASE_API_KEY and VITE_FIREBASE_APP_ID in .env, and configure the project ID in .env or .firebaserc.'
        : 'Firebase is not configured. Set the required Firebase values, or explicitly enable local demo mode with VITE_ENABLE_DEMO_MODE=true.'
      : '',
  };
}
