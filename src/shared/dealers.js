export function validateDealerDirectory(dealers) {
  if (!Array.isArray(dealers) || dealers.length === 0) {
    throw new Error('Dealer directory must contain at least one dealer.');
  }

  const dealerIds = new Set();
  const prefixes = new Map();
  for (const dealer of dealers) {
    if (
      !dealer ||
      typeof dealer.dealerId !== 'string' ||
      !dealer.dealerId.trim() ||
      typeof dealer.dealerName !== 'string' ||
      !dealer.dealerName.trim() ||
      typeof dealer.city !== 'string' ||
      !dealer.city.trim() ||
      !Array.isArray(dealer.prefixes) ||
      dealer.prefixes.length === 0
    ) {
      throw new Error('Each dealer must have an ID, name, city, and at least one pincode prefix.');
    }
    const dealerId = dealer.dealerId.toLowerCase();
    if (dealerIds.has(dealerId)) throw new Error(`Duplicate dealer ID: ${dealer.dealerId}.`);
    dealerIds.add(dealerId);

    for (const prefix of dealer.prefixes) {
      if (typeof prefix !== 'string' || !/^\d{3}$/.test(prefix)) {
        throw new Error(`Dealer ${dealer.dealerId} has invalid pincode prefix "${prefix}".`);
      }
      if (prefixes.has(prefix)) {
        throw new Error(
          `Pincode prefix ${prefix} is assigned to both ${prefixes.get(prefix)} and ${dealer.dealerId}.`,
        );
      }
      prefixes.set(prefix, dealer.dealerId);
    }
  }

  return dealers;
}

export function findDealer(pincode, dealers = []) {
  const prefix = String(pincode ?? '').slice(0, 3);
  return dealers.find((dealer) => dealer.prefixes.includes(prefix)) ?? null;
}
