/** Tipos compartilhados entre LiberacoesTab e seus subcomponentes (fatia C2). */
export interface FinalizacaoRow {
  id: string;
  user_id: string;
  simulado_id: string;
  finalizado_em: string;
  tempo_total_segundos: number;
  saidas_de_aba: number;
  saidas_de_fullscreen: number;
  liberado_novamente: boolean;
  liberado_em: string | null;
  liberado_por: string | null;
  tentativa_numero: number;
  user_email?: string;
  user_nome?: string;
  simulado_nome?: string;
}

export interface SimuladoOption {
  id: string;
  nome: string;
}
