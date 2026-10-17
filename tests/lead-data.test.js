import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { parse } from 'csv-parse/sync';
import { parseDealersCsv, parseLegacyLeadsCsv } from '../scripts/lib/csv.js';
import { findDealer } from '../src/shared/dealers.js';
import {
  cleanLegacyLead,
  isValidPincode,
  normalizeNewLead,
  normalizePhone,
  processLegacyRows,
} from '../src/shared/lead-data.js';

function readDealers() {
  const source = readFileSync(new URL('../data/dealers.csv', import.meta.url), 'utf8');
  return parseDealersCsv(source);
}

test('normalizes Indian mobile formats and rejects invalid numbers', () => {
  assert.equal(normalizePhone('+91-9000012345'), '9000012345');
  assert.equal(normalizePhone('98480 22 431'), '9848022431');
  assert.equal(normalizePhone('-9876543210-'), null);
  assert.equal(normalizePhone('90000abc123'), null);
  assert.equal(normalizePhone('90+00012345'), null);
  assert.equal(normalizePhone('12345'), null);
  assert.equal(normalizePhone('1234567890'), null);
});

test('accepts only six-digit Indian pincodes that do not start with zero', () => {
  assert.equal(isValidPincode('521137'), true);
  assert.equal(isValidPincode('021137'), false);
  assert.equal(isValidPincode('52113'), false);
});

test('normalizes new lead fields and rejects invalid values at the domain boundary', () => {
  const lead = normalizeNewLead({
    name: '  Test   Lead ',
    phone: '+91 9876543210',
    pincode: '521137',
    product: 'PuREPower Home 3kWh',
    source: 'Website',
  });

  assert.deepEqual(lead, {
    name: 'Test Lead',
    phone: '9876543210',
    pincode: '521137',
    product: 'PuREPower Home 3kWh',
    source: 'Website',
  });
  assert.throws(() => normalizeNewLead({ ...lead, phone: '12345' }), /valid 10-digit mobile/);
  assert.throws(() => normalizeNewLead({ ...lead, pincode: '52113' }), /6-digit Indian pincode/);
  assert.throws(() => normalizeNewLead({ ...lead, pincode: '021137' }), /Indian pincode/);
  assert.throws(() => normalizeNewLead({ ...lead, product: 'Unknown' }), /valid product/);
  assert.throws(() => normalizeNewLead({ ...lead, source: 'Unknown' }), /valid lead source/);
  assert.throws(
    () => normalizeNewLead({ ...lead, name: 'x'.repeat(121) }),
    /120 characters or fewer/,
  );
  assert.throws(
    () => normalizeNewLead({ ...lead, name: 'Ravi\u0000Kumar' }),
    /unsupported characters/,
  );
});

test('routes dealers by the first three pincode digits', () => {
  const dealers = readDealers();
  assert.equal(findDealer('521137', dealers).dealerId, 'D06');
  assert.equal(findDealer('531001', dealers).dealerId, 'D05');
  assert.equal(findDealer('110001', dealers), null);
});

test('dealer source CSV contains all configured dealers and split prefixes', () => {
  const dealers = readDealers();
  assert.equal(dealers.length, 8);
  assert.deepEqual(dealers.find((dealer) => dealer.dealerId === 'D05').prefixes, ['530', '531']);
  assert.deepEqual(dealers.find((dealer) => dealer.dealerId === 'D06').prefixes, ['520', '521']);
});

test('CSV parsers report missing columns, duplicate headers, and empty data clearly', () => {
  assert.throws(
    () => parseLegacyLeadsCsv('lead_id,name\nL1,Ravi'),
    /missing required columns: phone/,
  );
  assert.throws(
    () => parseDealersCsv('dealer_id,dealer_id\nD01,D02'),
    /duplicate columns: dealer_id/,
  );
  assert.throws(() => parseLegacyLeadsCsv(''), /legacy_leads.csv contains no data rows/);
});

test('dealer CSV import does not require unused contact details', () => {
  assert.deepEqual(
    parseDealersCsv('dealer_id,dealer_name,city,pincode_prefixes\nD01,First,City,500'),
    [{ dealerId: 'D01', dealerName: 'First', city: 'City', prefixes: ['500'] }],
  );
});

test('dealer directory rejects duplicate and malformed pincode coverage', () => {
  const header = 'dealer_id,dealer_name,city,pincode_prefixes,contact_email\n';
  assert.throws(
    () =>
      parseDealersCsv(
        `${header}D01,First,City,500,first@example.com\nD02,Second,City,500,second@example.com`,
      ),
    /assigned to both/,
  );
  assert.throws(
    () => parseDealersCsv(`${header}D01,First,City,50,first@example.com`),
    /invalid pincode prefix/,
  );
});

test('normalizes known labels and rejects impossible dates without throwing', () => {
  const row = {
    lead_id: 'L1',
    name: '  Anil  Kumar ',
    phone: '9186523513',
    pincode: '502285',
    product: 'Pure power 5 kwh',
    source: 'WhatsApp',
    created_on: '2026-09-18',
    status: 'converted ',
  };
  const dealers = readDealers();
  const result = cleanLegacyLead(row, 2, dealers);
  assert.equal(result.action, 'fixed');
  assert.equal(result.lead.product, 'PuREPower Home 5kWh');
  assert.equal(result.lead.status, 'Converted');
  assert.equal(
    cleanLegacyLead({ ...row, created_on: '2026-99-99' }, 3, dealers).action,
    'rejected',
  );
  assert.equal(cleanLegacyLead({ ...row, name: 'x'.repeat(121) }, 3, dealers).action, 'rejected');
  assert.equal(
    cleanLegacyLead({ ...row, lead_id: 'L'.repeat(121) }, 3, dealers).action,
    'rejected',
  );
});

test('emits one valid reconciliation action for every provided legacy row', () => {
  const source = readFileSync(new URL('../data/legacy_leads.csv', import.meta.url), 'utf8');
  const rows = parseLegacyLeadsCsv(source);
  const results = processLegacyRows(rows, readDealers());
  const actions = new Set(['imported', 'fixed', 'merged', 'rejected', 'assigned_inhouse']);

  assert.equal(rows.length, 40);
  assert.equal(results.length, rows.length);
  assert.ok(results.every((row) => actions.has(row.action) && typeof row.reason === 'string'));
  assert.ok(results.some((row) => row.action === 'merged'));
  assert.ok(results.some((row) => row.action === 'assigned_inhouse'));
  assert.ok(results.some((row) => row.action === 'rejected'));
});

test('reconciliation output has the required columns and exact row count', () => {
  const report = readFileSync(new URL('../reports/reconciliation.csv', import.meta.url), 'utf8');
  const rows = parse(report, { columns: true, skip_empty_lines: true });
  const counts = Object.fromEntries(
    ['imported', 'fixed', 'merged', 'rejected', 'assigned_inhouse'].map((action) => [
      action,
      rows.filter((row) => row.action === action).length,
    ]),
  );

  assert.deepEqual(Object.keys(rows[0]), ['lead_id', 'action', 'reason']);
  assert.equal(rows.length, 40);
  assert.deepEqual(counts, { imported: 25, fixed: 5, merged: 5, rejected: 4, assigned_inhouse: 1 });
});
