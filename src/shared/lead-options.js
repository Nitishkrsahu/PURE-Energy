import projectOptions from '../../config/lead-options.json' with { type: 'json' };

export const LEAD_PRODUCTS = projectOptions.products;
export const PLANT_LOCATION = projectOptions.plantLocation;
export const LEAD_VALIDATION = projectOptions.validation;
export const LEAD_SOURCES = projectOptions.sources;
export const LEAD_STATUSES = projectOptions.statuses;
export const LEAD_METRICS = projectOptions.leadMetrics;
export const FALLBACK_DEALER = projectOptions.fallbackDealer;
export const ACCESS_POLICY = projectOptions.access;
export const LEGACY_PRODUCT_ALIASES = projectOptions.legacyProductAliases ?? {};
