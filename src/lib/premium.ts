/** Add calendar months to a date, clamping to the last day of the target month
 * (e.g. Jan 31 + 1mo → Feb 28, not Mar 3 — native setMonth overflows forward). */
export function addMonths(from: Date, months: number): Date {
  const d = new Date(from);
  const day = d.getDate();
  d.setDate(1); // avoid mid-change overflow
  d.setMonth(d.getMonth() + months);
  const lastDay = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
  d.setDate(Math.min(day, lastDay));
  return d;
}

/**
 * Compute the new premium expiry when granting `months`. If the user still has
 * active premium, extend from that expiry; otherwise start from now.
 */
export function nextPremiumUntil(
  currentUntil: Date | null | undefined,
  months: number,
  now: Date = new Date(),
): Date {
  const base = currentUntil && currentUntil.getTime() > now.getTime() ? currentUntil : now;
  return addMonths(base, months);
}
