import { supabase } from '@/integrations/supabase/client';
import { Simulado, Questao, ResultadoSimulado } from '@/types/simulado';
import { Logger } from '@/utils/logger';

export const simuladosApi = {
  async listarSimulados(userIesId?: string): Promise<Simulado[]> {
    // Obter data/hora atual em UTC para comparar com timestamps do banco
    const agoraISO = new Date().toISOString();

    // Buscar simulados que:
    // 1. Estão ativos OU aguardando (simulados agendados que devem aparecer quando a hora chegar)
    // 2. Já foram liberados (data_liberacao <= agora) OU não têm data de liberação
    // 3. Ainda não encerraram (data_encerramento >= agora) OU não têm data de encerramento
    // 4. NÃO estão encerrados (status != 'encerrado')
    const { data, error } = await supabase
      .from('simulados_admin')
      .select('*')
      .neq('status', 'encerrado') // Excluir encerrados
      .order('data_liberacao', { ascending: false });

    if (error) throw error;

    // Filtrar no cliente para garantir lógica correta de datas
    const agoraDt = new Date(agoraISO);
    const simuladosDisponiveis = (data || []).filter(s => {
      // Verificar se já foi liberado
      const liberado = !s.data_liberacao || new Date(s.data_liberacao) <= agoraDt;
      
      // Verificar se ainda não encerrou
      const naoEncerrado = !s.data_encerramento || new Date(s.data_encerramento) >= agoraDt;
      
      return liberado && naoEncerrado;
    });

    const idsStr = simuladosDisponiveis.map(s => s.id);
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

    // Filter by IES when provided (important for impersonation & regular students)
    const simuladosFiltradosPorIes = userIesId
      ? simuladosDisponiveis.filter(s => Array.isArray(s.ies_ids) && s.ies_ids.includes(userIesId))
      : simuladosDisponiveis;

    return simuladosFiltradosPorIes.map(s => ({
      id: s.id,
      titulo: s.nome || `Simulado ${s.id}`,
      descricao: s.descricao,
      duracao_minutos: s.duracao_minutos,
      numero_questoes: countsBySimulado[String(s.id)] ?? 0,
      status: 'disponivel' as const,
      data_liberacao: s.data_liberacao,
      data_encerramento: s.data_encerramento,
      tema: 'Geral',
      professor: 'Equipe Sanarflix',
      liberacao_desempenho: (s as any).liberacao_desempenho || 'imediato',
      data_liberacao_desempenho: (s as any).data_liberacao_desempenho || null
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

  async buscarDadosSimulado(simuladoId: string): Promise<{ 
    titulo: string; 
    dataEncerramento: string | null;
    duracaoMinutos: number;
  }> {
    const { data, error } = await supabase
      .from('simulados_admin')
      .select('nome, data_encerramento, duracao_minutos')
      .eq('id', simuladoId)
      .single();

    if (error) throw error;
    return {
      titulo: data?.nome || '',
      dataEncerramento: data?.data_encerramento || null,
      duracaoMinutos: data?.duracao_minutos || 180
    };
  },

  async buscarQuestoesSimulado(simuladoId: string | number): Promise<Questao[]> {
    const { data, error } = await supabase
      .from('questoes_simulado')
      .select('*')
      .eq('simulado_id', String(simuladoId))
      .order('ordem', { ascending: true });

    if (error) throw error;

    const total = (data || []).length;
    const comImagem = (data || []).filter((q: any) => q.imagem).length;
    const comImagemComentario = (data || []).filter((q: any) => q.imagem_comentario).length;
    Logger.info('[simuladosApi] buscarQuestoesSimulado', {
      simuladoId: String(simuladoId),
      total,
      comImagem,
      comImagemComentario,
      primeirasImagens: (data || [])
        .filter((q: any) => q.imagem)
        .slice(0, 5)
        .map((q: any) => ({ ordem: q.ordem, id: q.id, imagem: q.imagem })),
    });

    return (data || []).map((q: any) => ({
      id: q.id,
      enunciado: q.enunciado || '',
      alternativa_a: q.alternativa_a || '',
      alternativa_b: q.alternativa_b || '',
      alternativa_c: q.alternativa_c || '',
      alternativa_d: q.alternativa_d || '',
      gabarito: (q.correta || 'A') as 'A' | 'B' | 'C' | 'D',
      imagem: q.imagem || undefined,
      imagem_2: (q as any).imagem_2 || undefined,
      imagem_comentario: q.imagem_comentario || undefined,
      tema: q.tema || 'Geral',
      especialidade: q.especialidade || 'Geral',
      subespecialidade: q.grande_area || 'Geral'
    }));
  },

  async enviarResultado(resultado: ResultadoSimulado): Promise<void> {
    const { data: userData } = await supabase.auth.getUser();
    if (!userData?.user) throw new Error('Usuário não autenticado');

    const { data, error } = await supabase.functions.invoke('corrigir-simulado', {
      body: {
        simulado_id: resultado.simulado_id,
        user_id: userData.user.id,
        respostas: resultado.respostas,
        tempo_total_segundos: resultado.tempo_total_segundos,
        saidas_de_aba: resultado.saidas_de_aba,
        saidas_de_fullscreen: resultado.saidas_de_fullscreen,
        finalizado_em: resultado.finalizado_em
      }
    });

    if (error) throw error;

    // Registro de finalização centralizado na Edge Function
    return data;
  },

  async verificarProgressoSimulado(userId: string, simuladoId: string): Promise<boolean> {
    // Buscar o registro mais recente (maior tentativa_numero)
    const { data, error } = await supabase
      .from('simulados_finalizados')
      .select('id, liberado_novamente, tentativa_numero')
      .eq('user_id', userId)
      .eq('simulado_id', simuladoId)
      .order('tentativa_numero', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) throw error;
    
    // Retorna true se existe registro E não foi liberado novamente (simulado bloqueado)
    return data !== null && !data.liberado_novamente;
  }
};
