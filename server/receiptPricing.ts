// The AI may return a receipt's pre-discount total together with coupon lines.
// Reconcile only when the ticket provides enough explicit numbers. Never blindly
// subtract a coupon from an amount that may already be the net amount paid.
function positiveMoney(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) && value > 0
    ? Math.round(value * 100) / 100
    : null;
}

export function amountAfterReceiptCoupons(amount: number | null, pricing: unknown): number | null {
  if (!pricing || typeof pricing !== 'object' || Array.isArray(pricing)) return amount;

  const details = pricing as Record<string, unknown>;
  if (!Array.isArray(details.couponDiscounts) || details.couponDiscounts.length === 0) return amount;

  let discountCents = 0;
  for (const entry of details.couponDiscounts) {
    if (!entry || typeof entry !== 'object' || Array.isArray(entry)) return amount;
    const coupon = positiveMoney((entry as Record<string, unknown>).amount);
    if (coupon === null) return amount;
    discountCents += Math.round(coupon * 100);
  }

  // The printed final total is authoritative and already includes coupons.
  const paid = positiveMoney(details.printedTotal);
  if (paid !== null) return paid;

  // Without a printed total, compute from a genuine pre-coupon total only.
  // A net `amount` by itself is not safe to discount a second time.
  const before = positiveMoney(details.preDiscountTotal);
  if (before === null) return amount;
  const netCents = Math.round(before * 100) - discountCents;
  return netCents > 0 ? netCents / 100 : amount;
}
