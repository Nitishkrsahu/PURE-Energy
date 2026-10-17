import { lazy, Suspense, useEffect, useMemo, useState } from 'react';
import {
  Activity,
  AlertCircle,
  ArrowDownRight,
  ArrowUpRight,
  BatteryCharging,
  Check,
  CircleHelp,
  Plus,
  Sun,
  UsersRound,
} from 'lucide-react';
import LeadForm from './components/LeadForm.jsx';
import LeadTable from './components/LeadTable.jsx';
import { DEALERS } from './services/dealer-directory.js';
import { FALLBACK_DEALER, LEAD_METRICS, PLANT_LOCATION } from './shared/lead-options.js';
import { LEAD_STATUSES } from './shared/lead-data.js';
import { createLead, subscribeToLeads, updateLeadStatus } from './services/lead-repository.js';
import { subscribeToAuth } from './services/firebase-auth.js';
import { firebaseConfigurationError, firebaseReady } from './services/firebase.js';

const SignIn = lazy(() => import('./components/SignIn.jsx'));

function formatToday() {
  return new Intl.DateTimeFormat('en-IN', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(new Date());
}

function DealerAllocation({ leads }) {
  const allocations = useMemo(() => {
    const counts = new Map();
    leads.forEach((lead) => {
      const dealerId = lead.dealerId || FALLBACK_DEALER.dealerId;
      counts.set(dealerId, (counts.get(dealerId) ?? 0) + 1);
    });
    const rows = DEALERS.map((dealer) => ({ ...dealer, count: counts.get(dealer.dealerId) ?? 0 }));
    const inhouse = counts.get(FALLBACK_DEALER.dealerId) ?? 0;
    if (inhouse) rows.push({ ...FALLBACK_DEALER, count: inhouse });
    return rows;
  }, [leads]);
  const highest = Math.max(1, ...allocations.map((dealer) => dealer.count));

  return (
    <section className="dealer-panel" id="dealer-network" aria-labelledby="dealer-panel-title">
      <div className="section-heading compact-heading">
        <div>
          <span className="eyebrow">COVERAGE</span>
          <h2 id="dealer-panel-title">Dealer allocation</h2>
        </div>
        <span className="dealer-total">{DEALERS.length} active</span>
      </div>
      <div className="dealer-list">
        {allocations.map((dealer, index) => (
          <div className="dealer-row" key={dealer.dealerId}>
            <div className="dealer-meta">
              <span className={`dealer-marker marker-${index % 4}`} />
              <span>
                <strong>{dealer.dealerName}</strong>
                <small>{dealer.city}</small>
              </span>
            </div>
            <span className="dealer-count">{dealer.count}</span>
            <div className="allocation-track">
              <span style={{ width: `${(dealer.count / highest) * 100}%` }} />
            </div>
          </div>
        ))}
      </div>
      <a className="text-link" href="#lead-records">
        View all routed leads <ArrowDownRight size={14} />
      </a>
    </section>
  );
}

function StatusSummary({ leads }) {
  const total = leads.length;
  return (
    <section className="status-summary" aria-label="Lead status counts">
      <div className="status-summary-heading">
        <span className="eyebrow">BY STATUS</span>
        <span className="status-summary-total">{total} total</span>
      </div>
      <div className="status-summary-list">
        {LEAD_STATUSES.map((status, index) => {
          const count = leads.filter((lead) => lead.status === status).length;
          const percent = total ? Math.round((count / total) * 100) : 0;
          return (
            <div className="summary-row" key={status}>
              <span className={`summary-dot summary-dot-${index}`} />
              <span className="summary-label">{status}</span>
              <span className="summary-percent">{percent}%</span>
              <strong>{count}</strong>
            </div>
          );
        })}
      </div>
    </section>
  );
}

export default function App() {
  const [leads, setLeads] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [notice, setNotice] = useState(null);
  const [connectionError, setConnectionError] = useState('');
  const [user, setUser] = useState(null);
  const [authLoading, setAuthLoading] = useState(firebaseReady);
  const [authError, setAuthError] = useState('');
  const operatorName = user?.displayName?.trim() || user?.email || 'Demo operator';
  const operatorInitial = operatorName.charAt(0).toUpperCase();

  useEffect(() => {
    if (firebaseConfigurationError) return undefined;
    if (!firebaseReady) return undefined;
    return subscribeToAuth(
      (activeUser) => {
        setUser(activeUser);
        if (activeUser) setAuthError('');
        setAuthLoading(false);
      },
      (error) => {
        setAuthError(error.message || 'Firebase Authentication is unavailable.');
        setAuthLoading(false);
      },
      (error) => {
        setAuthError(error.message);
      },
    );
  }, []);

  useEffect(() => {
    if (firebaseConfigurationError) return undefined;
    if (firebaseReady && !user) return undefined;
    return subscribeToLeads(
      (nextLeads) => {
        setLeads(nextLeads);
        setConnectionError('');
      },
      (error) => setConnectionError(error.message),
    );
  }, [user]);

  const counts = useMemo(
    () =>
      LEAD_STATUSES.reduce((result, status) => {
        result[status] = leads.filter((lead) => lead.status === status).length;
        return result;
      }, {}),
    [leads],
  );
  const needsFirstTouch = LEAD_METRICS.openStatuses.reduce(
    (total, status) => total + (counts[status] ?? 0),
    0,
  );
  const convertedRate = leads.length
    ? Math.round(((counts[LEAD_METRICS.conversionStatus] ?? 0) / leads.length) * 100)
    : 0;

  async function handleCreateLead(values) {
    setSubmitting(true);
    try {
      const lead = await createLead(values);
      setLeads((current) =>
        current.some((item) => item.id === lead.id) ? current : [lead, ...current],
      );
      setNotice({
        type: 'success',
        message: `${lead.name} added${lead.dealerName ? ` and routed to ${lead.dealerName}` : ''}.`,
      });
      setShowForm(false);
    } finally {
      setSubmitting(false);
    }
  }

  async function handleStatusChange(leadId, status) {
    try {
      await updateLeadStatus(leadId, status);
      setLeads((current) =>
        current.map((lead) => (lead.id === leadId ? { ...lead, status } : lead)),
      );
    } catch (error) {
      setNotice({ type: 'error', message: error.message || 'The status could not be updated.' });
    }
  }

  useEffect(() => {
    if (!notice) return undefined;
    const timer = window.setTimeout(() => setNotice(null), 4200);
    return () => window.clearTimeout(timer);
  }, [notice]);

  if (firebaseConfigurationError)
    return (
      <main className="signin-loading" role="alert">
        {firebaseConfigurationError}
      </main>
    );
  if (firebaseReady && authLoading)
    return <main className="signin-loading">Connecting to the dealer network…</main>;
  if (firebaseReady && !user)
    return (
      <Suspense fallback={<main className="signin-loading">Opening secure sign-in…</main>}>
        <SignIn authError={authError} />
      </Suspense>
    );

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <a className="brand" href="#top" aria-label="PuREPower lead desk home">
          <span className="brand-mark">
            <BatteryCharging size={21} strokeWidth={2.2} />
          </span>
          <span>
            <strong>
              PuRE<span>Power</span>
            </strong>
            <small>DEALER NETWORK</small>
          </span>
        </a>

        <div className="workspace-label">WORKSPACE</div>
        <nav className="sidebar-nav" aria-label="Main navigation">
          <a className="nav-item active" href="#top">
            <Activity size={17} />
            <span>Lead desk</span>
            <span className="nav-indicator" />
          </a>
          <a className="nav-item" href="#lead-records">
            <UsersRound size={17} />
            <span>All leads</span>
            <span className="nav-count">{leads.length}</span>
          </a>
          <a className="nav-item" href="#dealer-network">
            <Sun size={17} />
            <span>Dealer network</span>
          </a>
        </nav>

        <div className="sidebar-spacer" />
        <div className="plant-card">
          <span className="plant-icon">
            <Sun size={17} />
          </span>
          <span>
            <small>OPERATIONS BASE</small>
            <strong>{PLANT_LOCATION}</strong>
          </span>
          <span className="plant-status" title="Operations base" />
        </div>
        <div className="sidebar-user">
          <span className="user-avatar">{operatorInitial}</span>
          <span>
            <strong>{operatorName}</strong>
            <small>{firebaseReady ? 'Signed-in operator' : 'Local demo'}</small>
          </span>
          <CircleHelp size={16} />
        </div>
      </aside>

      <main className="main-content" id="top">
        <header className="topbar">
          <div className="breadcrumb">
            <span>Workspace</span>
            <span className="breadcrumb-divider">/</span>
            <strong>Lead desk</strong>
          </div>
          <div className="topbar-right">
            <span className={`connection-pill ${firebaseReady ? 'is-connected' : 'is-demo'}`}>
              <span />
              {firebaseReady ? 'Firestore connected' : 'Demo mode'}
            </span>
            <span className="topbar-date">{formatToday()}</span>
            <span className="topbar-avatar" aria-label={`Signed in as ${operatorName}`}>
              {operatorInitial}
            </span>
          </div>
        </header>

        <div className="page-content">
          <section className="page-heading">
            <div>
              <span className="eyebrow">
                DEALER OPERATIONS <span className="eyebrow-divider">/</span> OVERVIEW
              </span>
              <h1>
                Good work starts <span>with the right lead.</span>
              </h1>
              <p>Every enquiry, routed to the team ready to move it forward.</p>
            </div>
            <button
              className="button button-primary add-lead-button"
              onClick={() => setShowForm(true)}
            >
              <Plus size={17} /> Add a lead
            </button>
          </section>

          {!firebaseReady && (
            <div className="demo-notice">
              <span className="demo-notice-mark">i</span>
              <p>
                <strong>Local demo is active.</strong> Leads are saved in this browser. Add Firebase
                settings in <code>.env</code> to connect Firestore.
              </p>
            </div>
          )}
          {connectionError && (
            <div className="connection-error" role="alert">
              Firestore connection error: {connectionError}
            </div>
          )}

          <section className="metrics-grid" aria-label="Lead overview metrics">
            <article className="metric metric-total">
              <div className="metric-top">
                <span>Total leads</span>
                <span className="metric-icon metric-icon-ink">
                  <UsersRound size={16} />
                </span>
              </div>
              <strong>{leads.length.toLocaleString('en-IN')}</strong>
              <small>All-time pipeline</small>
            </article>
            <article className="metric metric-new">
              <div className="metric-top">
                <span>Needs first touch</span>
                <span className="metric-icon metric-icon-orange">
                  <Activity size={16} />
                </span>
              </div>
              <strong>{needsFirstTouch}</strong>
              <small>
                <i className="metric-trend">
                  <ArrowUpRight size={13} />
                </i>{' '}
                {LEAD_METRICS.openStatuses.join(' + ')}
              </small>
            </article>
            <article className="metric metric-converted">
              <div className="metric-top">
                <span>{LEAD_METRICS.conversionStatus}</span>
                <span className="metric-icon metric-icon-green">
                  <Check size={16} />
                </span>
              </div>
              <strong>{counts[LEAD_METRICS.conversionStatus] ?? 0}</strong>
              <small>Successful hand-offs</small>
            </article>
            <article className="metric metric-rate">
              <div className="metric-top">
                <span>Conversion rate</span>
                <span className="metric-icon metric-icon-yellow">
                  <ArrowUpRight size={16} />
                </span>
              </div>
              <strong>
                {convertedRate}
                <small className="metric-unit">%</small>
              </strong>
              <small>Converted / all leads</small>
            </article>
          </section>

          <div className="dashboard-grid">
            <LeadTable leads={leads} onStatusChange={handleStatusChange} />
            <aside className="overview-aside">
              <StatusSummary leads={leads} />
              <DealerAllocation leads={leads} />
            </aside>
          </div>
          <footer className="page-footer">
            <span>PuREPower · Dealer Lead Router</span>
            <span>
              Built for clear hand-offs <span className="footer-spark">✳</span>
            </span>
          </footer>
        </div>
      </main>

      {showForm && (
        <LeadForm
          onClose={() => setShowForm(false)}
          onSubmit={handleCreateLead}
          submitting={submitting}
        />
      )}
      {notice && (
        <div
          className={`toast toast-${notice.type}`}
          role={notice.type === 'error' ? 'alert' : 'status'}
        >
          {notice.type === 'error' ? <AlertCircle size={16} /> : <Check size={16} />}
          {notice.message}
        </div>
      )}
    </div>
  );
}
