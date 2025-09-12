const CRONOGRAMA_API_URL = 'https://gvqvrmkizemwsasmupmo.supabase.co/functions/v1/cronograma-enamed-proxy';

export interface CronogramaEnamedItem {
  id: string;
  titulo: string;
  descricao: string;
  area_conhecimento: string;
  data_aula?: string;
  link_aula?: string;
  link_gratuito?: string;
}

function toStringSafe(v: any): string | undefined {
  if (v == null) return undefined;
  if (typeof v === 'string') return v;
  return String(v);
}

function normalizeItem(raw: any, idx: number): CronogramaEnamedItem | null {
  const titulo = toStringSafe(raw?.titulo) || toStringSafe(raw?.title) || toStringSafe(raw?.nome) || toStringSafe(raw?.name);
  if (!titulo) return null;

  const id = toStringSafe(raw?.id) || toStringSafe(raw?._id) || `${titulo}-${idx}`;
  const descricao = toStringSafe(raw?.descricao) || toStringSafe(raw?.description) || toStringSafe(raw?.resumo) || '';
  const area = toStringSafe(raw?.area_conhecimento) || toStringSafe(raw?.area) || toStringSafe(raw?.disciplina) || 'Outros';
  const data_aula = toStringSafe(raw?.data_aula) || toStringSafe(raw?.data) || toStringSafe(raw?.date);
  const link_aula = toStringSafe(raw?.link_aula) || toStringSafe(raw?.url_aula) || toStringSafe(raw?.url) || toStringSafe(raw?.link);
  const link_gratuito = toStringSafe(raw?.link_gratuito) || toStringSafe(raw?.link_free) || toStringSafe(raw?.free_url);

  return { id: id!, titulo, descricao: descricao || '', area_conhecimento: area || 'Outros', data_aula, link_aula, link_gratuito };
}

function deepExtractItems(input: any): CronogramaEnamedItem[] {
  const result: CronogramaEnamedItem[] = [];

  const visit = (node: any) => {
    if (!node) return;
    if (Array.isArray(node)) {
      node.forEach((n, i) => visit(n));
      return;
    }
    if (typeof node === 'object') {
      // Direct aula arrays by common keys
      const possibleArrays = ['aulas', 'items', 'conteudos', 'data', 'lessons', 'conteudo'];
      for (const key of possibleArrays) {
        const val = (node as any)[key];
        if (Array.isArray(val)) {
          val.forEach((it, i) => {
            const n = normalizeItem(it, i);
            if (n) result.push(n);
            else visit(it);
          });
        }
      }

      // If object itself looks like an item
      const asItem = normalizeItem(node, result.length);
      if (asItem) {
        result.push(asItem);
      }

      // Recurse into children
      for (const [k, v] of Object.entries(node)) {
        if (v && typeof v === 'object') visit(v);
      }
    }
  };

  visit(input);

  // Deduplicate by id
  const seen = new Set<string>();
  const deduped: CronogramaEnamedItem[] = [];
  for (const it of result) {
    if (!seen.has(it.id)) {
      seen.add(it.id);
      deduped.push(it);
    }
  }
  return deduped;
}

export const cronogramaEnamedApi = {
  async getAllContent(): Promise<CronogramaEnamedItem[]> {
    try {
      const response = await fetch(CRONOGRAMA_API_URL);
      if (!response.ok) {
        throw new Error('Failed to fetch cronograma content');
      }
      const data = await response.json();

      // Common shapes
      if (Array.isArray(data)) {
        const items = deepExtractItems(data);
        return items.length ? items : [];
      }
      if (data?.data) {
        const base = Array.isArray(data.data) ? data.data : data.data?.items || data.data?.aulas || data.data;
        const items = deepExtractItems(base ?? data);
        return items.length ? items : [];
      }

      // Fallback deep extraction
      const items = deepExtractItems(data);
      return items.length ? items : [];
    } catch (error) {
      // On error, return empty to keep UI stable
      return [];
    }
  }
};