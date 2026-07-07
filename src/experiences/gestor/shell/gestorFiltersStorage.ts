/**
 * Persistência do último recorte (IES + simulado) usado pelo gestor, por
 * usuário — evita flash de "Selecione um simulado" e faz o console reabrir
 * no mesmo contexto da última visita.
 *
 * Precedência de resolução (ver GestorFiltersProvider): querystring > este
 * cache > default (id_ies / accessibleIes[0] / simulado mais recente).
 */

const STORAGE_PREFIX = 'gestor.lastFilters.';

export interface PersistedGestorFilters {
  iesId: string;
  simuladoId: string;
}

const keyFor = (userId: string): string => `${STORAGE_PREFIX}${userId}`;

/** Lê o último {iesId, simuladoId} salvo para este usuário. `null` se ausente/corrompido. */
export function readPersistedFilters(userId: string | undefined): PersistedGestorFilters | null {
  if (!userId || typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(keyFor(userId));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<PersistedGestorFilters>;
    if (typeof parsed.iesId !== 'string' || typeof parsed.simuladoId !== 'string') return null;
    return { iesId: parsed.iesId, simuladoId: parsed.simuladoId };
  } catch {
    return null;
  }
}

/** Salva o recorte atual para este usuário (best-effort — falha silenciosa). */
export function writePersistedFilters(userId: string | undefined, filters: PersistedGestorFilters): void {
  if (!userId || typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(keyFor(userId), JSON.stringify(filters));
  } catch {
    // localStorage indisponível (modo privado, quota etc.) — não é crítico.
  }
}
