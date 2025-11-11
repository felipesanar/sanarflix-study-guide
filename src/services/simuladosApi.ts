import { supabase } from '@/integrations/supabase/client';
import { Simulado, Questao, ResultadoSimulado } from '@/types/simulado';

export const simuladosApi = {
  async listarSimulados(iesId: string): Promise<Simulado[]> {
    const { data, error } = await supabase
      .from('Simulados')
      .select('*')
      .order('id', { ascending: true });

    if (error) throw error;

    // Transformar dados para o formato esperado
    return (data || []).map(s => ({
      id: s.id,
      titulo: s.Simulado || `Simulado ${s.id}`,
      descricao: `Simulado completo com questões objetivas`,
      duracao_minutos: 240, // 4 horas padrão
      numero_questoes: 120, // padrão ENAMED
      status: 'disponivel' as const,
      data_liberacao: new Date().toISOString(),
      tema: 'Geral',
      professor: 'Equipe Sanarflix'
    }));
  },

  async buscarQuestoesSimulado(simuladoId: number): Promise<Questao[]> {
    const { data, error } = await supabase
      .from('questions_enamed')
      .select(`
        *,
        questions_enamed_complement!inner(*)
      `)
      .limit(120);

    if (error) throw error;

    return (data || []).map(q => ({
      id: q.ID,
      enunciado: (q as any).questions_enamed_complement?.ENUNCIADO || '',
      alternativa_a: (q as any).questions_enamed_complement?.A || '',
      alternativa_b: (q as any).questions_enamed_complement?.B || '',
      alternativa_c: (q as any).questions_enamed_complement?.C || '',
      alternativa_d: (q as any).questions_enamed_complement?.D || '',
      gabarito: ((q as any).questions_enamed_complement?.gabarito || 'A') as 'A' | 'B' | 'C' | 'D',
      imagem: (q as any).questions_enamed_complement?.IMAGEM,
      tema: q['Tema (Grande Área)'] || 'Geral',
      especialidade: q.Especialidade || 'Geral',
      subespecialidade: q['Subespecialidade / Assunto Principal'] || 'Geral',
      dificuldade: (q['NÍVEL DE DIFICULDADE'] || 'Médio') as 'Fácil' | 'Médio' | 'Difícil'
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

  async verificarProgressoSimulado(userId: string, simuladoId: number): Promise<boolean> {
    const { data, error } = await supabase
      .from('answer_progress_enamed')
      .select('email')
      .eq('email', userId)
      .eq('simulado', simuladoId)
      .limit(1);

    if (error) throw error;
    return (data || []).length > 0;
  }
};
