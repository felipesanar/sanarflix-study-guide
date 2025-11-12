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
}

interface CorrecaoRequest {
  simulado_id: string;
  user_id: string;
  respostas: RespostaSimulado[];
  tempo_total_segundos: number;
  saidas_de_aba: number;
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

    const { simulado_id, user_id, respostas, tempo_total_segundos, saidas_de_aba }: CorrecaoRequest = await req.json();

    console.log(`Processando correção do simulado ${simulado_id} para usuário ${user_id}`);
    console.log(`Total de respostas: ${respostas.length}`);

    // Buscar o ID numérico do simulado na tabela simulados_admin
    const { data: simuladoData, error: simuladoError } = await supabaseClient
      .from('simulados_admin')
      .select('id')
      .eq('id', simulado_id)
      .single();

    if (simuladoError || !simuladoData) {
      console.error('Erro ao buscar simulado:', simuladoError);
      throw new Error('Simulado não encontrado');
    }

    // Converter UUID para hash numérico estável dentro do range de integer
    const simuladoNumerico = Math.abs(simulado_id.split('-').reduce((acc: number, part: string) => {
      return acc + parseInt(part, 16);
    }, 0)) % 2147483647;

    console.log(`ID numérico do simulado: ${simuladoNumerico}`);

    // Buscar os gabaritos das questões respondidas
    const questaoIds = respostas
      .filter(r => r.resposta !== null)
      .map(r => r.questao_id);

    const { data: questoes, error: questoesError } = await supabaseClient
      .from('questoes_simulado')
      .select('id, correta')
      .in('id', questaoIds);

    if (questoesError) {
      console.error('Erro ao buscar gabaritos:', questoesError);
      throw questoesError;
    }

    // Criar mapa de gabaritos
    const gabaritos = new Map(questoes?.map(q => [q.id, q.correta]) || []);

    // Calcular se cada resposta está correta
    const respostasParaSalvar = respostas
      .filter(r => r.resposta !== null)
      .map(r => ({
        email: user_id,
        simulado: simuladoNumerico,
        question_id: r.questao_id,
        resposta_usuario: r.resposta,
        answer_id: crypto.randomUUID(),
        correct: gabaritos.get(r.questao_id) === r.resposta
      }));

    console.log(`Inserindo ${respostasParaSalvar.length} respostas corrigidas`);

    // Inserir respostas corrigidas
    const { error: insertError } = await supabaseClient
      .from('answer_progress_enamed')
      .insert(respostasParaSalvar);

    if (insertError) {
      console.error('Erro ao inserir respostas:', insertError);
      throw insertError;
    }

    const acertos = respostasParaSalvar.filter(r => r.correct).length;
    const total = respostasParaSalvar.length;

    console.log(`Correção concluída: ${acertos}/${total} acertos`);
    console.log(`Tempo total: ${tempo_total_segundos}s, Saídas de aba: ${saidas_de_aba}`);

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
