import assert from 'node:assert/strict';
import test from 'node:test';
import { isAllowedLeadDeskEmail } from '../src/shared/access-policy.js';
import { ACCESS_POLICY } from '../src/shared/lead-options.js';

test('allows configured company-domain accounts and explicitly approved accounts only', () => {
  const companyEmail = `sales@${ACCESS_POLICY.allowedDomains[0]}`;
  assert.equal(isAllowedLeadDeskEmail(companyEmail.toUpperCase()), true);
  assert.equal(isAllowedLeadDeskEmail('person@example.com'), false);
  assert.equal(isAllowedLeadDeskEmail('owner@gmail.com'), false);
  assert.equal(isAllowedLeadDeskEmail(''), false);
});
