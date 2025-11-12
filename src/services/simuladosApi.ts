import { supabase } from '@/integrations/supabase/client';
import { Simulado, Questao, ResultadoSimulado } from '@/types/simulado';

export const simuladosApi = {
  async listarSimulados(iesId: string): Promise<Simulado[]> {
    const { data, error } = await supabase
      .from('simulados_admin')
      .select('*')
      .order('id', { ascending: true });

    if (error) throw error;

    const idsStr = (data || [])
      .map(s => String(s.id))
      .filter(id => !!id);
    let countsBySimulado: Record<string, number> = {};

    if (idsStr.length > 0) {
      const { data: qsData, error: qsError } = await supabase
        .from('questoes_simulado')
        .select('simulado_id')
        .in('simulado_id', idsStr);

      if (!qsError && qsData) {
        countsBySimulado = qsData.reduce((acc: Record<string, number>, row: any) => {
          const key = String(row.simulado_id);
          acc[key] = (acc[key] || 0) + 1;
          return acc;
        }, {});
      }
    }

    return (data || []).map(s => ({
      id: s.id,
      titulo: s.nome || `Simulado ${s.id}`,
      descricao: s.descricao,
      duracao_minutos: s.duracao_minutos,
      numero_questoes: countsBySimulado[String(s.id)] ?? 0,
      status: 'disponivel' as const,
      data_liberacao: s.data_liberacao,
      tema: 'Geral',
      professor: 'Equipe Sanarflix'
    }));
  },

  async buscarQuestoesSimulado(simuladoId: string | number): Promise<Questao[]> {
    const { data, error } = await supabase
      .from('questoes_simulado')
      .select('*')
      .eq('simulado_id', String(simuladoId))
      .order('ordem', { ascending: true });

    if (error) throw error;

    return (data || []).map((q: any) => ({
      id: q.id,
      enunciado: q.enunciado || '',
      alternativa_a: q.alternativa_a || '',
      alternativa_b: q.alternativa_b || '',
      alternativa_c: q.alternativa_c || '',
      alternativa_d: q.alternativa_d || '',
      gabarito: (q.correta || 'A') as 'A' | 'B' | 'C' | 'D',
      imagem: q.imagem || undefined,
      tema: 'Geral',
      especialidade: 'Geral',
      subespecialidade: 'Geral',
      dificuldade: 'Médio'
    }));
  },

  async enviarResultado(resultado: ResultadoSimulado): Promise<void> {
    const { error } = await supabase
      .from('answer_progress_enamed')
      .insert(
        resultado.respostas.map(r => ({
          email: resultado.user_id,
          simulado: resultado.simulado_id,
          question_id: r.questao_id,
          answer_id: crypto.randomUUID(),
          correct: false // será calculado pelo backend
        }))
      );

    if (error) throw error;
  },

  async verificarProgressoSimulado(userId: string, simuladoId: string): Promise<boolean> {
    return false;
  }
};
