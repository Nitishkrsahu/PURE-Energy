import { validateDealerDirectory } from '../../src/shared/dealers.js';

function quoteRuleString(value) {
  return `'${String(value).replace(/\\/g, '\\\\').replace(/'/g, "\\'")}'`;
}

function ruleList(values) {
  return `[${values.map(quoteRuleString).join(', ')}]`;
}

function assignmentExpressions(dealers) {
  return dealers.flatMap((dealer) =>
    dealer.prefixes.map(
      (prefix) =>
        `(data.dealerId == ${quoteRuleString(dealer.dealerId)} && data.dealerName == ${quoteRuleString(dealer.dealerName)} && data.pincode.matches('^${prefix}[0-9]{3}$'))`,
    ),
  );
}

function validateProjectOptions(config, dealers) {
  validateDealerDirectory(dealers);
  if (typeof config.plantLocation !== 'string' || !config.plantLocation.trim()) {
    throw new Error('config/lead-options.json must define plantLocation.');
  }
  for (const key of ['maxNameLength', 'maxLeadIdLength']) {
    if (!Number.isSafeInteger(config.validation?.[key]) || config.validation[key] < 1) {
      throw new Error(`config/lead-options.json validation.${key} must be a positive integer.`);
    }
  }
  for (const key of ['products', 'sources', 'statuses']) {
    if (!Array.isArray(config[key]) || config[key].length === 0) {
      throw new Error(`config/lead-options.json must define a non-empty ${key} array.`);
    }
    if (
      config[key].some((value) => typeof value !== 'string' || !value.trim()) ||
      new Set(config[key]).size !== config[key].length
    ) {
      throw new Error(`config/lead-options.json ${key} must contain unique, non-empty strings.`);
    }
  }
  if (
    !config.leadMetrics?.initialStatus ||
    !config.statuses.includes(config.leadMetrics.initialStatus)
  ) {
    throw new Error('leadMetrics.initialStatus must match a configured lead status.');
  }
  if (
    !config.statuses.includes(config.leadMetrics.conversionStatus) ||
    !Array.isArray(config.leadMetrics.openStatuses) ||
    config.leadMetrics.openStatuses.some((status) => !config.statuses.includes(status))
  ) {
    throw new Error('leadMetrics conversion/open statuses must match configured lead statuses.');
  }
  if (
    typeof config.fallbackDealer?.dealerId !== 'string' ||
    !config.fallbackDealer.dealerId.trim() ||
    typeof config.fallbackDealer?.dealerName !== 'string' ||
    !config.fallbackDealer.dealerName.trim()
  ) {
    throw new Error('config/lead-options.json must define the fallback dealer ID and name.');
  }
  const allowedDomains = config.access?.allowedDomains ?? [];
  const allowedEmails = config.access?.allowedEmails ?? [];
  if (!Array.isArray(allowedDomains) || !Array.isArray(allowedEmails)) {
    throw new Error('access.allowedDomains and access.allowedEmails must be arrays.');
  }
  if (!allowedDomains.length && !allowedEmails.length) {
    throw new Error('Configure at least one allowed email or domain in lead-options.json.');
  }
  if (
    allowedDomains.some(
      (domain) =>
        typeof domain !== 'string' ||
        !/^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]*[a-z0-9])?)+$/i.test(domain),
    )
  ) {
    throw new Error('access.allowedDomains must contain valid domain names.');
  }
  if (
    allowedEmails.some(
      (email) => typeof email !== 'string' || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email),
    )
  ) {
    throw new Error('access.allowedEmails must contain valid email addresses.');
  }
}

export function generateFirestoreRules({ template, config, dealers }) {
  validateProjectOptions(config, dealers);
  const coveredPrefixes = dealers.flatMap((dealer) => dealer.prefixes);
  const allowedDomains = config.access?.allowedDomains ?? [];
  const allowedEmails = config.access?.allowedEmails ?? [];
  const emailPolicies = [
    ...allowedEmails.map(
      (email) => `request.auth.token.email == ${quoteRuleString(email.toLowerCase())}`,
    ),
    ...allowedDomains.map((domain) => {
      const escapedDomain = domain.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const regex = `^[^@]+@${escapedDomain}$`;
      return `request.auth.token.email.matches(${quoteRuleString(regex)})`;
    }),
  ];
  const replacements = {
    EMAIL_POLICY: emailPolicies.join('\n          || '),
    STATUSES: ruleList(config.statuses),
    PRODUCTS: ruleList(config.products),
    SOURCES: ruleList(config.sources),
    INITIAL_STATUS: quoteRuleString(config.leadMetrics.initialStatus),
    MAX_NAME_LENGTH: String(config.validation.maxNameLength),
    DEALER_ASSIGNMENTS: assignmentExpressions(dealers).join('\n        || ') || 'false',
    FALLBACK_ID: quoteRuleString(config.fallbackDealer.dealerId),
    FALLBACK_NAME: quoteRuleString(config.fallbackDealer.dealerName),
    COVERED_PINCODES_PATTERN: quoteRuleString(`^(${coveredPrefixes.join('|')})[0-9]{3}$`),
  };

  const rules = template.replace(/\{\{([A-Z_]+)\}\}/g, (placeholder, key) => {
    if (!(key in replacements))
      throw new Error(`Unknown Firestore rules placeholder: ${placeholder}`);
    return replacements[key];
  });
  if (/\{\{[A-Z_]+\}\}/.test(rules))
    throw new Error('Firestore rules template contains an unresolved placeholder.');
  return rules;
}
