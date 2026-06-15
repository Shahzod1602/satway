export const BASE_MONTHLY = 99000;

export type PremiumPlan = {
  id: string;
  label: string;
  months: number;
  total: number;
  discount: number;
  popular?: boolean;
};

export const PREMIUM_PLANS: PremiumPlan[] = [
  { id: "1m", label: "1 month", months: 1, total: 64350, discount: 35 },
  { id: "3m", label: "3 months", months: 3, total: 147000, discount: 50, popular: true },
  { id: "6m", label: "6 months", months: 6, total: 234000, discount: 60 },
];

export function getPlan(id: string | null | undefined): PremiumPlan | undefined {
  return PREMIUM_PLANS.find((p) => p.id === id);
}

export const fmtUZS = (n: number) => n.toLocaleString("en-US");
