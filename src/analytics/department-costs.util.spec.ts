import { buildDepartmentCosts } from './department-costs.util';

const DEPARTMENTS = ['Design', 'Engineering', 'Finance', 'HR', 'Marketing', 'Operations', 'Sales'];
const percentSum = (data: { cost_percentage: number }[]) =>
  Math.round(data.reduce((s, d) => s + d.cost_percentage, 0) * 10);

describe('buildDepartmentCosts', () => {
  it('calcule total, moyenne par outil et pourcentage (valeurs SQL en chaînes)', () => {
    const result = buildDepartmentCosts(
      [
        { department: 'Engineering', total_cost: '890.50', tools_count: '12', total_users: '45' },
        { department: 'Sales', total_cost: '456.75', tools_count: '6', total_users: '18' },
      ],
      DEPARTMENTS,
    );
    const eng = result.data.find((d) => d.department === 'Engineering')!;
    const sales = result.data.find((d) => d.department === 'Sales')!;

    expect(eng).toMatchObject({ total_cost: 890.5, tools_count: 12, total_users: 45, average_cost_per_tool: 74.21 });
    expect(sales).toMatchObject({ total_cost: 456.75, tools_count: 6, total_users: 18, average_cost_per_tool: 76.13 });
    expect(result.summary).toEqual({
      total_company_cost: 1347.25,
      departments_count: 7,
      most_expensive_department: 'Engineering',
    });
  });

  it('les pourcentages totalisent exactement 100 (trois parts égales)', () => {
    const rows = ['Design', 'Engineering', 'Sales'].map((department) => ({
      department, total_cost: 100, tools_count: 1, total_users: 1,
    }));
    const { data } = buildDepartmentCosts(rows, DEPARTMENTS);

    expect(percentSum(data)).toBe(1000);
    expect(data.filter((d) => d.cost_percentage > 0).map((d) => d.cost_percentage).sort()).toEqual([33.3, 33.3, 33.4]);
  });

  it('les pourcentages totalisent 100 sur des montants quelconques', () => {
    const rows = DEPARTMENTS.map((department, i) => ({
      department, total_cost: 13.37 * (i + 1) ** 2 + 0.07, tools_count: i + 1, total_users: i,
    }));
    expect(percentSum(buildDepartmentCosts(rows, DEPARTMENTS).data)).toBe(1000);
  });

  it('garde les départements sans outil actif, avec des zéros et sans NaN', () => {
    const { data } = buildDepartmentCosts(
      [{ department: 'Sales', total_cost: 60, tools_count: 1, total_users: 2 }],
      DEPARTMENTS,
    );
    const design = data.find((d) => d.department === 'Design')!;

    expect(data).toHaveLength(7);
    expect(design).toEqual({
      department: 'Design', total_cost: 0, tools_count: 0, total_users: 0, average_cost_per_tool: 0, cost_percentage: 0,
    });
    expect(data.find((d) => d.department === 'Sales')!.cost_percentage).toBe(100);
  });

  it("gère le cas où aucun département n'a de coût", () => {
    const result = buildDepartmentCosts([], DEPARTMENTS);

    expect(result.summary).toEqual({ total_company_cost: 0, departments_count: 7, most_expensive_department: null });
    expect(result.data.every((d) => d.cost_percentage === 0 && d.average_cost_per_tool === 0)).toBe(true);
  });

  it('départage les égalités de coût par ordre alphabétique', () => {
    const rows = [
      { department: 'Sales', total_cost: 50, tools_count: 1, total_users: 1 },
      { department: 'Finance', total_cost: 50, tools_count: 1, total_users: 1 },
    ];
    const result = buildDepartmentCosts(rows, DEPARTMENTS);

    expect(result.summary.most_expensive_department).toBe('Finance');
    expect(result.data.slice(0, 2).map((d) => d.department)).toEqual(['Finance', 'Sales']);
  });

  it('trie par coût décroissant par défaut, puis selon sort_by et order', () => {
    const rows = [
      { department: 'Design', total_cost: 10, tools_count: 5, total_users: 1 },
      { department: 'Engineering', total_cost: 30, tools_count: 1, total_users: 3 },
      { department: 'Sales', total_cost: 20, tools_count: 3, total_users: 2 },
    ];
    const names = (r: ReturnType<typeof buildDepartmentCosts>) => r.data.map((d) => d.department).slice(0, 3);

    expect(names(buildDepartmentCosts(rows, DEPARTMENTS))).toEqual(['Engineering', 'Sales', 'Design']);
    expect(buildDepartmentCosts(rows, DEPARTMENTS, 'total_cost', 'asc').data.map((d) => d.department)).toEqual([
      'Finance', 'HR', 'Marketing', 'Operations', // 0 € d'abord, à égalité par ordre alphabétique
      'Design', 'Sales', 'Engineering',
    ]);
    expect(buildDepartmentCosts(rows, DEPARTMENTS, 'department', 'asc').data.map((d) => d.department)).toEqual(DEPARTMENTS);
    expect(buildDepartmentCosts(rows, DEPARTMENTS, 'department', 'desc').data[0].department).toBe('Sales');
    expect(buildDepartmentCosts(rows, DEPARTMENTS, 'tools_count', 'desc').data[0].department).toBe('Design');
  });
});