import assert from 'node:assert/strict';
import test from 'node:test';
import { isAllowedLeadDeskEmail } from '../src/shared/access-policy.js';
import { ACCESS_POLICY, parseAllowedEmails } from '../src/shared/lead-options.js';

test('allows configured company-domain accounts and explicitly approved accounts only', () => {
  const companyEmail = `sales@${ACCESS_POLICY.allowedDomains[0]}`;
  assert.equal(isAllowedLeadDeskEmail(companyEmail.toUpperCase()), true);
  assert.equal(isAllowedLeadDeskEmail('nitishkrsahu123@gmail.com'), true);
  assert.equal(isAllowedLeadDeskEmail('person@example.com'), false);
  assert.equal(isAllowedLeadDeskEmail('owner@gmail.com'), false);
  assert.equal(isAllowedLeadDeskEmail(''), false);
});

test('parses comma-separated approved emails and removes duplicates', () => {
  assert.deepEqual(
    parseAllowedEmails(' Reviewer@example.com, owner@example.com,reviewer@example.com, '),
    ['reviewer@example.com', 'owner@example.com'],
  );
});
