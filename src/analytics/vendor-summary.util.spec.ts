import { ToolCostInput } from './expensive-tools.util';
import { buildVendorSummary } from './vendor-summary.util';

let nextId = 1;
const tool = (vendor: string, monthlyCost: number, activeUsersCount: number, ownerDepartment = 'Engineering'): ToolCostInput => ({
  id: nextId++, name: `${vendor}-${nextId}`, monthlyCost, activeUsersCount, ownerDepartment, vendor,
});
const find = (result: ReturnType<typeof buildVendorSummary>, vendor: string) =>
  result.data.find((d) => d.vendor === vendor)!;

describe('buildVendorSummary', () => {
  it("agrège un vendor comme dans l'exemple (4 outils, 234.50, 67 utilisateurs)", () => {
    const result = buildVendorSummary([
      tool('Google', 100, 30, 'Engineering'),
      tool('Google', 80, 20, 'Sales'),
      tool('Google', 40, 10, 'Marketing'),
      tool('Google', 14.5, 7, 'Engineering'),
    ]);

    expect(result.data).toEqual([
      {
        vendor: 'Google', tools_count: 4, total_monthly_cost: 234.5, total_users: 67,
        departments: 'Engineering,Marketing,Sales', average_cost_per_user: 3.5, vendor_efficiency: 'excellent',
      },
    ]);
  });

  it("concatène les départements uniques par ordre alphabétique (pas l'ordre de déclaration de l'ENUM)", () => {
    const result = buildVendorSummary([
      tool('V', 10, 1, 'Sales'),
      tool('V', 10, 1, 'Design'),
      tool('V', 10, 1, 'Sales'),
      tool('V', 10, 1, 'Engineering'),
      tool('V', 10, 1, 'HR'),
    ]);

    expect(find(result, 'V').departments).toBe('Design,Engineering,HR,Sales');
  });

  it('applique exactement les seuils 5, 15 et 25 sur la moyenne exposée (100 utilisateurs)', () => {
    const result = buildVendorSummary([
      tool('V499', 499, 100), // 4.99 -> excellent
      tool('V500', 500, 100), // 5.00 -> good
      tool('V1499', 1499, 100), // 14.99 -> good
      tool('V1500', 1500, 100), // 15.00 -> average
      tool('V2500', 2500, 100), // 25.00 -> average
      tool('V2501', 2501, 100), // 25.01 -> poor
      tool('Rounded', 499.9, 100), // 4.999 s'affiche 5.00 -> good (cohérent avec la valeur exposée)
    ]);
    const level = (v: string) => find(result, v).vendor_efficiency;

    expect(level('V499')).toBe('excellent');
    expect(level('V500')).toBe('good');
    expect(level('V1499')).toBe('good');
    expect(level('V1500')).toBe('average');
    expect(level('V2500')).toBe('average');
    expect(level('V2501')).toBe('poor');
    expect(level('Rounded')).toBe('good');
    expect(find(result, 'Rounded').average_cost_per_user).toBe(5);
  });

  it('gère un vendor sans utilisateur : moyenne null, poor, exclu de most_efficient_vendor', () => {
    const result = buildVendorSummary([tool('Ghosty', 40, 0), tool('Used', 100, 10)]);

    expect(find(result, 'Ghosty')).toMatchObject({ total_users: 0, average_cost_per_user: null, vendor_efficiency: 'poor' });
    expect(result.vendor_insights.most_efficient_vendor).toBe('Used');
    expect(JSON.stringify(result)).not.toMatch(/NaN|Infinity/);
  });

  it('compte les vendors qui fournissent exactement un outil', () => {
    const result = buildVendorSummary([
      tool('A', 10, 1), tool('B', 10, 1), tool('C', 10, 1), tool('D', 10, 1), tool('D', 10, 1),
    ]);

    expect(result.vendor_insights.single_tool_vendors).toBe(3);
  });

  it('départage les égalités par ordre alphabétique (coût et efficacité)', () => {
    const efficient = buildVendorSummary([tool('Zeta', 100, 10), tool('Alpha', 100, 10)]);
    expect(efficient.vendor_insights.most_efficient_vendor).toBe('Alpha');
    expect(efficient.vendor_insights.most_expensive_vendor).toBe('Alpha');
    expect(efficient.data.map((d) => d.vendor)).toEqual(['Alpha', 'Zeta']);
  });

  it('trie les vendors par coût décroissant', () => {
    const result = buildVendorSummary([tool('Z', 100, 10), tool('A', 100, 10), tool('M', 200, 10)]);

    expect(result.data.map((d) => d.vendor)).toEqual(['M', 'A', 'Z']);
  });

  it('gère une liste vide', () => {
    expect(buildVendorSummary([])).toEqual({
      data: [],
      vendor_insights: { most_expensive_vendor: null, most_efficient_vendor: null, single_tool_vendors: 0 },
    });
  });

  it('reproduit les valeurs attendues du test e2e', () => {
    const result = buildVendorSummary([
      tool('Google', 100, 30, 'Engineering'),
      tool('Google', 80, 20, 'Sales'),
      tool('Google', 40, 10, 'Marketing'),
      tool('Google', 14.5, 7, 'Engineering'),
      tool('BigCorp', 300, 10, 'Sales'),
      tool('Atlassian', 50, 5, 'Engineering'),
      tool('Atlassian', 30, 5, 'Design'),
      tool('Ghosty', 40, 0, 'HR'),
      tool('Mid Vendor', 150, 10, 'Finance'),
    ]);

    expect(result.data).toEqual([
      { vendor: 'BigCorp', tools_count: 1, total_monthly_cost: 300, total_users: 10, departments: 'Sales', average_cost_per_user: 30, vendor_efficiency: 'poor' },
      { vendor: 'Google', tools_count: 4, total_monthly_cost: 234.5, total_users: 67, departments: 'Engineering,Marketing,Sales', average_cost_per_user: 3.5, vendor_efficiency: 'excellent' },
      { vendor: 'Mid Vendor', tools_count: 1, total_monthly_cost: 150, total_users: 10, departments: 'Finance', average_cost_per_user: 15, vendor_efficiency: 'average' },
      { vendor: 'Atlassian', tools_count: 2, total_monthly_cost: 80, total_users: 10, departments: 'Design,Engineering', average_cost_per_user: 8, vendor_efficiency: 'good' },
      { vendor: 'Ghosty', tools_count: 1, total_monthly_cost: 40, total_users: 0, departments: 'HR', average_cost_per_user: null, vendor_efficiency: 'poor' },
    ]);
    expect(result.vendor_insights).toEqual({
      most_expensive_vendor: 'BigCorp', most_efficient_vendor: 'Google', single_tool_vendors: 3,
    });
  });
});