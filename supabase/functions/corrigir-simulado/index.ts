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
  finalizado_em?: string;
  auto_finalizado?: boolean;
}

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? '';
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
    
    // Cliente com token do usuário para operações com RLS
    const supabaseClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: {
        headers: { Authorization: req.headers.get('Authorization') || '' },
      },
    });

    // Cliente admin para operações que precisam bypassar RLS
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

    const { 
      simulado_id, 
      user_id, 
      respostas, 
      tempo_total_segundos, 
      saidas_de_aba, 
      saidas_de_fullscreen,
      finalizado_em,
      auto_finalizado 
    }: CorrecaoRequest = await req.json();

    console.log(`[corrigir-simulado] Processando simulado: ${simulado_id} para usuário: ${user_id}`);
    console.log(`[corrigir-simulado] Auto-finalizado: ${auto_finalizado ? 'SIM (sendBeacon)' : 'NÃO (botão)'}`);
    console.log(`[corrigir-simulado] Tempo total: ${tempo_total_segundos}s, Saídas aba: ${saidas_de_aba}, Saídas fullscreen: ${saidas_de_fullscreen ?? 0}`);

    // PASSO 1: Verificar se existe registro de finalização (e seu status de liberação)
    const { data: finalizacaoExistente, error: finalizacaoError } = await supabaseAdmin
      .from('simulados_finalizados')
      .select('id, liberado_novamente, tentativa_numero')
      .eq('user_id', user_id)
      .eq('simulado_id', simulado_id)
      .order('tentativa_numero', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (finalizacaoError) {
      console.error('[corrigir-simulado] Erro ao verificar finalização existente:', finalizacaoError);
    }

    console.log(`[corrigir-simulado] Finalização existente: ${finalizacaoExistente ? `ID=${finalizacaoExistente.id}, liberado_novamente=${finalizacaoExistente.liberado_novamente}, tentativa=${finalizacaoExistente.tentativa_numero}` : 'Nenhuma'}`);

    let proximaTentativa = 1;

    // PASSO 2: Se existe finalização E foi liberado novamente, mover respostas antigas para histórico
    if (finalizacaoExistente && finalizacaoExistente.liberado_novamente === true) {
      console.log(`[corrigir-simulado] Simulado foi liberado novamente. Movendo respostas antigas para histórico...`);
      
      proximaTentativa = (finalizacaoExistente.tentativa_numero || 1) + 1;
      
      // Buscar respostas antigas para mover para histórico
      const { data: respostasAntigas, error: fetchAnswersError } = await supabaseAdmin
        .from('answer_progress')
        .select('answer_id, user_id, simulado, question_id, resposta_usuario, correct, "respondida?"')
        .eq('user_id', user_id)
        .eq('simulado', simulado_id);

      if (fetchAnswersError) {
        console.error('[corrigir-simulado] Erro ao buscar respostas antigas:', fetchAnswersError);
        throw new Error('Falha ao buscar respostas anteriores');
      }

      if (respostasAntigas && respostasAntigas.length > 0) {
        // Inserir respostas antigas no histórico com referência à finalização original
        const respostasHistorico = respostasAntigas.map(r => ({
          answer_id: r.answer_id,
          user_id: r.user_id,
          simulado: r.simulado,
          question_id: r.question_id,
          resposta_usuario: r.resposta_usuario,
          correct: r.correct,
          'respondida?': r['respondida?'],
          finalizacao_original_id: finalizacaoExistente.id,
          substituida_em: new Date().toISOString()
        }));

        const { error: insertHistoricoError } = await supabaseAdmin
          .from('answer_progress_historico')
          .insert(respostasHistorico);

        if (insertHistoricoError) {
          console.error('[corrigir-simulado] Erro ao mover respostas para histórico:', insertHistoricoError);
          throw new Error('Falha ao arquivar respostas anteriores');
        }
        console.log(`[corrigir-simulado] ${respostasAntigas.length} respostas movidas para histórico.`);

        // Agora deletar as respostas antigas da tabela principal
        const { error: deleteAnswersError } = await supabaseAdmin
          .from('answer_progress')
          .delete()
          .eq('user_id', user_id)
          .eq('simulado', simulado_id);

        if (deleteAnswersError) {
          console.error('[corrigir-simulado] Erro ao limpar respostas antigas:', deleteAnswersError);
          throw new Error('Falha ao limpar respostas anteriores da tabela principal');
        }
        console.log(`[corrigir-simulado] Respostas antigas removidas da tabela principal.`);
      }

      // Atualizar o registro de finalização antigo para marcar como substituído (liberado_novamente = false)
      // Isso permite controle de histórico no admin
      const { error: updateFinalizacaoError } = await supabaseAdmin
        .from('simulados_finalizados')
        .update({ liberado_novamente: false })
        .eq('id', finalizacaoExistente.id);

      if (updateFinalizacaoError) {
        console.error('[corrigir-simulado] Erro ao atualizar finalização antiga:', updateFinalizacaoError);
      }
      console.log(`[corrigir-simulado] Registro de finalização antigo atualizado (liberado_novamente=false). Prosseguindo com tentativa ${proximaTentativa}...`);
    }
    // PASSO 3: Se existe finalização e NÃO foi liberado novamente, verificar idempotência
    else if (finalizacaoExistente && finalizacaoExistente.liberado_novamente === false) {
      // Verificar se existem respostas para confirmar que foi processado
      const { data: existingAnswers, error: checkError } = await supabaseAdmin
        .from('answer_progress')
        .select('answer_id')
        .eq('user_id', user_id)
        .eq('simulado', simulado_id)
        .limit(1);

      if (checkError) {
        console.error('[corrigir-simulado] Erro ao verificar respostas existentes:', checkError);
      }

      if (existingAnswers && existingAnswers.length > 0) {
        console.log(`[corrigir-simulado] Simulado ${simulado_id} já processado para usuário ${user_id}. Ignorando requisição duplicada.`);
        return new Response(
          JSON.stringify({ 
            message: 'Simulado já foi processado anteriormente', 
            already_processed: true 
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
        );
      }
      
      // Existe finalização mas não existem respostas - situação anômala, prosseguir mesmo assim
      console.log(`[corrigir-simulado] Finalização existe mas sem respostas. Situação anômala, prosseguindo...`);
      proximaTentativa = (finalizacaoExistente.tentativa_numero || 1) + 1;
    }

    // PASSO 4: Buscar os gabaritos E status de anulação de TODAS as questões
    const questaoIds = respostas.map(r => r.questao_id);

    const { data: questoes, error: questoesError } = await supabaseAdmin
      .from('questoes_simulado')
      .select('id, correta, anulada')
      .in('id', questaoIds);

    if (questoesError) {
      console.error('[corrigir-simulado] Erro ao buscar gabaritos:', questoesError);
      throw questoesError;
    }

    // Criar mapa de gabaritos e status de anulação
    const gabaritos = new Map(questoes?.map(q => [q.id, { correta: q.correta, anulada: q.anulada }]) || []);

    // PASSO 5: Processar TODAS as questões (respondidas e não respondidas)
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

    console.log(`[corrigir-simulado] Total de questões a serem salvas: ${respostasParaSalvar.length}`);

    // PASSO 6: Inserir respostas corrigidas usando cliente admin
    const { error: insertError } = await supabaseAdmin
      .from('answer_progress')
      .insert(respostasParaSalvar);

    if (insertError) {
      console.error('[corrigir-simulado] Erro ao inserir respostas:', insertError);
      throw insertError;
    }

    const questoesRespondidas = respostasParaSalvar.filter(r => r['respondida?']);
    const acertos = questoesRespondidas.filter(r => r.correct).length;
    const total = questoesRespondidas.length;

    console.log(`[corrigir-simulado] Acertos: ${acertos}/${total}`);

    // PASSO 7: Registrar simulado como finalizado usando cliente ADMIN (bypassa RLS)
    // SEMPRE faz INSERT - cada tentativa é um novo registro
    const finalizadoEmTimestamp = finalizado_em || new Date().toISOString();
    
    console.log(`[corrigir-simulado] Registrando finalização em simulados_finalizados (tentativa ${proximaTentativa})...`);
    console.log(`[corrigir-simulado] Dados: user_id=${user_id}, simulado_id=${simulado_id}, tempo=${tempo_total_segundos}s, saidas_aba=${saidas_de_aba}, saidas_fullscreen=${saidas_de_fullscreen ?? 0}`);

    const { error: finalizadoError } = await supabaseAdmin
      .from('simulados_finalizados')
      .insert({
        user_id: user_id,
        simulado_id: simulado_id,
        tempo_total_segundos: tempo_total_segundos,
        saidas_de_aba: saidas_de_aba,
        saidas_de_fullscreen: saidas_de_fullscreen ?? 0,
        finalizado_em: finalizadoEmTimestamp,
        liberado_novamente: false,
        liberado_em: null,
        liberado_por: null,
        tentativa_numero: proximaTentativa
      });

    if (finalizadoError) {
      console.error('[corrigir-simulado] ERRO CRÍTICO ao registrar finalização:', finalizadoError);
      throw new Error(`Falha ao registrar finalização: ${finalizadoError.message}`);
    }
    console.log(`[corrigir-simulado] Finalização registrada com sucesso! tentativa_numero=${proximaTentativa}, liberado_novamente=false`);

    return new Response(
      JSON.stringify({
        message: 'Respostas enviadas com sucesso',
        total_questoes: total,
        acertos: acertos,
        tempo_total_segundos,
        saidas_de_aba,
        saidas_de_fullscreen: saidas_de_fullscreen ?? 0,
        finalizado_em: finalizadoEmTimestamp,
        tentativa_numero: proximaTentativa
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );
  } catch (error) {
    console.error('[corrigir-simulado] Erro na correção do simulado:', error);
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
