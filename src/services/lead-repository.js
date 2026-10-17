import { findDealer } from './dealer-directory.js';
import { normalizeLeadStatus, normalizeNewLead } from '../shared/lead-data.js';
import { FALLBACK_DEALER, LEAD_METRICS } from '../shared/lead-options.js';
import { firebaseApp, firebaseReady } from './firebase.js';

const LOCAL_STORAGE_KEY = 'purepower-lead-router-demo-leads';

function getIndiaDate() {
  const parts = new Intl.DateTimeFormat('en', {
    timeZone: 'Asia/Kolkata',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date());
  const values = Object.fromEntries(parts.map(({ type, value }) => [type, value]));
  return `${values.year}-${values.month}-${values.day}`;
}

function readLocalLeads() {
  const stored = localStorage.getItem(LOCAL_STORAGE_KEY);
  if (stored === null) return [];

  let leads;
  try {
    leads = JSON.parse(stored);
  } catch (error) {
    throw new Error(
      'Saved demo leads could not be read. Clear this app’s local storage and try again.',
      { cause: error },
    );
  }
  if (
    !Array.isArray(leads) ||
    leads.some((lead) => !lead || typeof lead !== 'object' || typeof lead.id !== 'string')
  ) {
    throw new Error(
      'Saved demo leads have an invalid format. Clear this app’s local storage and try again.',
    );
  }
  return leads;
}

function writeLocalLeads(leads) {
  localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(leads));
}

export function subscribeToLeads(onData, onError) {
  if (!firebaseReady) {
    try {
      onData(readLocalLeads());
    } catch (error) {
      onError(error);
    }
    return () => {};
  }

  let cancelled = false;
  let unsubscribe;
  import('firebase/firestore')
    .then(({ collection, getFirestore, onSnapshot, orderBy, query }) => {
      if (cancelled) return;
      const firestore = getFirestore(firebaseApp);
      unsubscribe = onSnapshot(
        query(collection(firestore, 'leads'), orderBy('createdAt', 'desc')),
        (snapshot) => onData(snapshot.docs.map((lead) => ({ id: lead.id, ...lead.data() }))),
        onError,
      );
    })
    .catch(onError);

  return () => {
    cancelled = true;
    unsubscribe?.();
  };
}

export async function createLead(values) {
  const normalizedLead = normalizeNewLead(values);
  const dealer = findDealer(normalizedLead.pincode);
  const lead = {
    ...normalizedLead,
    dealerId: dealer?.dealerId ?? FALLBACK_DEALER.dealerId,
    dealerName: dealer?.dealerName ?? FALLBACK_DEALER.dealerName,
    status: LEAD_METRICS.initialStatus,
    createdOn: getIndiaDate(),
    sourceType: 'web',
  };

  if (!firebaseReady) {
    const leads = readLocalLeads();
    if (leads.some((item) => item.phone === lead.phone)) {
      throw new Error('A lead with this mobile number already exists.');
    }
    const saved = { ...lead, id: `demo-${crypto.randomUUID()}`, createdAt: Date.now() };
    writeLocalLeads([saved, ...leads]);
    return saved;
  }

  const { collection, doc, getFirestore, runTransaction, serverTimestamp } =
    await import('firebase/firestore');
  const firestore = getFirestore(firebaseApp);
  const leadReference = doc(collection(firestore, 'leads'));
  const phoneReference = doc(firestore, 'mobileIndex', lead.phone);
  await runTransaction(firestore, async (transaction) => {
    const existingPhone = await transaction.get(phoneReference);
    if (existingPhone.exists()) {
      throw new Error('A lead with this mobile number already exists.');
    }
    transaction.set(leadReference, {
      ...lead,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    transaction.set(phoneReference, { leadId: leadReference.id, phone: lead.phone });
  });
  return { ...lead, id: leadReference.id, createdAt: Date.now() };
}

export async function updateLeadStatus(leadId, status) {
  if (typeof leadId !== 'string' || !leadId.trim()) {
    throw new Error('A valid lead ID is required to update its status.');
  }
  const normalizedStatus = normalizeLeadStatus(status);
  if (!normalizedStatus) throw new Error('Select a valid lead status.');

  if (!firebaseReady) {
    const leads = readLocalLeads();
    if (!leads.some((lead) => lead.id === leadId))
      throw new Error('This lead no longer exists in demo storage.');
    const updatedLeads = leads.map((lead) =>
      lead.id === leadId ? { ...lead, status: normalizedStatus } : lead,
    );
    writeLocalLeads(updatedLeads);
    return;
  }

  const { doc, getFirestore, serverTimestamp, updateDoc } = await import('firebase/firestore');
  await updateDoc(doc(getFirestore(firebaseApp), 'leads', leadId), {
    status: normalizedStatus,
    updatedAt: serverTimestamp(),
  });
}
