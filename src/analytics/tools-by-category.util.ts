import { allocatePercentTenths } from './percentages.util';

export interface CategoryRow {
  category_name: string;
  tools_count: string | number | null;
  total_cost: string | number | null;
  total_users: string | number | null;
}

const toCents = (value: string | number | null | undefined) => Math.round(Number(value ?? 0) * 100);
const byName = (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0);

export function buildToolsByCategory(rows: CategoryRow[], categories: string[]) {
  const byCategory = new Map(rows.map((r) => [r.category_name, r]));

  const items = categories.map((name) => {
    const row = byCategory.get(name);
    const cents = toCents(row?.total_cost);
    const users = Number(row?.total_users ?? 0);
    return {
      name,
      cents,
      tools_count: Number(row?.tools_count ?? 0),
      total_users: users,
      avgCents: users > 0 ? Math.round(cents / users) : null,
      tenths: 0,
    };
  });

  const tenths = allocatePercentTenths(items.map((i) => i.cents), items.map((i) => i.name));
  items.forEach((i, idx) => (i.tenths = tenths[idx]));

  const totalCents = items.reduce((sum, i) => sum + i.cents, 0);
  const sorted = [...items].sort((a, b) => b.cents - a.cents || byName(a.name, b.name));
  const withUsers = items.filter((i): i is typeof i & { avgCents: number } => i.avgCents !== null);

  return {
    data: sorted.map((i) => ({
      category_name: i.name,
      tools_count: i.tools_count,
      total_cost: i.cents / 100,
      total_users: i.total_users,
      percentage_of_budget: i.tenths / 10,
      average_cost_per_user: i.avgCents === null ? null : i.avgCents / 100,
    })),
    insights: {
      most_expensive_category: totalCents > 0 ? sorted[0].name : null,
      most_efficient_category: withUsers.length
        ? [...withUsers].sort((a, b) => a.avgCents - b.avgCents || byName(a.name, b.name))[0].name
        : null,
    },
  };
}