const byName = (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0);

/**
 * Répartit 100 % entre des montants (en centimes) avec une précision de 0,1 point,
 * par la méthode du plus fort reste : la somme vaut exactement 100 % (1000 dixièmes),
 * ou 0 si le total est nul. Renvoie des dixièmes de point (650 = 65.0 %).
 * En cas d'égalité sur le reste, l'ordre alphabétique de `names` départage.
 */
export function allocatePercentTenths(cents: number[], names: string[]): number[] {
  const total = cents.reduce((sum, c) => sum + c, 0);
  if (total <= 0) return cents.map(() => 0);

  const exact = cents.map((c) => (c * 1000) / total);
  const tenths = exact.map((e) => Math.floor(e));
  const remaining = 1000 - tenths.reduce((sum, t) => sum + t, 0);

  exact
    .map((e, idx) => ({ idx, fraction: e - Math.floor(e) }))
    .sort((a, b) => b.fraction - a.fraction || byName(names[a.idx], names[b.idx]))
    .slice(0, remaining)
    .forEach(({ idx }) => tenths[idx]++);

  return tenths;
}