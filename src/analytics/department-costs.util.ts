export interface DepartmentRow {
  department: string;
  total_cost: string | number | null;
  tools_count: string | number | null;
  total_users: string | number | null;
}

export type DepartmentSortBy = 'total_cost' | 'department' | 'tools_count' | 'total_users';
export type SortOrder = 'asc' | 'desc';

const toCents = (value: string | number | null | undefined) => Math.round(Number(value ?? 0) * 100);
const byName = (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0);

export function buildDepartmentCosts(
  rows: DepartmentRow[],
  departments: string[],
  sortBy: DepartmentSortBy = 'total_cost',
  order: SortOrder = 'desc',
) {
  const byDepartment = new Map(rows.map((r) => [r.department, r]));

  const items = departments.map((department) => {
    const row = byDepartment.get(department);
    return {
      department,
      cents: toCents(row?.total_cost),
      tools_count: Number(row?.tools_count ?? 0),
      total_users: Number(row?.total_users ?? 0),
      tenths: 0, // pourcentage en dixièmes de point (650 = 65.0 %)
    };
  });

  const totalCents = items.reduce((sum, i) => sum + i.cents, 0);

  if (totalCents > 0) {
    const exact = items.map((i) => (i.cents * 1000) / totalCents);
    items.forEach((i, idx) => (i.tenths = Math.floor(exact[idx])));
    const remaining = 1000 - items.reduce((sum, i) => sum + i.tenths, 0);
    exact
      .map((e, idx) => ({ idx, fraction: e - Math.floor(e) }))
      .sort((a, b) => b.fraction - a.fraction || byName(items[a.idx].department, items[b.idx].department))
      .slice(0, remaining)
      .forEach(({ idx }) => items[idx].tenths++);
  }

  const mostExpensive =
    totalCents > 0
      ? [...items].sort((a, b) => b.cents - a.cents || byName(a.department, b.department))[0].department
      : null;

  const direction = order === 'asc' ? 1 : -1;
  const sortKey = { total_cost: 'cents', tools_count: 'tools_count', total_users: 'total_users' } as const;
  const sorted = [...items].sort((a, b) => {
    const diff =
      sortBy === 'department' ? byName(a.department, b.department) : a[sortKey[sortBy]] - b[sortKey[sortBy]];
    return diff * direction || byName(a.department, b.department);
  });

  return {
    data: sorted.map((i) => ({
      department: i.department,
      total_cost: i.cents / 100,
      tools_count: i.tools_count,
      total_users: i.total_users,
      average_cost_per_tool: i.tools_count > 0 ? Math.round(i.cents / i.tools_count) / 100 : 0,
      cost_percentage: i.tenths / 10,
    })),
    summary: {
      total_company_cost: totalCents / 100,
      departments_count: items.length,
      most_expensive_department: mostExpensive,
    },
  };
}