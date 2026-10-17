import { ACCESS_POLICY } from './lead-options.js';

export function isAllowedLeadDeskEmail(email) {
  const normalizedEmail = String(email ?? '')
    .trim()
    .toLowerCase();
  const allowedEmails = ACCESS_POLICY.allowedEmails ?? [];
  const allowedDomains = ACCESS_POLICY.allowedDomains ?? [];
  return (
    allowedEmails.some((allowedEmail) => normalizedEmail === allowedEmail.toLowerCase()) ||
    allowedDomains.some((domain) => normalizedEmail.endsWith(`@${domain.toLowerCase()}`))
  );
}
