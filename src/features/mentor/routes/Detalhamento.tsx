import * as React from 'react';
import { useQuery } from '@tanstack/react-query';
import { Skeleton } from '@/components/ui/skeleton';
import { fetchDesempenhoTurma, fetchDetalhamento, type QuestaoDetalhe } from '@/services/mentor/desempenho';
import { EstadoErro } from '@/features/mentor/components/turma/EstadoErro';
import { AcertoPorArea } from '@/features/mentor/components/detalhamento/AcertoPorArea';
import { IndicadoresDetalhamento } from '@/features/mentor/components/detalhamento/IndicadoresDetalhamento';
import { ListaQuestoes } from '@/features/mentor/components/detalhamento/ListaQuestoes';
import { PainelQuestao } from '@/features/mentor/components/detalhamento/PainelQuestao';
import { SeletorSimuladosMentor } from '@/features/mentor/components/SeletorSimuladosMentor';
import {
  ordenarSelecao,
  simuladoMaisRecente,
  simuladosDisponiveis,
} from '@/features/mentor/components/detalhamento/util';

const CarregandoBloco: React.FC = () => (
  <div className="space-y-3" aria-busy="true">
    <Skeleton className="h-24 w-full" />
    <Skeleton className="h-48 w-full" />
  </div>
);

/** Detalhamento por Simulados (telas 04 e 04b): recorte por simulados, acerto por grande área e questões. */
const Detalhamento: React.FC = () => {
  // Todos os simulados com nota na turma: alimenta o seletor e o mapa e-mail → nome.
  const todos = useQuery({
    queryKey: ['mentor', 'desempenho', 'todos'],
    queryFn: () => fetchDesempenhoTurma(),
  });
  const disponiveis = React.useMemo(() => simuladosDisponiveis(todos.data?.alunos ?? []), [todos.data]);

  // null = ainda não mexeu: vale o simulado mais recente. [] = limpou de propósito.
  const [escolha, setEscolha] = React.useState<string[] | null>(null);
  const selecionados = React.useMemo(() => {
    if (escolha !== null) return ordenarSelecao(escolha, disponiveis);
    const recente = simuladoMaisRecente(disponiveis);
    return recente ? [recente.id] : [];
  }, [escolha, disponiveis]);
  const selecionadosInfo = disponiveis.filter((s) => selecionados.includes(s.id));
  const temSelecao = selecionados.length > 0;

  const recorte = useQuery({
    queryKey: ['mentor', 'desempenho', 'recorte', selecionados],
    queryFn: () => fetchDesempenhoTurma(selecionados),
    enabled: temSelecao,
  });
  const detalhe = useQuery({
    queryKey: ['mentor', 'detalhamento', selecionados],
    queryFn: () => fetchDetalhamento(selecionados),
    enabled: temSelecao,
  });

  const [aberta, setAberta] = React.useState<QuestaoDetalhe | null>(null);

  const nomes = React.useMemo(() => {
    const mapa: Record<string, string | null> = {};
    for (const a of todos.data?.alunos ?? []) mapa[a.email.toLowerCase()] = a.nome;
    return mapa;
  }, [todos.data]);

  const renderCorpo = () => {
    if (todos.isLoading) return <CarregandoBloco />;
    if (todos.isError) {
      return (
        <EstadoErro
          mensagem="Não foi possível carregar os simulados da turma. Tente de novo em instantes."
          onRetry={() => void todos.refetch()}
        />
      );
    }
    if (disponiveis.length === 0) {
      return (
        <p className="rounded-xl border bg-card p-6 text-sm text-muted-foreground">
          Ainda não há simulados com dados da sua turma.
        </p>
      );
    }
    return (
      <>
        <SeletorSimuladosMentor
          opcoes={disponiveis}
          selecionados={selecionados}
          onChange={setEscolha}
          exigirSelecao
        />
        {!temSelecao ? (
          <p className="rounded-xl border bg-card p-6 text-sm text-muted-foreground">
            Escolha ao menos um simulado para ver o detalhamento.
          </p>
        ) : (
          <>
            {recorte.isLoading && <Skeleton className="h-24 w-full" />}
            {recorte.isError && (
              <EstadoErro
                mensagem="Não foi possível carregar os indicadores. Tente de novo em instantes."
                onRetry={() => void recorte.refetch()}
              />
            )}
            {recorte.data && <IndicadoresDetalhamento desempenho={recorte.data} selecionados={selecionadosInfo} />}

            {detalhe.isLoading && <CarregandoBloco />}
            {detalhe.isError && (
              <EstadoErro
                mensagem="Não foi possível carregar o detalhamento. Tente de novo em instantes."
                onRetry={() => void detalhe.refetch()}
              />
            )}
            {detalhe.data && (
              <>
                <AcertoPorArea areas={detalhe.data.areas} />
                {detalhe.data.questoes.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Sem questões respondidas neste recorte.</p>
                ) : (
                  <ListaQuestoes
                    questoes={detalhe.data.questoes}
                    multiSimulado={selecionados.length > 1}
                    onAbrir={setAberta}
                  />
                )}
              </>
            )}
          </>
        )}
      </>
    );
  };

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold">Detalhamento por Simulados</h1>
        <p className="text-sm text-muted-foreground">
          Veja em que grandes áreas e questões a turma acertou e errou, e fale com quem marcou cada alternativa.
        </p>
      </div>
      {renderCorpo()}
      <PainelQuestao questao={aberta} nomes={nomes} onFechar={() => setAberta(null)} />
    </div>
  );
};

export default Detalhamento;
