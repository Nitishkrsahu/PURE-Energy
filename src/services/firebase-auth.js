import { firebaseApp, firebaseReady } from './firebase.js';
import { isAllowedLeadDeskEmail } from '../shared/access-policy.js';

export function subscribeToAuth(onUser, onError, onUnauthorized = onError) {
  if (!firebaseReady) return () => {};

  let cancelled = false;
  let unsubscribe;
  import('firebase/auth')
    .then(({ getAuth, onAuthStateChanged, signOut }) => {
      if (cancelled) return;
      const auth = getAuth(firebaseApp);
      unsubscribe = onAuthStateChanged(
        auth,
        (user) => {
          if (!user) {
            onUser(null);
            return;
          }
          const authorized = user.emailVerified && isAllowedLeadDeskEmail(user.email);
          if (user && !authorized) {
            signOut(auth).then(
              () =>
                onUnauthorized(
                  new Error(
                    'Use a verified company account or the approved project-owner account.',
                  ),
                ),
              onError,
            );
            return;
          }
          onUser(user);
        },
        onError,
      );
    })
    .catch(onError);

  return () => {
    cancelled = true;
    unsubscribe?.();
  };
}

export async function signInWithGoogle() {
  const { GoogleAuthProvider, getAuth, signInWithPopup } = await import('firebase/auth');
  const provider = new GoogleAuthProvider();
  return signInWithPopup(getAuth(firebaseApp), provider);
}
