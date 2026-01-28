import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface RespostaSimulado {
  questao_id: string;
  resposta: 'A' | 'B' | 'C' | 'D' | null;
  marcada_revisao: boolean;
  alternativas_eliminadas: ('A' | 'B' | 'C' | 'D')[];
  respondida?: boolean;
}

interface CorrecaoRequest {
  simulado_id: string;
  user_id: string;
  respostas: RespostaSimulado[];
  tempo_total_segundos: number;
  saidas_de_aba: number;
  saidas_de_fullscreen?: number;
}

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        global: {
          headers: { Authorization: req.headers.get('Authorization')! },
        },
      }
    );

    const { simulado_id, user_id, respostas, tempo_total_segundos, saidas_de_aba, saidas_de_fullscreen }: CorrecaoRequest = await req.json();

    console.log(`Processando correção do simulado: ${simulado_id} para usuário: ${user_id}`);

    // IDEMPOTÊNCIA: Verificar se já existem respostas para este simulado/usuário
    const { data: existingAnswers, error: checkError } = await supabaseClient
      .from('answer_progress')
      .select('answer_id')
      .eq('user_id', user_id)
      .eq('simulado', simulado_id)
      .limit(1);

    if (checkError) {
      console.error('Erro ao verificar respostas existentes:', checkError);
    }

    if (existingAnswers && existingAnswers.length > 0) {
      console.log(`Simulado ${simulado_id} já processado para usuário ${user_id}. Ignorando requisição duplicada.`);
      return new Response(
        JSON.stringify({ 
          message: 'Simulado já foi processado anteriormente', 
          already_processed: true 
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
      );
    }

    // Buscar os gabaritos E status de anulação de TODAS as questões
    const questaoIds = respostas.map(r => r.questao_id);

    const { data: questoes, error: questoesError } = await supabaseClient
      .from('questoes_simulado')
      .select('id, correta, anulada')
      .in('id', questaoIds);

    if (questoesError) {
      console.error('Erro ao buscar gabaritos:', questoesError);
      throw questoesError;
    }

    // Criar mapa de gabaritos e status de anulação
    const gabaritos = new Map(questoes?.map(q => [q.id, { correta: q.correta, anulada: q.anulada }]) || []);

    // Processar TODAS as questões (respondidas e não respondidas)
    // Questões anuladas são sempre contabilizadas como corretas
    const respostasParaSalvar = respostas.map(r => {
      const questaoInfo = gabaritos.get(r.questao_id);
      const isAnulada = questaoInfo?.anulada === true;
      const gabarito = questaoInfo?.correta;
      
      return {
        user_id: user_id,
        simulado: simulado_id,
        question_id: r.questao_id,
        resposta_usuario: r.resposta,
        answer_id: crypto.randomUUID(),
        // Se a questão está anulada, sempre é correta; caso contrário, verifica gabarito
        correct: isAnulada ? true : (r.resposta !== null ? gabarito === r.resposta : false),
        'respondida?': r.respondida ?? (r.resposta !== null)
      };
    });

    console.log(`Total de questões a serem salvas: ${respostasParaSalvar.length}`);

    // Inserir respostas corrigidas
    const { error: insertError } = await supabaseClient
      .from('answer_progress')
      .insert(respostasParaSalvar);

    if (insertError) {
      console.error('Erro ao inserir respostas:', insertError);
      throw insertError;
    }

    const questoesRespondidas = respostasParaSalvar.filter(r => r['respondida?']);
    const acertos = questoesRespondidas.filter(r => r.correct).length;
    const total = questoesRespondidas.length;

    

    // Registrar simulado como finalizado
    const { error: finalizadoError } = await supabaseClient
      .from('simulados_finalizados')
      .insert({
        user_id: user_id,
        simulado_id: simulado_id,
        tempo_total_segundos,
        saidas_de_aba,
        saidas_de_fullscreen: saidas_de_fullscreen ?? 0
      });

    if (finalizadoError) {
      console.error('Erro ao registrar finalização:', finalizadoError);
      // Não bloquear o fluxo se falhar o registro
    }

    return new Response(
      JSON.stringify({
        message: 'Respostas enviadas com sucesso',
        total_questoes: total,
        tempo_total_segundos,
        saidas_de_aba
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );
  } catch (error) {
    console.error('Erro na correção do simulado:', error);
    return new Response(
      JSON.stringify({
        error: error.message || 'Erro ao processar correção do simulado'
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      }
    );
  }
});
