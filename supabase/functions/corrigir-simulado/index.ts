import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
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
  /**
   * Access token usado apenas no fluxo de sendBeacon (que não permite
   * cabeçalhos customizados). Quando presente, o servidor o trata como
   * o token autoritativo equivalente ao header Authorization.
   * NUNCA confiar em user_id do body — sempre validar contra este token.
   */
  __access_token?: string;
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

    const body: CorrecaoRequest = await req.json();
    const {
      simulado_id,
      respostas,
      tempo_total_segundos,
      saidas_de_aba,
      saidas_de_fullscreen,
      finalizado_em,
      auto_finalizado,
      __access_token,
    } = body;

    // ─────────────────────────────────────────────────────────────────────────
    // Autenticação autoritativa
    // ─────────────────────────────────────────────────────────────────────────
    // O user_id ANTES vinha do body sem validação (IDOR). Agora extraímos o
    // usuário autenticado do JWT — do header Authorization no fluxo normal,
    // ou do campo __access_token do body no fluxo de sendBeacon (que não
    // permite headers customizados).
    const authHeader = req.headers.get('Authorization') ?? '';
    const headerToken = authHeader.startsWith('Bearer ')
      ? authHeader.slice('Bearer '.length)
      : '';
    const token = headerToken || __access_token || '';

    if (!token) {
      return new Response(
        JSON.stringify({ error: 'unauthorized', detail: 'missing access token' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { data: userData, error: getUserError } = await supabaseAdmin.auth.getUser(token);
    if (getUserError || !userData?.user) {
      return new Response(
        JSON.stringify({ error: 'unauthorized', detail: 'invalid token' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    const user_id = userData.user.id;

    // Se o cliente enviou user_id, deve coincidir com o autenticado.
    // Mismatch indica tentativa de IDOR — bloqueamos e logamos.
    if (body.user_id && body.user_id !== user_id) {
      console.warn(
        `[corrigir-simulado] IDOR attempt: body.user_id=${body.user_id} != auth.user_id=${user_id}`
      );
      return new Response(
        JSON.stringify({ error: 'forbidden', detail: 'user mismatch' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[corrigir-simulado] Processando simulado: ${simulado_id} para usuário: ${user_id}`);
    console.log(`[corrigir-simulado] Auto-finalizado: ${auto_finalizado ? 'SIM (sendBeacon)' : 'NÃO (botão)'}`);
    console.log(`[corrigir-simulado] Tempo total: ${tempo_total_segundos}s, Saídas aba: ${saidas_de_aba}, Saídas fullscreen: ${saidas_de_fullscreen ?? 0}`);

    // PASSO 0: Verificar/criar registro de início para consistência
    const { data: inicioExistente, error: inicioError } = await supabaseAdmin
      .from('simulados_iniciados')
      .select('id, started_at')
      .eq('user_id', user_id)
      .eq('simulado_id', simulado_id)
      .maybeSingle();

    if (inicioError) {
      console.error('[corrigir-simulado] Erro ao verificar início:', inicioError);
    }

    // Se não existe início, criar um retroativamente (para consistência de dados)
    if (!inicioExistente) {
      console.log('[corrigir-simulado] ATENÇÃO: Não existe registro de início. Criando retroativamente...');
      const startedAtRetroativo = new Date(Date.now() - (tempo_total_segundos * 1000)).toISOString();
      
      const { error: insertInicioError } = await supabaseAdmin
        .from('simulados_iniciados')
        .insert({
          user_id: user_id,
          simulado_id: simulado_id,
          started_at: startedAtRetroativo
        });
      
      if (insertInicioError && !insertInicioError.message?.includes('duplicate')) {
        console.error('[corrigir-simulado] Erro ao criar início retroativo:', insertInicioError);
      } else {
        console.log(`[corrigir-simulado] Início retroativo criado: ${startedAtRetroativo}`);
      }
    } else {
      console.log(`[corrigir-simulado] Início encontrado: ID=${inicioExistente.id}, started_at=${inicioExistente.started_at}`);
    }

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
    // Questões anuladas NÃO são contabilizadas — correct é baseado apenas no gabarito real
    const respostasParaSalvar = respostas.map(r => {
      const questaoInfo = gabaritos.get(r.questao_id);
      const gabarito = questaoInfo?.correta;
      
      return {
        user_id: user_id,
        simulado: simulado_id,
        question_id: r.questao_id,
        resposta_usuario: r.resposta,
        answer_id: crypto.randomUUID(),
        // Questões anuladas: correct reflete o gabarito real (serão excluídas dos cálculos)
        correct: r.resposta !== null ? gabarito === r.resposta : false,
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

    // Excluir questões anuladas dos cálculos de acertos/total
    const idsAnuladas = new Set(
      [...gabaritos.entries()].filter(([_, info]) => info.anulada === true).map(([id]) => id)
    );
    const questoesValidas = respostasParaSalvar.filter(r => !idsAnuladas.has(r.question_id));
    const questoesRespondidas = questoesValidas.filter(r => r['respondida?']);
    const acertos = questoesRespondidas.filter(r => r.correct).length;
    const total = questoesRespondidas.length;

    console.log(`[corrigir-simulado] Questões anuladas: ${idsAnuladas.size}, Acertos: ${acertos}/${total}`);

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
