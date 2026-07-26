export const BASE_MONTHLY = 99000;

/**
 * Flat surcharge on every card (Polar) checkout, in US cents. It passes Polar's fixed
 * per-transaction fee on to the buyer, and it keeps every charge above the $0.50
 * card-processor minimum — even a 100%-off promo still lands at a chargeable $0.50.
 */
export const CARD_FEE_USD_CENTS = 50;

export type PremiumPlan = {
  id: string;
  label: string;
  months: number;
  total: number; // UZS
  totalUsd: number; // US cents — Polar (card) checkout price (= total / UZS_PER_USD)
  discount: number;
  popular?: boolean;
};

// List price is BASE_MONTHLY × months; `total` is that after the current launch discount
// (flat 76% across all plans, pricing the dollar targets at $2/$4/$6). totalUsd is the
// UZS total ÷ 120 (≈ $1 = 12,000 UZS).
export const PREMIUM_PLANS: PremiumPlan[] = [
  { id: "1m", label: "1 month", months: 1, total: 24000, totalUsd: 200, discount: 76 },
  { id: "2m", label: "2 months", months: 2, total: 48000, totalUsd: 400, discount: 76 },
  { id: "3m", label: "3 months", months: 3, total: 72000, totalUsd: 600, discount: 76, popular: true },
];

export function getPlan(id: string | null | undefined): PremiumPlan | undefined {
  return PREMIUM_PLANS.find((p) => p.id === id);
}

export const fmtUZS = (n: number) => n.toLocaleString("en-US");
export const fmtUSD = (cents: number) => `$${(cents / 100).toFixed(2)}`;
