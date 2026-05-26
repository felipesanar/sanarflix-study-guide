/**
 * Tipos extraídos de useHomeData.ts (decomposição do god file 667 linhas).
 *
 * Estratégia: tipos puros vivem aqui; hooks domain-específicos consumem.
 */

export interface MeuDiaItem {
  id: string;
  type: 'guia' | 'intensivo' | 'simulado' | 'materia';
  title: string;
  subtitle?: string;
  /** caminho principal (ex.: guia com matéria pré-selecionada) */
  path: string;
  icon: string;
  color: string;
  /** Link direto para aula sugerida (caso exista) */
  lessonLink?: string;
  /** Origem dos dados: calendário pessoal ou cronograma ENAMED */
  source?: 'calendar' | 'cronograma_enamed' | 'fallback';
  /** Metadados para deep linking */
  aulaId?: string;
  aulaNome?: string;
  temaNome?: string;
  subtemaNome?: string;
}

export interface RankingData {
  simuladoRank?: number;
  simuladoTotal?: number;
  conteudoRank?: number;
  conteudoTotal?: number;
}

export interface SimuladoPerformance {
  ultimo?: {
    nome: string;
    acertos: number;
    total: number;
    data: string;
  };
}

export interface TopAula {
  id: string;
  title: string;
  link: string;
  tipo: 'videos' | 'questoes';
}

export interface HomeDataSnapshot {
  meuDia: MeuDiaItem[];
  ranking: RankingData;
  simulados: SimuladoPerformance;
  topAulas: TopAula[];
  timestamp?: number;
}
