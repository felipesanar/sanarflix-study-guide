import * as React from 'react';
import { useQuery } from '@tanstack/react-query';
import { Skeleton } from '@/components/ui/skeleton';
import {
  chavesDesempenho,
  fetchDesempenhoTurma,
  fetchDetalhamento,
  type QuestaoDetalhe,
  type SimuladoBloqueado,
} from '@/services/mentor/desempenho';
import { EstadoErro } from '@/features/mentor/components/turma/EstadoErro';
import { AcertoPorArea } from '@/features/mentor/components/detalhamento/AcertoPorArea';
import { IndicadoresDetalhamento } from '@/features/mentor/components/detalhamento/IndicadoresDetalhamento';
import { ListaQuestoes } from '@/features/mentor/components/detalhamento/ListaQuestoes';
import { PainelQuestao } from '@/features/mentor/components/detalhamento/PainelQuestao';
import { SeletorSimuladosMentor, dicaBloqueado } from '@/features/mentor/components/SeletorSimuladosMentor';
import { ordenarSelecao, simuladoPadrao } from '@/features/mentor/components/detalhamento/util';
import { opcoesSimulados } from '@/features/mentor/components/turma/simulados';

const CarregandoBloco: React.FC = () => (
  <div className="space-y-3" aria-busy="true">
    <Skeleton className="h-24 w-full" />
    <Skeleton className="h-48 w-full" />
  </div>
);

/** Detalhamento por Simulados (telas 04 e 04b): recorte por simulados, acerto por grande área e questões. */
const Detalhamento: React.FC = () => {
  // Sem recorte: a lista de simulados publicados alimenta o seletor; os alunos, o mapa e-mail → nome.
  const todos = useQuery({
    queryKey: chavesDesempenho.turma(),
    queryFn: () => fetchDesempenhoTurma(),
  });
  const disponiveis = React.useMemo(() => opcoesSimulados(todos.data), [todos.data]);

  // Simulados com resultado ainda não liberado aos alunos, descobertos pelas respostas do detalhamento.
  // O backend os exclui dos dados; aqui viram chips desabilitados e a seleção inicial os evita.
  const [bloqueados, setBloqueados] = React.useState<Record<string, SimuladoBloqueado>>({});

  // null = ainda não mexeu: vale o simulado liberado e encerrado mais recente (não o aberto, não o bloqueado).
  // [] = limpou de propósito.
  const [escolha, setEscolha] = React.useState<string[] | null>(null);
  const selecionados = React.useMemo(() => {
    if (escolha !== null) return ordenarSelecao(escolha, disponiveis);
    const livres = disponiveis.filter((s) => !bloqueados[s.id]);
    const padrao = simuladoPadrao(livres) ?? simuladoPadrao(disponiveis);
    return padrao ? [padrao.id] : [];
  }, [escolha, disponiveis, bloqueados]);
  const selecionadosInfo = disponiveis.filter((s) => selecionados.includes(s.id));
  const temSelecao = selecionados.length > 0;

  const recorte = useQuery({
    queryKey: chavesDesempenho.turma(selecionados),
    queryFn: () => fetchDesempenhoTurma(selecionados),
    enabled: temSelecao,
  });
  const detalhe = useQuery({
    queryKey: ['mentor', 'detalhamento', selecionados],
    queryFn: () => fetchDetalhamento(selecionados),
    enabled: temSelecao,
  });

  // Aprende (e esquece, se foi liberado depois) quais simulados da seleção estão bloqueados.
  React.useEffect(() => {
    if (!detalhe.data) return;
    const recebidos = detalhe.data.bloqueados ?? [];
    setBloqueados((prev) => {
      const next = { ...prev };
      let mudou = false;
      for (const id of selecionados) {
        if (!recebidos.some((b) => b.simulado_id === id) && next[id]) {
          delete next[id];
          mudou = true;
        }
      }
      for (const b of recebidos) {
        const atual = next[b.simulado_id];
        if (!atual || atual.libera_em !== b.libera_em) {
          next[b.simulado_id] = b;
          mudou = true;
        }
      }
      return mudou ? next : prev;
    });
    // Só quando chega resposta nova: `selecionados` identifica a que foi pedida.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [detalhe.data]);

  const selecionadosBloqueados = selecionadosInfo.filter((s) => bloqueados[s.id]);
  const selecionadosLiberados = selecionadosInfo.filter((s) => !bloqueados[s.id]);
  const tudoBloqueado = temSelecao && selecionadosLiberados.length === 0;

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
          Ainda não há simulados publicados.
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
          bloqueados={bloqueados}
        />
        {selecionadosBloqueados.length > 0 && (
          <p role="note" data-testid="nota-bloqueados" className="text-xs text-muted-foreground">
            {selecionadosBloqueados
              .map((s) => `Simulado ${s.sequence_number}: ${dicaBloqueado(bloqueados[s.id]).toLowerCase()}`)
              .join(' · ')}
            . {selecionadosBloqueados.length === 1 ? 'Ele não entra' : 'Eles não entram'} nos números abaixo
            enquanto o resultado não for liberado aos alunos.
          </p>
        )}
        {!temSelecao ? (
          <p className="rounded-xl border bg-card p-6 text-sm text-muted-foreground">
            Escolha ao menos um simulado para ver o detalhamento.
          </p>
        ) : (
          <>
            {tudoBloqueado && (
              <p className="rounded-xl border bg-card p-6 text-sm text-muted-foreground">
                O resultado {selecionadosBloqueados.length === 1 ? 'deste simulado' : 'destes simulados'} ainda não
                foi liberado aos alunos. Escolha outro simulado para ver o detalhamento.
              </p>
            )}
            {recorte.isLoading && !tudoBloqueado && <Skeleton className="h-24 w-full" />}
            {recorte.isError && (
              <EstadoErro
                mensagem="Não foi possível carregar os indicadores. Tente de novo em instantes."
                onRetry={() => void recorte.refetch()}
              />
            )}
            {recorte.data && !tudoBloqueado && (
              <IndicadoresDetalhamento desempenho={recorte.data} selecionados={selecionadosLiberados} />
            )}

            {detalhe.isLoading && <CarregandoBloco />}
            {detalhe.isError && (
              <EstadoErro
                mensagem="Não foi possível carregar o detalhamento. Tente de novo em instantes."
                onRetry={() => void detalhe.refetch()}
              />
            )}
            {detalhe.data && !tudoBloqueado && (
              <>
                <AcertoPorArea areas={detalhe.data.areas} />
                {detalhe.data.questoes.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Sem questões respondidas neste recorte.</p>
                ) : (
                  <ListaQuestoes
                    key={selecionados.join(',')}
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
      <PainelQuestao questao={aberta} simulados={selecionados} nomes={nomes} onFechar={() => setAberta(null)} />
    </div>
  );
};

export default Detalhamento;
