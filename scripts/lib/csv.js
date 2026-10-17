import { parse } from 'csv-parse/sync';
import { validateDealerDirectory } from '../../src/shared/dealers.js';

const LEAD_COLUMNS = [
  'lead_id',
  'name',
  'phone',
  'pincode',
  'product',
  'source',
  'created_on',
  'status',
];
const DEALER_COLUMNS = ['dealer_id', 'dealer_name', 'city', 'pincode_prefixes'];

function parseRows(content, fileName, requiredColumns) {
  let rows;
  try {
    rows = parse(content, {
      bom: true,
      columns: (headers) => {
        const normalizedHeaders = headers.map((header) => header.trim());
        const duplicates = normalizedHeaders.filter(
          (header, index) => normalizedHeaders.indexOf(header) !== index,
        );
        if (duplicates.length) {
          throw new Error(
            `${fileName} contains duplicate columns: ${[...new Set(duplicates)].join(', ')}`,
          );
        }
        const missing = requiredColumns.filter((column) => !normalizedHeaders.includes(column));
        if (missing.length) {
          throw new Error(`${fileName} is missing required columns: ${missing.join(', ')}`);
        }
        return normalizedHeaders;
      },
      skip_empty_lines: true,
    });
  } catch (error) {
    if (error.message.startsWith(fileName)) throw error;
    throw new Error(`Unable to parse ${fileName}: ${error.message}`, { cause: error });
  }

  if (rows.length === 0) throw new Error(`${fileName} contains no data rows.`);
  return rows;
}

export function parseLegacyLeadsCsv(content) {
  return parseRows(content, 'legacy_leads.csv', LEAD_COLUMNS);
}

export function parseDealersCsv(content) {
  const dealers = parseRows(content, 'dealers.csv', DEALER_COLUMNS).map((dealer) => ({
    dealerId: dealer.dealer_id.trim(),
    dealerName: dealer.dealer_name.trim(),
    city: dealer.city.trim(),
    prefixes: dealer.pincode_prefixes.split('|').map((prefix) => prefix.trim()),
  }));
  return validateDealerDirectory(dealers);
}
