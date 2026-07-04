// Small date helpers. Kept out of component bodies so React's purity lint doesn't
// flag a bare Date.now() during render, and so "now" is read once per call.

/** Whole days from now until `date` (negative once the date is in the past). */
export function daysUntil(date: Date | string): number {
  return Math.ceil((new Date(date).getTime() - Date.now()) / 86_400_000);
}
