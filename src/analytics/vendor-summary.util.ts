import { ToolCostInput } from './expensive-tools.util';

export type VendorEfficiency = 'excellent' | 'good' | 'average' | 'poor';

const toCents = (value: number) => Math.round(value * 100);
const byName = (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0);

// Seuils appliqués au average_cost_per_user exposé (en centimes) :
// < 5 excellent, 5 à < 15 good, 15 à 25 inclus average, > 25 poor ; sans utilisateur : poor.
const rate = (avgCents: number | null): VendorEfficiency =>
  avgCents === null ? 'poor' : avgCents < 500 ? 'excellent' : avgCents < 1500 ? 'good' : avgCents <= 2500 ? 'average' : 'poor';

export function buildVendorSummary(tools: ToolCostInput[]) {
  const byVendor = new Map<string, { cents: number; toolsCount: number; users: number; departments: Set<string> }>();
  for (const t of tools) {
    const entry = byVendor.get(t.vendor) ?? { cents: 0, toolsCount: 0, users: 0, departments: new Set<string>() };
    entry.cents += toCents(t.monthlyCost);
    entry.toolsCount += 1;
    entry.users += t.activeUsersCount;
    entry.departments.add(t.ownerDepartment);
    byVendor.set(t.vendor, entry);
  }

  const items = [...byVendor.entries()]
    .map(([vendor, e]) => {
      const avgCents = e.users > 0 ? Math.round(e.cents / e.users) : null;
      return {
        vendor,
        cents: e.cents,
        toolsCount: e.toolsCount,
        users: e.users,
        departments: [...e.departments].sort(byName).join(','),
        avgCents,
        efficiency: rate(avgCents),
      };
    })
    .sort((a, b) => b.cents - a.cents || byName(a.vendor, b.vendor));

  const withUsers = items.filter((i): i is typeof i & { avgCents: number } => i.avgCents !== null);

  return {
    data: items.map((i) => ({
      vendor: i.vendor,
      tools_count: i.toolsCount,
      total_monthly_cost: i.cents / 100,
      total_users: i.users,
      departments: i.departments,
      average_cost_per_user: i.avgCents === null ? null : i.avgCents / 100,
      vendor_efficiency: i.efficiency,
    })),
    vendor_insights: {
      most_expensive_vendor: items.length > 0 && items[0].cents > 0 ? items[0].vendor : null,
      most_efficient_vendor: withUsers.length
        ? [...withUsers].sort((a, b) => a.avgCents - b.avgCents || byName(a.vendor, b.vendor))[0].vendor
        : null,
      single_tool_vendors: items.filter((i) => i.toolsCount === 1).length,
    },
  };
}