import { ToolCostInput } from './expensive-tools.util';
import { buildLowUsageTools } from './low-usage-tools.util';

let nextId = 1;
const tool = (name: string, monthlyCost: number, activeUsersCount: number): ToolCostInput => ({
  id: nextId++, name, monthlyCost, activeUsersCount, ownerDepartment: 'Engineering', vendor: 'Vendor',
});
const levelOf = (result: ReturnType<typeof buildLowUsageTools>, name: string) =>
  result.data.find((d) => d.name === name)?.warning_level;

describe('buildLowUsageTools', () => {
  it("formate un outil comme dans l'exemple (45.00 = medium selon la règle clarifiée)", () => {
    const result = buildLowUsageTools([
      { id: 23, name: 'Specialized Analytics', monthlyCost: 89.99, activeUsersCount: 2, ownerDepartment: 'Marketing', vendor: 'SmallVendor' },
    ]);

    expect(result.data[0]).toEqual({
      id: 23, name: 'Specialized Analytics', monthly_cost: 89.99, active_users_count: 2,
      cost_per_user: 45, department: 'Marketing', vendor: 'SmallVendor',
      warning_level: 'medium', potential_action: 'Review usage and consider optimization',
    });
  });

  it('utilise max_users = 5 par défaut et inclut les outils sans utilisateur', () => {
    const tools = [tool('Zero', 10, 0), tool('Five', 10, 5), tool('Six', 10, 6)];
    const result = buildLowUsageTools(tools);

    expect(result.data.map((d) => d.name).sort()).toEqual(['Five', 'Zero']);
    expect(result.savings_analysis.total_underutilized_tools).toBe(2);
  });

  it('applique le seuil max_users fourni', () => {
    const tools = [tool('Zero', 10, 0), tool('Five', 10, 5), tool('Six', 10, 6)];

    expect(buildLowUsageTools(tools, { maxUsers: 10 }).data).toHaveLength(3);
    expect(buildLowUsageTools(tools, { maxUsers: 0 }).data.map((d) => d.name)).toEqual(['Zero']);
  });

  it('applique exactement les seuils 20 et 50 sur le cost_per_user exposé (10 utilisateurs)', () => {
    const result = buildLowUsageTools(
      [
        tool('T1999', 199.9, 10), // 19.99 -> low
        tool('T2000', 200, 10), // 20.00 -> medium
        tool('T5000', 500, 10), // 50.00 -> medium
        tool('T5001', 500.1, 10), // 50.01 -> high
        tool('Rounded', 199.99, 10), // 19.999 s'affiche 20.00 -> medium (cohérent avec la valeur exposée)
      ],
      { maxUsers: 10 },
    );

    expect(levelOf(result, 'T1999')).toBe('low');
    expect(levelOf(result, 'T2000')).toBe('medium');
    expect(levelOf(result, 'T5000')).toBe('medium');
    expect(levelOf(result, 'T5001')).toBe('high');
    expect(levelOf(result, 'Rounded')).toBe('medium');
    expect(result.data.find((d) => d.name === 'Rounded')!.cost_per_user).toBe(20);
  });

  it('classe high un outil sans utilisateur (cost_per_user null, pas de NaN)', () => {
    const result = buildLowUsageTools([tool('Ghost', 40, 0)]);

    expect(result.data[0]).toMatchObject({
      cost_per_user: null, warning_level: 'high', potential_action: 'Consider canceling or downgrading',
    });
    expect(JSON.stringify(result)).not.toMatch(/NaN|Infinity/);
  });

  it('associe une action recommandée à chaque niveau', () => {
    const result = buildLowUsageTools([tool('High', 300, 3), tool('Medium', 60, 2), tool('Low', 10, 2)]);
    const action = (name: string) => result.data.find((d) => d.name === name)!.potential_action;

    expect(action('High')).toBe('Consider canceling or downgrading');
    expect(action('Medium')).toBe('Review usage and consider optimization');
    expect(action('Low')).toBe('Monitor usage trends');
  });

  it('calcule les économies : high + medium seulement, annuel = mensuel × 12', () => {
    const result = buildLowUsageTools([tool('High', 100, 1), tool('Medium', 60, 2), tool('Low', 10, 2)]);

    expect(result.savings_analysis).toEqual({
      total_underutilized_tools: 3,
      potential_monthly_savings: 160,
      potential_annual_savings: 1920,
    });
  });

  it('calcule les économies annuelles sans erreur de virgule flottante', () => {
    const result = buildLowUsageTools([tool('Odd', 33.33, 1)]);

    expect(result.savings_analysis.potential_monthly_savings).toBe(33.33);
    expect(result.savings_analysis.potential_annual_savings).toBe(399.96);
  });

  it('trie par gravité, puis coût décroissant, puis nom', () => {
    const result = buildLowUsageTools([
      tool('Low', 10, 2),
      tool('MediumB', 60, 2),
      tool('High', 300, 3),
      tool('MediumA', 60, 2),
      tool('MediumBig', 80, 2),
    ]);

    expect(result.data.map((d) => d.name)).toEqual(['High', 'MediumBig', 'MediumA', 'MediumB', 'Low']);
  });

  it('renvoie une liste vide et des économies à 0 quand aucun outil ne correspond', () => {
    const result = buildLowUsageTools([tool('Popular', 500, 50)]);

    expect(result).toEqual({
      data: [],
      savings_analysis: { total_underutilized_tools: 0, potential_monthly_savings: 0, potential_annual_savings: 0 },
    });
  });

  it('reproduit les valeurs attendues du test e2e', () => {
    const all: ToolCostInput[] = [
      { id: 1, name: 'Ghost', monthlyCost: 40, activeUsersCount: 0, ownerDepartment: 'Engineering', vendor: 'Vendor' },
      { id: 2, name: 'Pricey Few', monthlyCost: 89.99, activeUsersCount: 2, ownerDepartment: 'Marketing', vendor: 'SmallVendor' },
      { id: 3, name: 'Very Pricey', monthlyCost: 300, activeUsersCount: 3, ownerDepartment: 'Sales', vendor: 'BigVendor' },
      { id: 4, name: 'Cheap Few', monthlyCost: 10, activeUsersCount: 4, ownerDepartment: 'Engineering', vendor: 'Vendor' },
      { id: 5, name: 'Edge Five', monthlyCost: 100, activeUsersCount: 5, ownerDepartment: 'Engineering', vendor: 'Vendor' },
      { id: 6, name: 'Popular', monthlyCost: 500, activeUsersCount: 6, ownerDepartment: 'Engineering', vendor: 'Vendor' },
    ];
    const result = buildLowUsageTools(all);

    expect(result.data.map((d) => `${d.name}:${d.warning_level}`)).toEqual([
      'Very Pricey:high', 'Ghost:high', 'Edge Five:medium', 'Pricey Few:medium', 'Cheap Few:low',
    ]);
    expect(result.savings_analysis).toEqual({
      total_underutilized_tools: 5,
      potential_monthly_savings: 529.99,
      potential_annual_savings: 6359.88,
    });

    const three = buildLowUsageTools(all, { maxUsers: 3 });
    expect(three.data.map((d) => d.name)).toEqual(['Very Pricey', 'Ghost', 'Pricey Few']);
    expect(three.savings_analysis).toEqual({
      total_underutilized_tools: 3,
      potential_monthly_savings: 429.99,
      potential_annual_savings: 5159.88,
    });
  });
});