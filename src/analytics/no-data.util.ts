export const NO_DATA_MESSAGE = 'No analytics data available - ensure tools data exists';

/**
 * Ajoute le message "aucune donnée" à une réponse analytics quand il n'existe aucun outil actif.
 * `data` est alors vide (la fonction de calcul a reçu une liste vide) et le message suit `data`.
 * Quand des outils existent mais qu'un filtre n'en retient aucun, on ne passe pas par ici :
 * ce n'est pas une absence de données.
 */
export function withNoDataNotice<T extends { data: unknown[] }>(result: T, isEmpty: boolean): T & { message?: string } {
  if (!isEmpty) return result;
  const { data, ...rest } = result;
  return { data, message: NO_DATA_MESSAGE, ...rest } as unknown as T & { message?: string };
}