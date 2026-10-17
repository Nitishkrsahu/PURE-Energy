import { findDealer } from './dealers.js';
import {
  FALLBACK_DEALER,
  LEAD_VALIDATION,
  LEAD_PRODUCTS,
  LEAD_SOURCES,
  LEAD_STATUSES,
  LEGACY_PRODUCT_ALIASES,
} from './lead-options.js';

export { LEAD_PRODUCTS, LEAD_SOURCES, LEAD_STATUSES } from './lead-options.js';

export function normalizePhone(value) {
  const input = String(value ?? '').trim();
  if (!/^\+?\d[\d\s().-]*$/.test(input)) return null;
  let digits = input.replace(/\D/g, '');
  if (digits.length === 12 && digits.startsWith('91')) digits = digits.slice(2);
  return /^[6-9]\d{9}$/.test(digits) ? digits : null;
}

export function normalizeLeadStatus(value) {
  return normalizeChoice(value, LEAD_STATUSES);
}

export function isValidPincode(value) {
  return /^[1-9]\d{5}$/.test(String(value ?? '').trim());
}

function normalizeDate(value) {
  const date = String(value ?? '').trim();
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);
  if (!match) return null;
  const [, year, month, day] = match;
  const parsed = new Date(`${year}-${month}-${day}T00:00:00.000Z`);
  if (!Number.isFinite(parsed.getTime())) return null;
  return parsed.toISOString().slice(0, 10) === date ? date : null;
}

function normalizeProduct(value) {
  const normalizedProduct = String(value ?? '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');
  return (
    LEAD_PRODUCTS.find((product) =>
      [product, ...(LEGACY_PRODUCT_ALIASES[product] ?? [])].some(
        (alias) => alias.toLowerCase().replace(/[^a-z0-9]/g, '') === normalizedProduct,
      ),
    ) ?? null
  );
}

function normalizeChoice(value, choices) {
  const normalized = String(value ?? '')
    .trim()
    .toLowerCase();
  return choices.find((choice) => choice.toLowerCase() === normalized) ?? null;
}

function normalizeName(value) {
  return String(value ?? '')
    .trim()
    .replace(/\s+/g, ' ');
}

export function normalizeNewLead(values) {
  const name = normalizeName(values?.name);
  const phone = normalizePhone(values?.phone);
  const pincode = String(values?.pincode ?? '').trim();
  const product = normalizeChoice(values?.product, LEAD_PRODUCTS);
  const source = normalizeChoice(values?.source, LEAD_SOURCES);

  if (!name) throw new Error('Enter the customer name.');
  if (name.length > LEAD_VALIDATION.maxNameLength) {
    throw new Error(`Customer name must be ${LEAD_VALIDATION.maxNameLength} characters or fewer.`);
  }
  if (/[\u0000-\u001f\u007f]/.test(name))
    throw new Error('Customer name contains unsupported characters.');
  if (!phone) throw new Error('Enter a valid 10-digit mobile number.');
  if (!isValidPincode(pincode)) throw new Error('Enter a valid 6-digit Indian pincode.');
  if (!product) throw new Error('Select a valid product.');
  if (!source) throw new Error('Select a valid lead source.');

  return { name, phone, pincode, product, source };
}

export function cleanLegacyLead(row, lineNumber, dealers) {
  const fixes = [];
  const leadId = String(row.lead_id ?? '').trim();
  const name = normalizeName(row.name);
  const phone = normalizePhone(row.phone);
  const pincode = String(row.pincode ?? '').trim();
  const product = normalizeProduct(row.product);
  const source = normalizeChoice(row.source, LEAD_SOURCES);
  const createdOn = normalizeDate(row.created_on);
  const status = normalizeChoice(row.status, LEAD_STATUSES);
  const rejected = [];

  if (!leadId) rejected.push('missing lead_id');
  if (leadId.length > LEAD_VALIDATION.maxLeadIdLength) {
    rejected.push(`lead_id exceeds ${LEAD_VALIDATION.maxLeadIdLength} characters`);
  }
  if (!name) rejected.push('missing name');
  if (name.length > LEAD_VALIDATION.maxNameLength) {
    rejected.push(`name exceeds ${LEAD_VALIDATION.maxNameLength} characters`);
  }
  if (/[\u0000-\u001f\u007f]/.test(name))
    rejected.push('name contains unsupported control characters');
  if (!phone) rejected.push('mobile must be a valid 10-digit Indian number');
  if (!isValidPincode(pincode))
    rejected.push('pincode must contain exactly 6 digits and cannot start with zero');
  if (!product) rejected.push('unrecognized product');
  if (!source) rejected.push('unrecognized source');
  if (!createdOn) rejected.push('created_on is not a valid YYYY-MM-DD date');
  if (!status) rejected.push('unrecognized status');

  if (rejected.length) {
    return { action: 'rejected', reason: rejected.join('; '), lead: null };
  }

  if (name !== row.name) fixes.push('trimmed/collapsed name whitespace');
  if (String(row.phone ?? '').trim() !== phone) {
    fixes.push('normalized mobile to 10 digits');
  }
  if (product !== row.product) fixes.push('normalized product name');
  if (source !== row.source) fixes.push('normalized source casing/spacing');
  if (status !== row.status) fixes.push('normalized status casing/spacing');

  const dealer = findDealer(pincode, dealers);
  if (dealer === null) {
    return {
      action: 'assigned_inhouse',
      reason: `no dealer covers pincode prefix ${pincode.slice(0, 3)}${fixes.length ? `; ${fixes.join('; ')}` : ''}`,
      lead: {
        leadId,
        name,
        phone,
        pincode,
        product,
        source,
        createdOn,
        status,
        dealerId: FALLBACK_DEALER.dealerId,
        dealerName: FALLBACK_DEALER.dealerName,
        sourceType: 'legacy',
        sourceRow: lineNumber,
      },
    };
  }

  return {
    action: fixes.length ? 'fixed' : 'imported',
    reason: fixes.length ? fixes.join('; ') : 'no changes required',
    lead: {
      leadId,
      name,
      phone,
      pincode,
      product,
      source,
      createdOn,
      status,
      dealerId: dealer.dealerId,
      dealerName: dealer.dealerName,
      sourceType: 'legacy',
      sourceRow: lineNumber,
    },
  };
}

export function processLegacyRows(rows, dealers) {
  const seenPhones = new Map();
  const seenIds = new Set();

  return rows.map((row, index) => {
    const lineNumber = index + 2;
    const result = cleanLegacyLead(row, lineNumber, dealers);
    if (!result.lead) {
      return {
        leadId: String(row.lead_id ?? '').trim(),
        action: result.action,
        reason: result.reason,
        lead: null,
      };
    }

    const duplicateId = seenIds.has(result.lead.leadId);
    if (seenPhones.has(result.lead.phone)) {
      const first = seenPhones.get(result.lead.phone);
      return {
        leadId: result.lead.leadId,
        action: 'merged',
        reason: `duplicate mobile merged into ${first.leadId} (input row ${first.sourceRow})${duplicateId ? '; duplicate lead_id also present' : ''}`,
        lead: null,
      };
    }

    seenPhones.set(result.lead.phone, result.lead);
    if (duplicateId) {
      result.action = result.action === 'assigned_inhouse' ? result.action : 'fixed';
      result.reason = `${result.reason}; duplicate lead_id stored with unique row-based document ID`;
    }
    seenIds.add(result.lead.leadId);
    return { ...result, leadId: result.lead.leadId };
  });
}
