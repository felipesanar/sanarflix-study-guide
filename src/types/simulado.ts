export interface Simulado {
  id: string;
  titulo: string;
  descricao: string;
  duracao_minutos: number;
  numero_questoes: number;
  status: 'disponivel' | 'em_andamento' | 'concluido' | 'encerrado';
  data_liberacao: string;
  data_encerramento?: string | null;
  tema?: string;
  professor?: string;
  liberacao_desempenho?: 'imediato' | 'agendado' | 'ao_encerrar';
  data_liberacao_desempenho?: string | null;
  desempenho_liberado?: boolean;
}

export interface Questao {
  id: string;
  enunciado: string;
  alternativa_a: string;
  alternativa_b: string;
  alternativa_c: string;
  alternativa_d: string;
  gabarito: 'A' | 'B' | 'C' | 'D';
  imagem?: string;
  tema: string;
  especialidade: string;
  subespecialidade: string;
  dificuldade: 'Fácil' | 'Médio' | 'Difícil';
}

export interface RespostaSimulado {
  questao_id: string;
  resposta: 'A' | 'B' | 'C' | 'D' | null;
  marcada_revisao: boolean;
  alternativas_eliminadas: ('A' | 'B' | 'C' | 'D')[];
  respondida?: boolean;
}

export interface EstadoSimulado {
  simulado_id: string;
  questao_atual: number;
  tempo_restante_segundos: number;
  respostas: Record<string, RespostaSimulado>;
  saidas_de_aba: number;
  saidas_de_fullscreen: number;
  iniciado_em: string;
  deadline_efetivo: string;
  ultima_atualizacao: string;
}

export interface ResultadoSimulado {
  simulado_id: string;
  user_id: string;
  respostas: RespostaSimulado[];
  tempo_total_segundos: number;
  saidas_de_aba: number;
  saidas_de_fullscreen: number;
  finalizado_em: string;
  auto_finalizado?: boolean;
}
