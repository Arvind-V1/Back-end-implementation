import { buildExpensiveTools, ToolCostInput } from './expensive-tools.util';

let nextId = 1;
const tool = (name: string, monthlyCost: number, activeUsersCount: number): ToolCostInput => ({
  id: nextId++, name, monthlyCost, activeUsersCount, ownerDepartment: 'Engineering', vendor: 'Vendor',
});
const ratingOf = (result: ReturnType<typeof buildExpensiveTools>, name: string) =>
  result.data.find((d) => d.name === name)?.efficiency_rating;

describe('buildExpensiveTools', () => {
  it('calcule cost_per_user arrondi à 2 décimales et formate la réponse', () => {
    const result = buildExpensiveTools([
      { id: 15, name: 'Enterprise CRM', monthlyCost: 199.99, activeUsersCount: 12, ownerDepartment: 'Sales', vendor: 'BigCorp' },
    ]);

    expect(result.data[0]).toEqual({
      id: 15, name: 'Enterprise CRM', monthly_cost: 199.99, active_users_count: 12,
      cost_per_user: 16.67, department: 'Sales', vendor: 'BigCorp', efficiency_rating: 'average',
    });
  });

  it('calcule la moyenne entreprise pondérée (Σ coûts / Σ utilisateurs)', () => {
    const result = buildExpensiveTools([tool('A', 100, 10), tool('B', 50, 5), tool('C', 200, 10)]);

    expect(result.analysis.avg_cost_per_user_company).toBe(14); // 350 / 25
    expect(ratingOf(result, 'A')).toBe('good'); // 10 / 14 = 71 %
    expect(ratingOf(result, 'B')).toBe('good');
    expect(ratingOf(result, 'C')).toBe('low'); // 20 / 14 = 143 %
    expect(result.analysis.potential_savings_identified).toBe(200);
    expect(result.analysis.total_tools_analyzed).toBe(3);
  });

  it('applique exactement les seuils 50 %, 80 % et 120 % (moyenne = 10)', () => {
    const result = buildExpensiveTools([
      tool('Ref', 100, 10), // 100 %
      tool('T120', 120, 10), // exactement 120 % -> average
      tool('T80', 80, 10), // exactement 80 % -> average
      tool('T50', 50, 10), // exactement 50 % -> good
      tool('T150', 150, 10), // 150 % -> low
      tool('T40', 40, 10), // 40 % -> excellent
      tool('T160', 160, 10), // 160 % -> low (garde la moyenne à 10)
    ]);

    expect(result.analysis.avg_cost_per_user_company).toBe(10);
    expect(ratingOf(result, 'Ref')).toBe('average');
    expect(ratingOf(result, 'T120')).toBe('average');
    expect(ratingOf(result, 'T80')).toBe('average');
    expect(ratingOf(result, 'T50')).toBe('good');
    expect(ratingOf(result, 'T150')).toBe('low');
    expect(ratingOf(result, 'T40')).toBe('excellent');
    expect(ratingOf(result, 'T160')).toBe('low');
  });

  it('gère la division par zéro : outil sans utilisateur = cost_per_user null, rating low, hors moyenne', () => {
    const result = buildExpensiveTools([tool('Used', 100, 10), tool('Ghost', 40, 0)]);
    const ghost = result.data.find((d) => d.name === 'Ghost')!;

    expect(ghost.cost_per_user).toBeNull();
    expect(ghost.efficiency_rating).toBe('low');
    expect(result.analysis.avg_cost_per_user_company).toBe(10); // Ghost exclu du calcul
    expect(ratingOf(result, 'Used')).toBe('average');
    expect(result.analysis.potential_savings_identified).toBe(40);
  });

  it("ne produit ni NaN ni Infinity quand aucun outil n'a d'utilisateur", () => {
    const result = buildExpensiveTools([tool('A', 30, 0), tool('B', 20, 0)]);

    expect(result.analysis.avg_cost_per_user_company).toBe(0);
    expect(result.data.every((d) => d.cost_per_user === null && d.efficiency_rating === 'low')).toBe(true);
    expect(result.analysis.potential_savings_identified).toBe(50);
    expect(JSON.stringify(result)).not.toMatch(/NaN|Infinity/);
  });

  it('classe average quand tous les outils avec utilisateurs sont gratuits', () => {
    const result = buildExpensiveTools([tool('Free A', 0, 5), tool('Free B', 0, 3)]);

    expect(result.analysis.avg_cost_per_user_company).toBe(0);
    expect(result.data.every((d) => d.efficiency_rating === 'average')).toBe(true);
    expect(result.analysis.potential_savings_identified).toBe(0);
  });

  it("renvoie 0 économie quand aucun outil n'est low", () => {
    const result = buildExpensiveTools([tool('A', 100, 10), tool('B', 100, 10)]);

    expect(result.analysis.potential_savings_identified).toBe(0);
  });

  it('trie par coût décroissant (égalité : nom), applique min_cost puis limit', () => {
    const tools = [tool('Cheap', 20, 10), tool('Small', 100, 10), tool('Mid', 200, 10), tool('Big', 300, 10)];
    const result = buildExpensiveTools(tools, { minCost: 100, limit: 1 });

    expect(result.data.map((d) => d.name)).toEqual(['Big']);
    expect(result.analysis.total_tools_analyzed).toBe(3); // Big, Mid, Small : avant limit
    expect(result.analysis.avg_cost_per_user_company).toBe(15.5); // 620 / 40 : ignore min_cost
    expect(result.analysis.potential_savings_identified).toBe(500); // Big + Mid, au-delà des outils renvoyés

    const ties = buildExpensiveTools([tool('Zeta', 50, 5), tool('Alpha', 50, 5)]);
    expect(ties.data.map((d) => d.name)).toEqual(['Alpha', 'Zeta']);
  });

  it('applique la limite par défaut de 10', () => {
    const tools = Array.from({ length: 15 }, (_, i) => tool(`T${String(i).padStart(2, '0')}`, 10 + i, 5));

    expect(buildExpensiveTools(tools).data).toHaveLength(10);
    expect(buildExpensiveTools(tools).analysis.total_tools_analyzed).toBe(15);
  });
});