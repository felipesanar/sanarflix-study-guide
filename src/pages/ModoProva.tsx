import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { simuladosApi } from '@/services/simuladosApi';
import { useSimuladoStorage } from '@/hooks/useSimuladoStorage';
import { useCronometro } from '@/hooks/useCronometro';
import { useFocusControl } from '@/hooks/useFocusControl';
import { useKeyboardShortcuts, KEY_TO_ALTERNATIVE } from '@/hooks/useKeyboardShortcuts';
import { useAnalyticsTracker } from '@/hooks/useAnalyticsTracker';
import { Questao, EstadoSimulado } from '@/types/simulado';
import { env } from '@/config/env';
import { supabase } from '@/integrations/supabase/client';
import { AlternativaProva } from '@/components/simulados/AlternativaProva';
import { ImageLightbox } from '@/components/simulados/ImageLightbox';
import { NavegacaoLateral } from '@/components/simulados/NavegacaoLateral';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { ChevronLeft, ChevronRight, Flag, Maximize, AlertCircle, Check, Keyboard } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { Logger } from '@/utils/logger';

export const ModoProva = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const simuladoId = id || '';

  const storage = useSimuladoStorage(simuladoId);
  const { trackSimuladoStart, trackSimuladoComplete } = useAnalyticsTracker();
  const hasTrackedStart = useRef(false);
  const jaFinalizouRef = useRef(false); // Flag para evitar envio duplicado
  
  const [questoes, setQuestoes] = useState<Questao[]>([]);
  const [questaoAtual, setQuestaoAtual] = useState(0);
  const [loading, setLoading] = useState(true);
  const [estado, setEstado] = useState<EstadoSimulado | null>(null);
  const [mostrarDialogFinalizar, setMostrarDialogFinalizar] = useState(false);
  const [finalizando, setFinalizando] = useState(false);
  const [simuladoTitulo, setSimuladoTitulo] = useState('');
  const [dataEncerramento, setDataEncerramento] = useState<string | null>(null);

  // Controles de foco e tela cheia
  const { foraDeAba, foraDeTelaCheia, podeInteragir, entrarTelaCheia } = useFocusControl({
    onSaidaAba: () => {
      storage.registrarSaidaAba();
      // NÃO pausa mais o cronômetro ao sair da aba
    },
    onRetornoAba: () => {
      // Não faz nada ao retornar, apenas verifica fullscreen
    },
    onSaidaFullscreen: () => {
      storage.registrarSaidaFullscreen();
    }
  });

  // Cronômetro baseado no deadline (data_encerramento)
  const cronometro = useCronometro({
    dataEncerramento,
    onTempoEsgotado: () => {
      toast.error('Tempo esgotado! Seu simulado será finalizado automaticamente.');
      setTimeout(() => finalizarSimulado(), 3000);
    }
  });


  useEffect(() => {
    inicializarSimulado();
  }, [simuladoId]);

  useEffect(() => {
    if (!loading && !foraDeTelaCheia) {
      entrarTelaCheia();
    }
  }, [loading]);

  const inicializarSimulado = async () => {
    setLoading(true);
    try {
      // VERIFICAÇÃO DE SEGURANÇA: Bloquear acesso se já finalizou e não foi liberado
      if (user?.id) {
        const jaConcluido = await simuladosApi.verificarProgressoSimulado(user.id, simuladoId);
        if (jaConcluido) {
          toast.error('Você já finalizou este simulado');
          navigate('/simulados');
          return;
        }
      } else {
        toast.error('Usuário não autenticado');
        navigate('/simulados');
        return;
      }

      const questoesData = await simuladosApi.buscarQuestoesSimulado(simuladoId);
      setQuestoes(questoesData);

      // Diagnóstico: verifica se as imagens vieram do banco para o aluno
      const comImagem = questoesData.filter((q) => q.imagem).length;
      const comImagemComentario = questoesData.filter((q: any) => q.imagem_comentario).length;
      Logger.info('[ModoProva] Simulado aberto', {
        simuladoId,
        totalQuestoes: questoesData.length,
        questoesComImagem: comImagem,
        questoesComImagemComentario: comImagemComentario,
        questoesSemImagem: questoesData.length - comImagem,
        primeirasComImagem: questoesData
          .filter((q) => q.imagem)
          .slice(0, 5)
          .map((q) => ({ id: q.id, imagem: q.imagem })),
        primeirasComImagemComentario: questoesData
          .filter((q: any) => q.imagem_comentario)
          .slice(0, 5)
          .map((q: any) => ({ id: q.id, imagem_comentario: q.imagem_comentario })),
      });

      Logger.info('[ModoProva] Questão atual inicial', {
        simuladoId,
        primeiraQuestaoId: questoesData[0]?.id,
        primeiraQuestaoTemImagem: Boolean(questoesData[0]?.imagem),
        primeiraQuestaoImagemUrl: questoesData[0]?.imagem ?? null,
      });

      const { titulo, dataEncerramento: deadline, duracaoMinutos } = await simuladosApi.buscarDadosSimulado(simuladoId);
      setSimuladoTitulo(titulo);

      // Track simulado start (only once per session)
      if (!hasTrackedStart.current) {
        hasTrackedStart.current = true;
        trackSimuladoStart(simuladoId, titulo);
      }

      let estadoAtual = storage.carregarEstado();
      if (!estadoAtual) {
        // Inicializa com deadline calculado baseado na duração configurada
        estadoAtual = storage.inicializarEstado(questoesData.length, deadline, duracaoMinutos);
      }

      // Usa o deadline efetivo armazenado no estado (não o global)
      setDataEncerramento(estadoAtual.deadline_efetivo);
      setEstado(estadoAtual);
      setQuestaoAtual(estadoAtual.questao_atual);
    } catch (error) {
      Logger.error('Erro ao inicializar simulado:', error);
      toast.error('Erro ao carregar o simulado');
      navigate('/simulados');
    } finally {
      setLoading(false);
    }
  };

  const questaoAtualData = questoes[questaoAtual];
  const respostaAtual = estado?.respostas[questaoAtualData?.id];

  const handleSelecionarAlternativa = useCallback((alternativa: 'A' | 'B' | 'C' | 'D') => {
    if (!questaoAtualData || !podeInteragir) return;

    setEstado(prevEstado => {
      if (!prevEstado) return prevEstado;
      
      const novoEstado = {
        ...prevEstado,
        respostas: {
          ...prevEstado.respostas,
          [questaoAtualData.id]: {
            questao_id: questaoAtualData.id,
            resposta: alternativa,
            marcada_revisao: prevEstado.respostas[questaoAtualData.id]?.marcada_revisao || false,
            alternativas_eliminadas: prevEstado.respostas[questaoAtualData.id]?.alternativas_eliminadas || []
          }
        }
      };
      
      storage.salvarEstadoDebounced(novoEstado);
      return novoEstado;
    });
  }, [questaoAtualData, podeInteragir, storage]);

  const handleEliminarAlternativa = useCallback((alternativa: 'A' | 'B' | 'C' | 'D') => {
    if (!questaoAtualData) return;

    setEstado(prevEstado => {
      if (!prevEstado) return prevEstado;
      
      const respostaAtual = prevEstado.respostas[questaoAtualData.id];
      const jaEliminada = respostaAtual?.alternativas_eliminadas?.includes(alternativa);
      const eliminadas = jaEliminada
        ? (respostaAtual?.alternativas_eliminadas || []).filter(a => a !== alternativa)
        : [...(respostaAtual?.alternativas_eliminadas || []), alternativa];

      const novoEstado = {
        ...prevEstado,
        respostas: {
          ...prevEstado.respostas,
          [questaoAtualData.id]: {
            questao_id: questaoAtualData.id,
            resposta: respostaAtual?.resposta || null,
            marcada_revisao: respostaAtual?.marcada_revisao || false,
            alternativas_eliminadas: eliminadas
          }
        }
      };
      
      storage.salvarEstadoDebounced(novoEstado);
      return novoEstado;
    });
  }, [questaoAtualData, storage]);

  const handleMarcarRevisao = useCallback(() => {
    if (!questaoAtualData) return;

    setEstado(prevEstado => {
      if (!prevEstado) return prevEstado;
      
      const respostaAtual = prevEstado.respostas[questaoAtualData.id];
      const marcar = !respostaAtual?.marcada_revisao;

      const novoEstado = {
        ...prevEstado,
        respostas: {
          ...prevEstado.respostas,
          [questaoAtualData.id]: {
            questao_id: questaoAtualData.id,
            resposta: respostaAtual?.resposta || null,
            marcada_revisao: marcar,
            alternativas_eliminadas: respostaAtual?.alternativas_eliminadas || []
          }
        }
      };
      
      storage.salvarEstadoDebounced(novoEstado);
      toast.success(marcar ? 'Questão marcada para revisão' : 'Marcação removida');
      return novoEstado;
    });
  }, [questaoAtualData, storage]);

  const handleAnterior = useCallback(() => {
    if (questaoAtual > 0) {
      const novoIndice = questaoAtual - 1;
      setQuestaoAtual(novoIndice);
      setEstado(prev => {
        if (!prev) return prev;
        const novoEstado = { ...prev, questao_atual: novoIndice };
        storage.salvarEstadoDebounced(novoEstado);
        return novoEstado;
      });
    }
  }, [questaoAtual, storage]);

  const handleProxima = useCallback(() => {
    if (questaoAtual < questoes.length - 1) {
      const novoIndice = questaoAtual + 1;
      setQuestaoAtual(novoIndice);
      setEstado(prev => {
        if (!prev) return prev;
        const novoEstado = { ...prev, questao_atual: novoIndice };
        storage.salvarEstadoDebounced(novoEstado);
        return novoEstado;
      });
    }
  }, [questaoAtual, questoes.length, storage]);

  const handleIrParaQuestao = useCallback((index: number) => {
    setQuestaoAtual(index);
    setEstado(prev => {
      if (!prev) return prev;
      const novoEstado = { ...prev, questao_atual: index };
      storage.salvarEstadoDebounced(novoEstado);
      return novoEstado;
    });
  }, [storage]);

  const finalizarSimulado = async () => {
    // Sob FF_PROVA_RACE_FIX: só marcamos jaFinalizouRef após sucesso do envio,
    // garantindo que beforeunload (sendBeacon) continue funcionando como
    // fallback se a requisição falhar antes do término. Comportamento
    // anterior (legado) marcava antes — risco de perda de dados ao fechar
    // a aba durante uma falha de rede.
    if (!env.FF_PROVA_RACE_FIX) {
      jaFinalizouRef.current = true; // legado
    }
    setFinalizando(true);
    try {
      const estadoFinal = storage.carregarEstado();
      if (!estadoFinal || !user) return;

      // Preparar TODAS as questões (respondidas e não respondidas)
      const todasQuestoesIds = questoes.map(q => q.id);
      const respostasCompletas = storage.prepararRespostasCompletas(todasQuestoesIds);

      // Calcula tempo gasto desde o início do simulado
      const iniciadoEm = new Date(estadoFinal.iniciado_em);
      const tempoTotalSegundos = Math.floor((Date.now() - iniciadoEm.getTime()) / 1000);
      const totalRespondidas = Object.values(estadoFinal.respostas).filter(r => r.resposta).length;

      const payload = {
        simulado_id: simuladoId,
        user_id: user.id,
        respostas: respostasCompletas,
        tempo_total_segundos: tempoTotalSegundos,
        saidas_de_aba: estadoFinal.saidas_de_aba,
        saidas_de_fullscreen: estadoFinal.saidas_de_fullscreen || 0,
        finalizado_em: new Date().toISOString()
      };
      await simuladosApi.enviarResultado(payload);

      if (env.FF_PROVA_RACE_FIX) {
        jaFinalizouRef.current = true; // só após sucesso confirmado
      }

      // Track simulado completion
      trackSimuladoComplete(simuladoId, {
        tempoTotalSegundos,
        saidasDeAba: estadoFinal.saidas_de_aba,
        saidasDeFullscreen: estadoFinal.saidas_de_fullscreen || 0,
        totalQuestoes: questoes.length,
        totalRespondidas
      });

      storage.limparEstado();

      try {
        const perfPrefix = `performanceData_${user.id}`;
        const evolutionKey = `evolutionData_${user.id}`;
        Object.keys(sessionStorage).forEach((k) => {
          if (k.startsWith(perfPrefix) || k === evolutionKey) {
            sessionStorage.removeItem(k);
          }
        });
      } catch (e) {}

      window.dispatchEvent(new CustomEvent('simulado:finalizado', { detail: { simuladoId } }));

      toast.success('Simulado enviado com sucesso!', {
        description: 'Redirecionando para a página de simulados...',
        duration: 3000
      });

      setTimeout(() => {
        navigate(`/simulados?aba=simulados&just_finished=${simuladoId}`);
      }, 1500);
    } catch (error) {
      Logger.error('Erro ao finalizar simulado:', error);
      toast.error('Erro ao enviar simulado. Tente novamente.');
      setFinalizando(false);
    }
  };

  const questoesRespondidas = new Set(
    Object.values(estado?.respostas || {})
      .filter(r => r.resposta !== null)
      .map(r => questoes.findIndex(q => q.id === r.questao_id))
  );

  const questoesMarcadasRevisao = new Set(
    Object.values(estado?.respostas || {})
      .filter(r => r.marcada_revisao)
      .map(r => questoes.findIndex(q => q.id === r.questao_id))
  );

  const progresso = (questoesRespondidas.size / questoes.length) * 100;

  // Atalhos de teclado para navegação e seleção de alternativas
  const keyboardShortcuts = useMemo(() => ({
    '1': () => podeInteragir && questaoAtualData && handleSelecionarAlternativa('A'),
    '2': () => podeInteragir && questaoAtualData && handleSelecionarAlternativa('B'),
    '3': () => podeInteragir && questaoAtualData && handleSelecionarAlternativa('C'),
    '4': () => podeInteragir && questaoAtualData && handleSelecionarAlternativa('D'),
    'ArrowLeft': handleAnterior,
    'ArrowRight': handleProxima,
    'f': handleMarcarRevisao,
    'Escape': () => setMostrarDialogFinalizar(true),
  }), [podeInteragir, questaoAtualData, handleSelecionarAlternativa, handleAnterior, handleProxima, handleMarcarRevisao]);

  useKeyboardShortcuts(keyboardShortcuts, { 
    enabled: !loading && !mostrarDialogFinalizar && !finalizando 
  });

  // Refs estáveis para evitar re-registrar o listener a cada tick do cronômetro
  // ou a cada mudança de state. Antes este effect re-rodava a cada segundo,
  // causando memory leak de listeners durante toda a prova.
  const finalizandoRef = useRef(finalizando);
  finalizandoRef.current = finalizando;
  const questoesRef = useRef(questoes);
  questoesRef.current = questoes;
  const userRef = useRef(user);
  userRef.current = user;

  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      // NÃO enviar se já finalizou via botão (evita duplicação)
      if (jaFinalizouRef.current || finalizandoRef.current) {
        return;
      }

      const currentUser = userRef.current;
      const currentQuestoes = questoesRef.current;
      const estadoFinal = storage.carregarEstado();
      if (!estadoFinal || !currentUser) {
        return;
      }

      const todasQuestoesIds = currentQuestoes.map(q => q.id);
      const respostasCompletas = storage.prepararRespostasCompletas(todasQuestoesIds);

      // Calcula tempo gasto desde o início
      const iniciadoEm = new Date(estadoFinal.iniciado_em);
      const tempoTotalSegundos = Math.floor((Date.now() - iniciadoEm.getTime()) / 1000);

      // Captura o access token síncronamente (sendBeacon não aceita Promise).
      // Buscamos de localStorage onde Supabase persiste a sessão atual.
      let accessToken: string | undefined;
      try {
        const ref = new URL(env.SUPABASE_URL).hostname.split('.')[0];
        const raw = localStorage.getItem(`sb-${ref}-auth-token`);
        if (raw) {
          const parsed = JSON.parse(raw);
          accessToken = parsed?.access_token;
        }
      } catch {
        // sessionStorage/localStorage indisponível — segue sem token; servidor rejeitará.
      }

      const payload = {
        simulado_id: simuladoId,
        user_id: currentUser.id,
        respostas: respostasCompletas,
        tempo_total_segundos: tempoTotalSegundos,
        saidas_de_aba: estadoFinal.saidas_de_aba,
        saidas_de_fullscreen: estadoFinal.saidas_de_fullscreen || 0,
        finalizado_em: new Date().toISOString(),
        auto_finalizado: true,
        __access_token: accessToken,
      };

      // sendBeacon garante que a requisição seja enviada mesmo fechando a aba.
      // URL derivada de env (antes hardcoded — quebrava em staging/preview).
      const url = `${env.EDGE_FUNCTIONS_BASE_URL}/corrigir-simulado`;
      const blob = new Blob([JSON.stringify(payload)], { type: 'application/json' });
      navigator.sendBeacon(url, blob);

      e.preventDefault();
      e.returnValue = '';
    };

    window.addEventListener('beforeunload', handleBeforeUnload);

    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
    // Dependências estáveis: o handler usa refs para acessar valores atuais.
    // simuladoId e storage não mudam durante uma prova.
  }, [simuladoId, storage]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-primary/30 border-t-primary rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-muted-foreground">Carregando simulado...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col bg-background">
      {/* Alertas */}
      {foraDeAba && (
        <Alert variant="destructive" className="rounded-none border-x-0 border-t-0">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            Você saiu do modo prova. Seu tempo foi pausado. Retorne para continuar.
          </AlertDescription>
        </Alert>
      )}

      {foraDeTelaCheia && (
        <Alert className="rounded-none border-x-0 border-t-0 bg-amber-500/10 border-amber-500/20">
          <AlertCircle className="h-4 w-4 text-amber-500" />
          <AlertDescription className="text-amber-700 dark:text-amber-300 flex items-center flex-wrap gap-2">
            <span>
              <strong>Interação bloqueada.</strong> Para manter a integridade do simulado, ative novamente o modo tela cheia.
            </span>
            <Button
              variant="default"
              size="sm"
              onClick={entrarTelaCheia}
              className="bg-amber-600 hover:bg-amber-700 text-white"
            >
              <Maximize className="h-4 w-4 mr-2" />
              Ativar Tela Cheia
            </Button>
          </AlertDescription>
        </Alert>
      )}

      {/* Cabeçalho */}
      <header className="border-b bg-card px-6 py-4 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold">{simuladoTitulo || 'Simulado'}</h1>
          <p className="text-sm text-muted-foreground">
            Questão {questaoAtual + 1} de {questoes.length}
          </p>
        </div>

        <div className="flex items-center gap-4">
          {/* Atalhos de Teclado */}
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="ghost" size="icon" className="hidden md:flex">
                  <Keyboard className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="bottom" className="max-w-xs">
                <div className="space-y-2 text-sm">
                  <p className="font-semibold">Atalhos de Teclado</p>
                  <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
                    <span><kbd className="px-1 py-0.5 bg-muted rounded text-xs">1-4</kbd> Alternativas</span>
                    <span><kbd className="px-1 py-0.5 bg-muted rounded text-xs">←→</kbd> Navegação</span>
                    <span><kbd className="px-1 py-0.5 bg-muted rounded text-xs">F</kbd> Revisar</span>
                    <span><kbd className="px-1 py-0.5 bg-muted rounded text-xs">Esc</kbd> Finalizar</span>
                  </div>
                </div>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>

          <div className="text-center">
            <div className={cn('text-2xl font-bold font-mono', cronometro.getCorTempo())}>
              {cronometro.formatarTempo(cronometro.tempoRestante)}
            </div>
            <p className="text-xs text-muted-foreground">Tempo restante</p>
          </div>

          <Button
            variant="destructive"
            onClick={() => setMostrarDialogFinalizar(true)}
          >
            Finalizar
          </Button>
        </div>
      </header>

      {/* Barra de Progresso */}
      <div className="px-6 py-2 bg-muted/30">
        <div className="flex items-center gap-4">
          <Progress value={progresso} className="flex-1" />
          <span className="text-sm font-medium">
            {questoesRespondidas.size}/{questoes.length} respondidas
          </span>
        </div>
      </div>

      {/* Navegação movida para a lateral */}

      {/* Corpo */}
      <div className="flex-1 flex overflow-hidden">
        {/* Área da Questão */}
        <div className="flex-1 overflow-y-auto p-8">
          <div className="max-w-5xl mx-auto space-y-6">
            {/* Enunciado */}
            <div className="bg-card p-6 rounded-xl border">
              <div className="flex items-start justify-between mb-4">
                <Badge variant="outline">Questão {questaoAtual + 1}</Badge>
                {respostaAtual?.marcada_revisao && (
                  <Badge variant="secondary" className="bg-blue-500/10 text-blue-500">
                    <Flag className="h-3 w-3 mr-1" />
                    Marcada para revisão
                  </Badge>
                )}
              </div>

              <p className="text-base leading-relaxed whitespace-pre-wrap">
                {questaoAtualData?.enunciado}
              </p>

              {questaoAtualData?.imagem && (
                <div className="mt-6">
                  <ImageLightbox
                    src={questaoAtualData.imagem}
                    alt={`Imagem da questão ${questaoAtual + 1}`}
                    className="max-w-full rounded-lg border"
                  />
                </div>
              )}

              {questaoAtualData?.imagem_2 && (
                <div className="mt-4">
                  <ImageLightbox
                    src={questaoAtualData.imagem_2}
                    alt={`Imagem complementar da questão ${questaoAtual + 1}`}
                    className="max-w-full rounded-lg border"
                  />
                </div>
              )}
            </div>

            {/* Alternativas */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {(['A', 'B', 'C', 'D'] as const).map(letra => (
                <AlternativaProva
                  key={letra}
                  letra={letra}
                  texto={questaoAtualData?.[`alternativa_${letra.toLowerCase()}` as keyof Questao] as string || ''}
                  selecionada={respostaAtual?.resposta === letra}
                  eliminada={respostaAtual?.alternativas_eliminadas.includes(letra) || false}
                  onSelecionar={() => handleSelecionarAlternativa(letra)}
                  onEliminar={() => handleEliminarAlternativa(letra)}
                />
              ))}
            </div>

            {/* Navegação */}
            <div className="flex items-center justify-between pt-6">
              <Button
                variant="outline"
                onClick={handleAnterior}
                disabled={questaoAtual === 0}
              >
                <ChevronLeft className="h-4 w-4 mr-2" />
                Anterior
              </Button>

              <Button
                variant="outline"
                onClick={handleMarcarRevisao}
                className={cn(respostaAtual?.marcada_revisao && 'bg-blue-500/10 border-blue-500')}
              >
                <Flag className="h-4 w-4 mr-2" />
                {respostaAtual?.marcada_revisao ? 'Remover revisão' : 'Revisar'}
              </Button>

              <Button
                variant="outline"
                onClick={handleProxima}
                disabled={questaoAtual === questoes.length - 1}
              >
                Próxima
                <ChevronRight className="h-4 w-4 ml-2" />
              </Button>
            </div>
          </div>
        </div>

        {/* Navegação Lateral */}
        <NavegacaoLateral
          totalQuestoes={questoes.length}
          questaoAtual={questaoAtual}
          questoesRespondidas={questoesRespondidas}
          questoesMarcadasRevisao={questoesMarcadasRevisao}
          onIrParaQuestao={handleIrParaQuestao}
        />
      </div>

      {/* Dialog de Finalização */}
      <AlertDialog open={mostrarDialogFinalizar} onOpenChange={setMostrarDialogFinalizar}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Finalizar Simulado?</AlertDialogTitle>
            <AlertDialogDescription>
              <p className="mb-2">
                Você respondeu <strong>{questoesRespondidas.size}</strong> de <strong>{questoes.length}</strong> questões.
              </p>
              {questoesMarcadasRevisao.size > 0 && (
                <p className="mb-2 text-blue-600 dark:text-blue-400">
                  📌 Você marcou <strong>{questoesMarcadasRevisao.size}</strong> questões para revisão.
                </p>
              )}
              {questoesRespondidas.size < questoes.length && (
                <p className="mt-2 text-amber-600 dark:text-amber-400">
                  ⚠️ Você ainda tem <strong>{questoes.length - questoesRespondidas.size}</strong> questões não respondidas.
                </p>
              )}
              <p className="mt-3 font-medium">
                Ao confirmar, seu simulado será enviado e não poderá ser alterado.
              </p>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={finalizando}>
              Continuar Respondendo
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={finalizarSimulado}
              disabled={finalizando}
              className="bg-primary"
            >
              {finalizando ? (
                <>
                  <div className="h-4 w-4 border-2 border-white/30 border-t-white rounded-full animate-spin mr-2" />
                  Enviando...
                </>
              ) : (
                <>
                  <Check className="h-4 w-4 mr-2" />
                  Finalizar
                </>
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default ModoProva;
