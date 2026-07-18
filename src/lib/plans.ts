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

export const PREMIUM_PLANS: PremiumPlan[] = [
  { id: "1m", label: "1 month", months: 1, total: 30000, totalUsd: 250, discount: 70 },
  { id: "3m", label: "3 months", months: 3, total: 80000, totalUsd: 667, discount: 73, popular: true },
  { id: "6m", label: "6 months", months: 6, total: 150000, totalUsd: 1250, discount: 75 },
];

export function getPlan(id: string | null | undefined): PremiumPlan | undefined {
  return PREMIUM_PLANS.find((p) => p.id === id);
}

export const fmtUZS = (n: number) => n.toLocaleString("en-US");
export const fmtUSD = (cents: number) => `$${(cents / 100).toFixed(2)}`;
