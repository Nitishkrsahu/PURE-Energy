import { parse } from 'csv-parse/browser/esm/sync';
import dealerCsv from '../../data/dealers.csv?raw';
import { findDealer as findDealerInDirectory, validateDealerDirectory } from '../shared/dealers.js';

const requiredColumns = ['dealer_id', 'dealer_name', 'city', 'pincode_prefixes'];
const dealerRows = parse(dealerCsv, {
  bom: true,
  columns: (headers) => {
    const normalizedHeaders = headers.map((header) => header.trim());
    const duplicates = normalizedHeaders.filter(
      (header, index) => normalizedHeaders.indexOf(header) !== index,
    );
    if (duplicates.length)
      throw new Error(
        `dealers.csv contains duplicate columns: ${[...new Set(duplicates)].join(', ')}`,
      );
    const missingColumns = requiredColumns.filter((column) => !normalizedHeaders.includes(column));
    if (missingColumns.length)
      throw new Error(`dealers.csv is missing required columns: ${missingColumns.join(', ')}`);
    return normalizedHeaders;
  },
  skip_empty_lines: true,
});

if (dealerRows.length === 0) throw new Error('dealers.csv contains no dealer rows.');

export const DEALERS = validateDealerDirectory(
  dealerRows.map((dealer) => ({
    dealerId: dealer.dealer_id.trim(),
    dealerName: dealer.dealer_name.trim(),
    city: dealer.city.trim(),
    prefixes: dealer.pincode_prefixes.split('|').map((prefix) => prefix.trim()),
  })),
);

export function findDealer(pincode) {
  return findDealerInDirectory(pincode, DEALERS);
}
