const STUDY_GUIDE_API_BASE_URL = 'https://gvqvrmkizemwsasmupmo.functions.supabase.co/study-guide-proxy';

export interface ApiAula {
  id: string;
  nome: string;
  video?: string;
  pdf?: string;
  quiz?: string;
}

export interface ApiSubtema {
  id: string;
  nome: string;
  aulas: ApiAula[];
}

export interface ApiTema {
  id: string;
  nome: string;
  subtemas: ApiSubtema[];
}

export interface ApiMateria {
  id: string;
  nome: string;
  temas: ApiTema[];
}

export interface ApiSemestre {
  id: string;
  numero: number;
  materias: ApiMateria[];
}

export interface ApiIES {
  id: string;
  nome: string;
  semestres: ApiSemestre[];
}

export interface StudyGuideData {
  ies: ApiIES[];
}

// Remote API shapes
interface RemoteAula {
  nome: string;
  link_aula?: string | null;
  link_pdf?: string | null;
  link_quiz?: string | null;
}
interface RemoteSubtema {
  subtema: string;
  aulas: RemoteAula[];
}
interface RemoteTema {
  tema: string;
  subtemas: RemoteSubtema[];
}
interface RemoteMateria {
  materia: string;
  temas: RemoteTema[];
}
interface IESResponse {
  [iesName: string]: {
    [semestre: string]: RemoteMateria[];
  };
}

const slugify = (s: string) =>
  s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');

async function fetchJsonFromHtml(url: string): Promise<any> {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to fetch: ${response.status}`);
  }
  const text = await response.text();
  try {
    // Some endpoints may return pure JSON
    return JSON.parse(text);
  } catch {
    // Most endpoints return HTML wrapping the JSON in the body
    const match = text.match(/[\{\[][\s\S]*[\}\]]/);
    if (match) return JSON.parse(match[0]);
    throw new Error('Invalid API response format');
  }
}

function toApiMaterias(materias: RemoteMateria[]): ApiMateria[] {
  return materias.map((m, mi) => ({
    id: `${slugify(m.materia)}-${mi}`,
    nome: m.materia,
    temas: (m.temas || []).map((t, ti) => ({
      id: `${slugify(m.materia)}-${slugify(t.tema)}-${ti}`,
      nome: t.tema,
      subtemas: (t.subtemas || []).map((st, si) => ({
        id: `${slugify(m.materia)}-${slugify(t.tema)}-${slugify(st.subtema)}-${si}`,
        nome: st.subtema,
        aulas: (st.aulas || []).map((a, ai) => ({
          id: `${slugify(m.materia)}-${slugify(t.tema)}-${slugify(st.subtema)}-${slugify(a.nome)}-${ai}`,
          nome: a.nome,
          video: a.link_aula || undefined,
          pdf: a.link_pdf || undefined,
          quiz: a.link_quiz || undefined,
        })),
      })),
    })),
  }));
}

export const studyGuideApi = {
  // Lista os semestres disponíveis para uma IES pelo NOME (não por ID)
  async getSemestresByIES(iesName: string): Promise<ApiSemestre[]> {
    try {
      const safeName = encodeURIComponent((iesName || '').trim());
      const data: IESResponse = await fetchJsonFromHtml(`${STUDY_GUIDE_API_BASE_URL}/${safeName}`);
      const topKey = Object.keys(data)[0];
      const iesKey = (data as any)[decodeURIComponent(safeName)] ? decodeURIComponent(safeName) : topKey;
      const semestresKeys = Object.keys((data as any)[iesKey] || {});
      const numeros = semestresKeys
        .map((k) => parseInt(k, 10))
        .filter((n) => !Number.isNaN(n))
        .sort((a, b) => a - b);
      return numeros.map((numero) => ({ id: `${iesKey}-${numero}`, numero, materias: [] }));
    } catch (error) {
      throw error;
    }
  },

  // Retorna as matérias para uma IES (NOME) e semestre (número)
  async getMateriasBySemestre(iesName: string, semestreNumero: number): Promise<ApiMateria[]> {
    try {
      const safeName = encodeURIComponent((iesName || '').trim());
      const url = `${STUDY_GUIDE_API_BASE_URL}/${safeName}/${semestreNumero}`;
      const data: IESResponse = await fetchJsonFromHtml(url);
      const topKey = Object.keys(data)[0];
      const iesKey = (data as any)[decodeURIComponent(safeName)] ? decodeURIComponent(safeName) : topKey;
      const raw = (data as any)[iesKey]?.[String(semestreNumero)] || [];
      return toApiMaterias(raw as RemoteMateria[]);
    } catch (error) {
      throw error;
    }
  },
};