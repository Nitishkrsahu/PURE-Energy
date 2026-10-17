import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { parseDealersCsv } from '../scripts/lib/csv.js';
import { generateFirestoreRules } from '../scripts/lib/firestore-rules.js';

async function readProjectInputs() {
  const [template, configText, dealerCsv] = await Promise.all([
    readFile(new URL('../config/firestore.rules.template', import.meta.url), 'utf8'),
    readFile(new URL('../config/lead-options.json', import.meta.url), 'utf8'),
    readFile(new URL('../data/dealers.csv', import.meta.url), 'utf8'),
  ]);
  return {
    template,
    config: JSON.parse(configText),
    dealers: parseDealersCsv(dealerCsv),
  };
}

test('committed Firestore rules are generated from current config and dealer CSV', async () => {
  const inputs = await readProjectInputs();
  const generated = generateFirestoreRules(inputs);
  const committed = await readFile(new URL('../firestore.rules', import.meta.url), 'utf8');

  assert.equal(generated, committed);
  assert.match(generated, /email\.matches\('\^\[\^@\]\+@purenergy\\\\\.co\\\\\.in\$'\)/);
  assert.match(generated, /data\.pincode\.matches\('\^521\[0-9\]\{3\}\$'\)/);
});

test('rule generation follows changed catalogs, access policy, fallback, and dealers', async () => {
  const inputs = await readProjectInputs();
  const config = {
    ...inputs.config,
    products: [...inputs.config.products, 'PuREPower Storage 8kWh'],
    sources: [...inputs.config.sources, 'Retail Partner'],
    statuses: [...inputs.config.statuses, 'Qualified'],
    validation: { ...inputs.config.validation, maxNameLength: 80 },
    fallbackDealer: { dealerId: 'HOUSE', dealerName: 'Central Sales' },
    access: { allowedDomains: ['partner.example'], allowedEmails: ['owner@example.com'] },
  };
  const dealers = [
    ...inputs.dealers,
    {
      dealerId: 'D09',
      dealerName: 'New Coverage Partner',
      city: 'Nizamabad',
      prefixes: ['503'],
    },
  ];
  const generated = generateFirestoreRules({ ...inputs, config, dealers });

  assert.match(generated, /PuREPower Storage 8kWh/);
  assert.match(generated, /Retail Partner/);
  assert.match(generated, /Qualified/);
  assert.match(generated, /data\.name\.size\(\) <= 80/);
  assert.match(generated, /New Coverage Partner/);
  assert.match(generated, /503\[0-9\]\{3\}/);
  assert.match(generated, /Central Sales/);
  assert.match(generated, /owner@example\.com/);
  assert.match(generated, /partner\\\\\.example/);
});

test('rule generation rejects conflicting dealer coverage and invalid access policy', async () => {
  const inputs = await readProjectInputs();
  const duplicateCoverage = [
    ...inputs.dealers,
    {
      dealerId: 'D09',
      dealerName: 'Overlapping Partner',
      city: 'Nizamabad',
      prefixes: ['500'],
    },
  ];
  assert.throws(
    () => generateFirestoreRules({ ...inputs, dealers: duplicateCoverage }),
    /assigned to both/,
  );

  const invalidEmail = {
    ...inputs.config,
    access: { allowedDomains: [], allowedEmails: ['not-an-email'] },
  };
  assert.throws(
    () => generateFirestoreRules({ ...inputs, config: invalidEmail }),
    /valid email addresses/,
  );

  const invalidPlantLocation = { ...inputs.config, plantLocation: '   ' };
  assert.throws(
    () => generateFirestoreRules({ ...inputs, config: invalidPlantLocation }),
    /must define plantLocation/,
  );

  const invalidNameLength = {
    ...inputs.config,
    validation: { ...inputs.config.validation, maxNameLength: 0 },
  };
  assert.throws(
    () => generateFirestoreRules({ ...inputs, config: invalidNameLength }),
    /validation\.maxNameLength must be a positive integer/,
  );
});
