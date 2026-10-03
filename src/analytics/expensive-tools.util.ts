export type EfficiencyRating = 'excellent' | 'good' | 'average' | 'low';

export interface ToolCostInput {
  id: number;
  name: string;
  monthlyCost: number;
  activeUsersCount: number;
  ownerDepartment: string;
  vendor: string;
}

const toCents = (value: number) => Math.round(value * 100);
const byName = (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0);

export function buildExpensiveTools(
  tools: ToolCostInput[],
  options: { minCost?: number; limit?: number } = {},
) {
  const { minCost = 0, limit = 10 } = options;
  const items = tools.map((t) => ({ ...t, cents: toCents(t.monthlyCost) }));

  const withUsers = items.filter((i) => i.activeUsersCount > 0);
  const refCents = withUsers.reduce((sum, i) => sum + i.cents, 0);
  const refUsers = withUsers.reduce((sum, i) => sum + i.activeUsersCount, 0);

  const rate = (i: (typeof items)[number]): EfficiencyRating => {
    if (i.activeUsersCount === 0) return 'low';
    if (refCents === 0) return 'average';
    const left = i.cents * refUsers; // coût par utilisateur de l'outil, × Σ utilisateurs
    const right = i.activeUsersCount * refCents; // moyenne entreprise, × utilisateurs de l'outil
    if (2 * left < right) return 'excellent';
    if (5 * left < 4 * right) return 'good';
    if (5 * left <= 6 * right) return 'average';
    return 'low';
  };

  const minCents = toCents(minCost);
  const analyzed = items
    .filter((i) => i.cents >= minCents)
    .map((i) => ({ ...i, rating: rate(i) }))
    .sort((a, b) => b.cents - a.cents || byName(a.name, b.name));

  const savingsCents = analyzed.filter((i) => i.rating === 'low').reduce((sum, i) => sum + i.cents, 0);

  return {
    data: analyzed.slice(0, limit).map((i) => ({
      id: i.id,
      name: i.name,
      monthly_cost: i.cents / 100,
      active_users_count: i.activeUsersCount,
      cost_per_user: i.activeUsersCount > 0 ? Math.round(i.cents / i.activeUsersCount) / 100 : null,
      department: i.ownerDepartment,
      vendor: i.vendor,
      efficiency_rating: i.rating,
    })),
    analysis: {
      total_tools_analyzed: analyzed.length,
      avg_cost_per_user_company: refUsers > 0 ? Math.round(refCents / refUsers) / 100 : 0,
      potential_savings_identified: savingsCents / 100,
    },
  };
}