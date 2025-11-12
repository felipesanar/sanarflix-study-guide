import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { simuladosApi } from '@/services/simuladosApi';
import { useSimuladoStorage } from '@/hooks/useSimuladoStorage';
import { useCronometro } from '@/hooks/useCronometro';
import { useFocusControl } from '@/hooks/useFocusControl';
import { Questao, EstadoSimulado } from '@/types/simulado';
import { AlternativaProva } from '@/components/simulados/AlternativaProva';
import { NavegacaoLateral } from '@/components/simulados/NavegacaoLateral';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
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
import { ChevronLeft, ChevronRight, Flag, Maximize, AlertCircle, Check } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

export const ModoProva = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const simuladoId = id || '';

  const storage = useSimuladoStorage(simuladoId);
  const [questoes, setQuestoes] = useState<Questao[]>([]);
  const [questaoAtual, setQuestaoAtual] = useState(0);
  const [loading, setLoading] = useState(true);
  const [estado, setEstado] = useState<EstadoSimulado | null>(null);
  const [mostrarDialogFinalizar, setMostrarDialogFinalizar] = useState(false);
  const [finalizando, setFinalizando] = useState(false);

  // Controles de foco e tela cheia
  const { foraDeAba, foraDeTelaCheia, entrarTelaCheia } = useFocusControl({
    onSaidaAba: () => {
      storage.registrarSaidaAba();
      cronometro.pausar();
    },
    onRetornoAba: () => {
      cronometro.retomar();
    }
  });

  // Cronômetro
  const cronometro = useCronometro({
    tempoInicialSegundos: estado?.tempo_restante_segundos || 0,
    onTempoEsgotado: () => {
      toast.error('Tempo esgotado! Seu simulado será finalizado automaticamente.');
      setTimeout(() => finalizarSimulado(), 3000);
    },
    onAtualizarTempo: (tempo) => {
      storage.atualizarTempo(tempo);
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
      const questoesData = await simuladosApi.buscarQuestoesSimulado(simuladoId);
      setQuestoes(questoesData);

      let estadoAtual = storage.carregarEstado();
      if (!estadoAtual) {
        estadoAtual = storage.inicializarEstado(questoesData.length, 7200);
      }

      setEstado(estadoAtual);
      setQuestaoAtual(estadoAtual.questao_atual);
    } catch (error) {
      console.error('Erro ao inicializar simulado:', error);
      toast.error('Erro ao carregar o simulado');
      navigate('/simulados');
    } finally {
      setLoading(false);
    }
  };

  const questaoAtualData = questoes[questaoAtual];
  const respostaAtual = estado?.respostas[questaoAtualData?.id];

  const handleSelecionarAlternativa = (alternativa: 'A' | 'B' | 'C' | 'D') => {
    if (!questaoAtualData) return;

    storage.salvarResposta(questaoAtualData.id, {
      questao_id: questaoAtualData.id,
      resposta: alternativa,
      marcada_revisao: respostaAtual?.marcada_revisao || false,
      alternativas_eliminadas: respostaAtual?.alternativas_eliminadas || []
    });

    const novoEstado = storage.carregarEstado();
    if (novoEstado) setEstado(novoEstado);
  };

  const handleEliminarAlternativa = (alternativa: 'A' | 'B' | 'C' | 'D') => {
    if (!questaoAtualData) return;

    const jaEliminada = respostaAtual?.alternativas_eliminadas.includes(alternativa);
    storage.eliminarAlternativa(questaoAtualData.id, alternativa, !jaEliminada);

    const novoEstado = storage.carregarEstado();
    if (novoEstado) setEstado(novoEstado);
  };

  const handleMarcarRevisao = () => {
    if (!questaoAtualData) return;

    const marcar = !respostaAtual?.marcada_revisao;
    storage.marcarRevisao(questaoAtualData.id, marcar);

    const novoEstado = storage.carregarEstado();
    if (novoEstado) setEstado(novoEstado);

    toast.success(marcar ? 'Questão marcada para revisão' : 'Marcação removida');
  };

  const handleAnterior = () => {
    if (questaoAtual > 0) {
      const novoIndice = questaoAtual - 1;
      setQuestaoAtual(novoIndice);

      const estadoAtual = storage.carregarEstado();
      if (estadoAtual) {
        storage.salvarEstado({ ...estadoAtual, questao_atual: novoIndice });
      }
    }
  };

  const handleProxima = () => {
    if (questaoAtual < questoes.length - 1) {
      const novoIndice = questaoAtual + 1;
      setQuestaoAtual(novoIndice);

      const estadoAtual = storage.carregarEstado();
      if (estadoAtual) {
        storage.salvarEstado({ ...estadoAtual, questao_atual: novoIndice });
      }
    }
  };

  const handleIrParaQuestao = (index: number) => {
    setQuestaoAtual(index);

    const estadoAtual = storage.carregarEstado();
    if (estadoAtual) {
      storage.salvarEstado({ ...estadoAtual, questao_atual: index });
    }
  };

  const finalizarSimulado = async () => {
    setFinalizando(true);
    try {
      const estadoFinal = storage.carregarEstado();
      if (!estadoFinal || !user) return;

      const respostas = Object.values(estadoFinal.respostas);

      await simuladosApi.enviarResultado({
        simulado_id: simuladoId,
        user_id: user.email,
        respostas,
        tempo_total_segundos: 7200 - cronometro.tempoRestante,
        saidas_de_aba: estadoFinal.saidas_de_aba,
        finalizado_em: new Date().toISOString()
      });

      storage.limparEstado();

      toast.success('Simulado enviado com sucesso!', {
        description: 'Em breve, o resultado estará disponível na aba Desempenho.',
        duration: 5000
      });

      setTimeout(() => {
        navigate('/simulados?aba=desempenho');
      }, 2000);
    } catch (error) {
      console.error('Erro ao finalizar simulado:', error);
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
          <AlertDescription className="text-amber-700 dark:text-amber-300">
            Para manter a integridade do simulado, ative novamente o modo tela cheia.
            <Button
              variant="outline"
              size="sm"
              className="ml-4"
              onClick={entrarTelaCheia}
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
          <h1 className="text-xl font-bold">Simulado ENAMED {simuladoId}</h1>
          <p className="text-sm text-muted-foreground">
            Questão {questaoAtual + 1} de {questoes.length}
          </p>
        </div>

        <div className="flex items-center gap-6">
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
                  <img
                    src={questaoAtualData.imagem}
                    alt="Imagem da questão"
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
              Você respondeu {questoesRespondidas.size} de {questoes.length} questões.
              {questoesRespondidas.size < questoes.length && (
                <p className="mt-2 text-amber-600 dark:text-amber-400">
                  ⚠️ Você ainda tem {questoes.length - questoesRespondidas.size} questões não respondidas.
                </p>
              )}
              <p className="mt-2">
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
