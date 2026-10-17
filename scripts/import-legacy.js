import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { stringify } from 'csv-stringify/sync';
import { processLegacyRows } from '../src/shared/lead-data.js';
import { parseDealersCsv, parseLegacyLeadsCsv } from './lib/csv.js';
import { getDefaultProjectId } from './lib/firebase-project.js';
import { importLeadsToFirestore } from './lib/firestore-rest.js';

const root = process.cwd();
const leadPath = resolve(root, 'data', 'legacy_leads.csv');
const dealerPath = resolve(root, 'data', 'dealers.csv');
const reportPath = resolve(root, 'reports', 'reconciliation.csv');

async function main() {
  const [leadCsv, dealerCsv] = await Promise.all([
    readFile(leadPath, 'utf8'),
    readFile(dealerPath, 'utf8'),
  ]);
  const rows = parseLegacyLeadsCsv(leadCsv);
  const dealers = parseDealersCsv(dealerCsv);
  const results = processLegacyRows(rows, dealers);
  const summary = Object.fromEntries(
    ['imported', 'fixed', 'merged', 'rejected', 'assigned_inhouse'].map((action) => [
      action,
      results.filter((result) => result.action === action).length,
    ]),
  );

  await mkdir(resolve(root, 'reports'), { recursive: true });
  const report = stringify(
    results.map(({ leadId, action, reason }) => ({ lead_id: leadId, action, reason })),
    {
      header: true,
      columns: ['lead_id', 'action', 'reason'],
    },
  );
  await writeFile(reportPath, report, 'utf8');

  console.log(`Read ${rows.length} rows; wrote ${reportPath}.`);
  console.log(`Reconciliation: ${JSON.stringify(summary)}`);

  if (process.argv.includes('--write-firestore')) {
    const validLeads = results.filter((result) => result.lead).map((result) => result.lead);
    const imported = await importLeadsToFirestore(validLeads, {
      serviceAccountPath: process.env.FIREBASE_SERVICE_ACCOUNT_PATH,
      projectId: process.env.FIREBASE_PROJECT_ID || (await getDefaultProjectId(root)),
    });
    console.log(
      `Firestore import complete: ${imported.imported} added, ${imported.alreadyPresent} already present.`,
    );
  } else {
    console.log(
      'Firestore was not changed. Add --write-firestore after configuring service-account credentials to import valid rows.',
    );
  }
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
