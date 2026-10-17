import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { after, before, test } from 'node:test';
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
} from '@firebase/rules-unit-testing';
import {
  collection,
  doc,
  getDoc,
  serverTimestamp,
  setDoc,
  updateDoc,
  writeBatch,
} from 'firebase/firestore';
import { ACCESS_POLICY } from '../src/shared/lead-options.js';

const projectId = 'demo-purepower';
const mobile = '9876543210';
let testEnvironment;

before(async () => {
  const rules = await readFile(new URL('../firestore.rules', import.meta.url), 'utf8');
  testEnvironment = await initializeTestEnvironment({
    projectId,
    firestore: { rules },
  });
  await testEnvironment.clearFirestore();
  await testEnvironment.withSecurityRulesDisabled(async (context) => {
    await setDoc(doc(context.firestore(), 'leads', 'seed'), { name: 'Seed lead' });
  });
});

after(async () => {
  await testEnvironment?.cleanup();
});

function companyDb() {
  return testEnvironment
    .authenticatedContext('sales-user', {
      email: `sales@${ACCESS_POLICY.allowedDomains[0]}`,
      email_verified: true,
    })
    .firestore();
}

test('denies lead reads to unauthenticated and non-company users', async () => {
  const anonymousDb = testEnvironment.unauthenticatedContext().firestore();
  const outsideCompanyDb = testEnvironment
    .authenticatedContext('external-user', {
      email: 'person@example.com',
      email_verified: true,
    })
    .firestore();

  await assertFails(getDoc(doc(anonymousDb, 'leads', 'seed')));
  await assertFails(getDoc(doc(outsideCompanyDb, 'leads', 'seed')));
});

test('allows a verified company user to read leads', async () => {
  await assertSucceeds(getDoc(doc(companyDb(), 'leads', 'seed')));
});

test('allows the explicitly approved project owner account', async (context) => {
  if (!ACCESS_POLICY.allowedEmails.length) {
    context.skip('No project-specific owner email is configured.');
    return;
  }
  const ownerDb = testEnvironment
    .authenticatedContext('project-owner', {
      email: ACCESS_POLICY.allowedEmails[0],
      email_verified: true,
    })
    .firestore();

  await assertSucceeds(getDoc(doc(ownerDb, 'leads', 'seed')));
});

test('creates a routed lead and unique mobile index atomically', async () => {
  const database = companyDb();
  const leadReference = doc(collection(database, 'leads'), 'test-lead');
  const phoneReference = doc(database, 'mobileIndex', mobile);
  const batch = writeBatch(database);

  batch.set(leadReference, {
    name: 'Test Customer',
    phone: mobile,
    pincode: '502285',
    product: 'PuREPower Home 5kWh',
    source: 'Website',
    dealerId: 'D02',
    dealerName: 'Kandi Energy Point',
    status: 'New',
    createdOn: '2026-10-14',
    sourceType: 'web',
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  batch.set(phoneReference, { leadId: 'test-lead', phone: mobile });
  await assertSucceeds(batch.commit());

  const duplicate = writeBatch(database);
  duplicate.set(doc(collection(database, 'leads'), 'duplicate-lead'), {
    name: 'Duplicate Customer',
    phone: mobile,
    pincode: '502285',
    product: 'PuREPower Home 5kWh',
    source: 'Website',
    dealerId: 'D02',
    dealerName: 'Kandi Energy Point',
    status: 'New',
    createdOn: '2026-10-14',
    sourceType: 'web',
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  duplicate.set(phoneReference, { leadId: 'duplicate-lead', phone: mobile });
  await assertFails(duplicate.commit());
});

test('allows valid status changes and rejects unsupported values', async () => {
  const database = companyDb();
  const leadReference = doc(database, 'leads', 'test-lead');

  await assertSucceeds(
    updateDoc(leadReference, {
      status: 'Converted',
      updatedAt: serverTimestamp(),
    }),
  );
  await assertFails(
    updateDoc(leadReference, {
      status: 'Approved',
      updatedAt: serverTimestamp(),
    }),
  );
  const saved = await getDoc(leadReference);
  assert.equal(saved.data().status, 'Converted');
});

test('rejects invalid Indian pincodes even when they contain six digits', async () => {
  const database = companyDb();
  const batch = writeBatch(database);
  const leadReference = doc(collection(database, 'leads'), 'invalid-pincode');

  batch.set(leadReference, {
    name: 'Invalid Pincode Customer',
    phone: '9876543211',
    pincode: '002285',
    product: 'PuREPower Home 5kWh',
    source: 'Website',
    dealerId: 'INHOUSE',
    dealerName: 'In-house Sales',
    status: 'New',
    createdOn: '2026-10-14',
    sourceType: 'web',
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  batch.set(doc(database, 'mobileIndex', '9876543211'), {
    leadId: 'invalid-pincode',
    phone: '9876543211',
  });

  await assertFails(batch.commit());
});

test('rejects blank customer names even when they contain whitespace', async () => {
  const database = companyDb();
  const batch = writeBatch(database);

  batch.set(doc(database, 'leads', 'blank-name'), {
    name: '   ',
    phone: '9876543212',
    pincode: '502285',
    product: 'PuREPower Home 5kWh',
    source: 'Website',
    dealerId: 'D02',
    dealerName: 'Kandi Energy Point',
    status: 'New',
    createdOn: '2026-10-14',
    sourceType: 'web',
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  batch.set(doc(database, 'mobileIndex', '9876543212'), {
    leadId: 'blank-name',
    phone: '9876543212',
  });

  await assertFails(batch.commit());
});
