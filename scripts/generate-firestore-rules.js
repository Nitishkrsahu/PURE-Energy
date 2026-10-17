import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { parseDealersCsv } from './lib/csv.js';
import { generateFirestoreRules } from './lib/firestore-rules.js';

const root = process.cwd();
const configPath = resolve(root, 'config', 'lead-options.json');
const templatePath = resolve(root, 'config', 'firestore.rules.template');
const dealerPath = resolve(root, 'data', 'dealers.csv');
const outputPath = resolve(root, 'firestore.rules');

async function main() {
  const [configText, template, dealerCsv] = await Promise.all([
    readFile(configPath, 'utf8'),
    readFile(templatePath, 'utf8'),
    readFile(dealerPath, 'utf8'),
  ]);
  const config = JSON.parse(configText);
  const dealers = parseDealersCsv(dealerCsv);
  const rules = generateFirestoreRules({ template, config, dealers });
  await writeFile(outputPath, rules, 'utf8');
  console.log(`Generated firestore.rules from ${dealers.length} dealers and lead-options.json.`);
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
