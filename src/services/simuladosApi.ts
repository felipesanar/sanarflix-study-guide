import { supabase } from '@/integrations/supabase/client';
import { Simulado, Questao, ResultadoSimulado } from '@/types/simulado';

export const simuladosApi = {
  async listarSimulados(): Promise<Simulado[]> {
    const { data, error } = await supabase
      .from('simulados_admin')
      .select('*')
      .eq('status', 'ativo')
      .order('data_liberacao', { ascending: false });

    if (error) throw error;

    const idsStr = (data || []).map(s => s.id);
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

  async buscarTituloSimulado(simuladoId: string): Promise<string> {
    const { data, error } = await supabase
      .from('simulados_admin')
      .select('nome')
      .eq('id', simuladoId)
      .single();

    if (error) throw error;
    return data?.nome || '';
  },

  async buscarDadosSimulado(simuladoId: string): Promise<{ titulo: string; duracao: number }> {
    const { data, error } = await supabase
      .from('simulados_admin')
      .select('nome, duracao_minutos')
      .eq('id', simuladoId)
      .single();

    if (error) throw error;
    return {
      titulo: data?.nome || '',
      duracao: data?.duracao_minutos || 120
    };
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
      tema: q.tema || 'Geral',
      especialidade: q.especialidade || 'Geral',
      subespecialidade: q.grande_area || 'Geral',
      dificuldade: q.grau_dificuldade || 'Médio'
    }));
  },

  async enviarResultado(resultado: ResultadoSimulado): Promise<void> {
    const { data, error } = await supabase.functions.invoke('corrigir-simulado', {
      body: {
        simulado_id: resultado.simulado_id,
        user_id: resultado.user_id,
        respostas: resultado.respostas,
        tempo_total_segundos: resultado.tempo_total_segundos,
        saidas_de_aba: resultado.saidas_de_aba
      }
    });

    if (error) throw error;

    // Registrar finalização
    const { data: userData } = await supabase.auth.getUser();
    if (userData?.user) {
      await supabase
        .from('simulados_finalizados')
        .insert({
          user_id: userData.user.id,
          simulado_id: resultado.simulado_id,
          tempo_total_segundos: resultado.tempo_total_segundos,
          saidas_de_aba: resultado.saidas_de_aba
        });
    }

    return data;
  },

  async verificarProgressoSimulado(userId: string, simuladoId: string): Promise<boolean> {
    const { data, error } = await supabase
      .from('simulados_finalizados')
      .select('id, liberado_novamente')
      .eq('user_id', userId)
      .eq('simulado_id', simuladoId)
      .maybeSingle();

    if (error) throw error;
    
    // Retorna true se o simulado foi finalizado E não foi liberado novamente
    return data !== null && !data.liberado_novamente;
  }
};
