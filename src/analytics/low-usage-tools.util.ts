import { ToolCostInput } from './expensive-tools.util';

export type WarningLevel = 'high' | 'medium' | 'low';

const ACTIONS: Record<WarningLevel, string> = {
  high: 'Consider canceling or downgrading',
  medium: 'Review usage and consider optimization',
  low: 'Monitor usage trends',
};
const SEVERITY: Record<WarningLevel, number> = { high: 0, medium: 1, low: 2 };

const toCents = (value: number) => Math.round(value * 100);
const byName = (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0);

export function buildLowUsageTools(tools: ToolCostInput[], options: { maxUsers?: number } = {}) {
  const { maxUsers = 5 } = options;

  const items = tools
    .filter((t) => t.activeUsersCount <= maxUsers)
    .map((t) => {
      const cents = toCents(t.monthlyCost);
      const costPerUserCents = t.activeUsersCount > 0 ? Math.round(cents / t.activeUsersCount) : null;
      const level: WarningLevel =
        costPerUserCents === null ? 'high' : costPerUserCents < 2000 ? 'low' : costPerUserCents <= 5000 ? 'medium' : 'high';
      return { ...t, cents, costPerUserCents, level };
    })
    .sort((a, b) => SEVERITY[a.level] - SEVERITY[b.level] || b.cents - a.cents || byName(a.name, b.name));

  const savingsCents = items.filter((i) => i.level !== 'low').reduce((sum, i) => sum + i.cents, 0);

  return {
    data: items.map((i) => ({
      id: i.id,
      name: i.name,
      monthly_cost: i.cents / 100,
      active_users_count: i.activeUsersCount,
      cost_per_user: i.costPerUserCents === null ? null : i.costPerUserCents / 100,
      department: i.ownerDepartment,
      vendor: i.vendor,
      warning_level: i.level,
      potential_action: ACTIONS[i.level],
    })),
    savings_analysis: {
      total_underutilized_tools: items.length,
      potential_monthly_savings: savingsCents / 100,
      potential_annual_savings: (savingsCents * 12) / 100,
    },
  };
}