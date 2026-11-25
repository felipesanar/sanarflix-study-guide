/** Leitura de cartões pelo Academy (tabelas `cartao_leituras` e `cartao_leitura_paginas`). */

export type StatusLeitura = 'enviado' | 'processando' | 'concluido' | 'falhou' | 'importado';

export interface ResumoLeitura {
  paginas: number;
  identificadas: number;
  nao_identificadas: number;
  genericos?: number;
  em_branco: number;
  ilegiveis: number;
  simulado_divergente: number;
  pendencias: number;
  [k: string]: unknown;
}

export interface Leitura {
  id: string;
  simulado_id: string;
  arquivo_nome: string;
  arquivo_bytes: number | null;
  total_questoes: number;
  status: StatusLeitura;
  criado_por: string;
  created_at: string;
  disparado_em: string | null;
  iniciado_em: string | null;
  concluido_em: string | null;
  github_run_url: string | null;
  erro: string | null;
  resumo: ResumoLeitura | null;
  import_batch_id: string | null;
  importado_em: string | null;
}

export interface PendenciaLida {
  tipo: string;
  detalhe: string;
  questao: number | null;
  /** Caminho no bucket `cartoes-leitura`. */
  recorte: string | null;
}

export type Destino = 'respostas' | 'nao_identificados' | 'ignorada';

export interface PaginaLeitura {
  id: string;
  leitura_id: string;
  pagina: number;
  destino: Destino;
  status: string;
  layout: string | null;
  identificacao: string | null;
  via: string | null;
  motivo: string;
  respostas: Record<string, string | null>;
  duvidas: Record<string, 'multipla' | 'ambigua'>;
  pendencias: PendenciaLida[];
  /** Página inteira (caminho no bucket), só nas que vão à revisão. */
  imagem: string | null;
  identificacao_manual: string | null;
  /** Respostas decididas na revisão; `null` = em branco. Valem mais que as lidas. */
  respostas_manual: Record<string, string | null>;
  descartada: boolean;
  revisado_por: string | null;
  revisado_em: string | null;
}

export type RevisaoPatch = Partial<Pick<PaginaLeitura, 'identificacao_manual' | 'respostas_manual' | 'descartada'>>;
