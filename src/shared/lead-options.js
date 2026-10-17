import projectOptions from '../../config/lead-options.json' with { type: 'json' };

export const LEAD_PRODUCTS = projectOptions.products;
export const PLANT_LOCATION = projectOptions.plantLocation;
export const LEAD_VALIDATION = projectOptions.validation;
export const LEAD_SOURCES = projectOptions.sources;
export const LEAD_STATUSES = projectOptions.statuses;
export const LEAD_METRICS = projectOptions.leadMetrics;
export const FALLBACK_DEALER = projectOptions.fallbackDealer;
export function parseAllowedEmails(value) {
  return [
    ...new Set(
      String(value ?? '')
        .split(',')
        .map((email) => email.trim().toLowerCase())
        .filter(Boolean),
    ),
  ];
}

const environmentAllowedEmails =
  typeof import.meta.env === 'object'
    ? parseAllowedEmails(import.meta.env.VITE_FIREBASE_ALLOWED_EMAILS)
    : [];

export const ACCESS_POLICY = {
  ...projectOptions.access,
  allowedEmails: parseAllowedEmails(
    [...(projectOptions.access.allowedEmails ?? []), ...environmentAllowedEmails].join(','),
  ),
};
export const LEGACY_PRODUCT_ALIASES = projectOptions.legacyProductAliases ?? {};
