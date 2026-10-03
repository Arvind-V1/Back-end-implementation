import { buildToolsByCategory } from './tools-by-category.util';

const row = (category_name: string, tools_count: number, total_cost: number | string, total_users: number) => ({
  category_name, tools_count, total_cost, total_users,
});
const percentSum = (data: { percentage_of_budget: number }[]) =>
  Math.round(data.reduce((s, d) => s + d.percentage_of_budget, 0) * 10);

describe('buildToolsByCategory', () => {
  it('agrège coût, utilisateurs, pourcentage et moyenne par catégorie (valeurs SQL en chaînes)', () => {
    const result = buildToolsByCategory(
      [
        { category_name: 'Development', tools_count: '8', total_cost: '650.00', total_users: '67' },
        { category_name: 'Communication', tools_count: '5', total_cost: '240.50', total_users: '89' },
      ],
      ['Communication', 'Design', 'Development'],
    );

    expect(result.data).toEqual([
      { category_name: 'Development', tools_count: 8, total_cost: 650, total_users: 67, percentage_of_budget: 73, average_cost_per_user: 9.7 },
      { category_name: 'Communication', tools_count: 5, total_cost: 240.5, total_users: 89, percentage_of_budget: 27, average_cost_per_user: 2.7 },
      { category_name: 'Design', tools_count: 0, total_cost: 0, total_users: 0, percentage_of_budget: 0, average_cost_per_user: null },
    ]);
    expect(result.insights).toEqual({ most_expensive_category: 'Development', most_efficient_category: 'Communication' });
  });

  it('les pourcentages totalisent exactement 100 (plus fort reste, pas arrondi simple)', () => {
    // Valeurs de l'e2e : un arrondi simple donnerait 75.1 + 15.0 + 10.0 = 100.1
    const result = buildToolsByCategory(
      [row('Development', 2, '150.50', 17), row('Communication', 1, '30.00', 30), row('Design', 1, '20.00', 0)],
      ['Communication', 'Design', 'Development', 'Security'],
    );

    expect(result.data).toEqual([
      { category_name: 'Development', tools_count: 2, total_cost: 150.5, total_users: 17, percentage_of_budget: 75, average_cost_per_user: 8.85 },
      { category_name: 'Communication', tools_count: 1, total_cost: 30, total_users: 30, percentage_of_budget: 15, average_cost_per_user: 1 },
      { category_name: 'Design', tools_count: 1, total_cost: 20, total_users: 0, percentage_of_budget: 10, average_cost_per_user: null },
      { category_name: 'Security', tools_count: 0, total_cost: 0, total_users: 0, percentage_of_budget: 0, average_cost_per_user: null },
    ]);
    expect(percentSum(result.data)).toBe(1000);
    expect(result.insights).toEqual({ most_expensive_category: 'Development', most_efficient_category: 'Communication' });
  });

  it('les pourcentages totalisent 100 avec trois parts égales', () => {
    const rows = ['A', 'B', 'C'].map((n) => row(n, 1, 100, 1));

    expect(percentSum(buildToolsByCategory(rows, ['A', 'B', 'C']).data)).toBe(1000);
  });

  it('exclut les catégories sans utilisateur de most_efficient_category', () => {
    const result = buildToolsByCategory([row('NoUsers', 3, 100, 0), row('Used', 2, 500, 10)], ['NoUsers', 'Used']);

    expect(result.insights).toEqual({ most_expensive_category: 'Used', most_efficient_category: 'Used' });
    expect(result.data.find((d) => d.category_name === 'NoUsers')!.average_cost_per_user).toBeNull();
  });

  it('départage les égalités de moyenne par ordre alphabétique', () => {
    const result = buildToolsByCategory([row('Zeta', 1, 100, 10), row('Alpha', 2, 200, 20)], ['Zeta', 'Alpha']);

    expect(result.insights.most_efficient_category).toBe('Alpha');
  });

  it("compare les moyennes arrondies telles qu'exposées (égalité sur 2 décimales)", () => {
    // Alpha : 10.004 -> 10.00 ; Zed : 10.000 exactement. Valeurs exposées égales -> ordre alphabétique.
    const result = buildToolsByCategory([row('Alpha', 1, '100.04', 10), row('Zed', 1, '100.00', 10)], ['Alpha', 'Zed']);

    expect(result.data.map((d) => d.average_cost_per_user)).toEqual([10, 10]);
    expect(result.insights.most_efficient_category).toBe('Alpha');
  });

  it('départage les égalités de coût par ordre alphabétique', () => {
    const result = buildToolsByCategory([row('Zeta', 1, 50, 5), row('Alpha', 1, 50, 5)], ['Zeta', 'Alpha']);

    expect(result.insights.most_expensive_category).toBe('Alpha');
    expect(result.data.map((d) => d.category_name)).toEqual(['Alpha', 'Zeta']);
  });

  it("gère l'absence totale de données sans NaN", () => {
    const result = buildToolsByCategory([], ['Development', 'Design']);

    expect(result.insights).toEqual({ most_expensive_category: null, most_efficient_category: null });
    expect(result.data.every((d) => d.percentage_of_budget === 0 && d.average_cost_per_user === null)).toBe(true);
    expect(JSON.stringify(result)).not.toMatch(/NaN|Infinity/);
  });
});