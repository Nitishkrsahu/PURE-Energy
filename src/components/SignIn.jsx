import { useState } from 'react';
import { BatteryCharging, LockKeyhole } from 'lucide-react';
import { signInWithGoogle } from '../services/firebase-auth.js';
import { ACCESS_POLICY, PLANT_LOCATION } from '../shared/lead-options.js';

const allowedAccounts = [
  ...(ACCESS_POLICY.allowedDomains ?? []).map((domain) => `@${domain}`),
  ...(ACCESS_POLICY.allowedEmails ?? []),
];

export default function SignIn({ authError = '' }) {
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSignIn() {
    setLoading(true);
    setError('');
    try {
      await signInWithGoogle();
    } catch (signInError) {
      setError(signInError.message || 'Sign-in could not be completed.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="signin-screen">
      <section className="signin-panel">
        <a className="brand signin-brand" href="#signin">
          <span className="brand-mark">
            <BatteryCharging size={21} />
          </span>
          <span>
            <strong>
              PuRE<span>Power</span>
            </strong>
            <small>DEALER NETWORK</small>
          </span>
        </a>
        <span className="eyebrow">DEALER OPERATIONS</span>
        <h1>
          One clear view.
          <br />
          <span>Every lead in motion.</span>
        </h1>
        <p>Sign in with a verified Google account: {allowedAccounts.join(' or ')}.</p>
        <button className="google-signin" type="button" onClick={handleSignIn} disabled={loading}>
          <span className="google-g">G</span>
          {loading ? 'Connecting…' : 'Continue with Google'}
        </button>
        {(error || authError) && (
          <p className="signin-error" role="alert">
            {error || authError}
          </p>
        )}
        <span className="signin-protection">
          <LockKeyhole size={13} /> Access is protected by Firebase Authentication
        </span>
      </section>
      <div className="signin-aside">
        <span>PUREPOWER · {PLANT_LOCATION.toUpperCase()}</span>
        <strong>
          Energy stored.
          <br />
          Opportunity routed.
        </strong>
        <i>01 — DEALER LEAD ROUTER</i>
      </div>
    </main>
  );
}
