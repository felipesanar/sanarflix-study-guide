import * as React from 'react';
import { CalendarDays } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { useCronograma, useDetalhamento, useGestorContexto, useQuestoes } from '../api/queries';
import { useFiltrosGestor } from '../hooks/useFiltrosGestor';
import { AcertoPorAreaESemestre } from '../components/AcertoPorAreaESemestre';
import { BlocoGestor, type EstadoBloco } from '../components/BlocoGestor';
import { ComparativoSimulados } from '../components/ComparativoSimulados';
import { ContextoDoRecorte } from '../components/ContextoDoRecorte';
import { CronogramaSimulados } from '../components/CronogramaSimulados';
import { DrawerAluno } from '../components/DrawerAluno';
import { DispersaoChart } from '../charts/DispersaoChart';
import { EstadoVazioDetalhamento } from '../components/EstadoVazioDetalhamento';
import { EvolucaoRecorte } from '../components/EvolucaoRecorte';
import { FiltroSemestre } from '../components/FiltroSemestre';
import { KpisDetalhamento } from '../components/KpisDetalhamento';
import { SeletorSimulados } from '../components/SeletorSimulados';
import { TabelaAlunosSimulado } from '../components/TabelaAlunosSimulado';
import { TabelaQuestoes, deveMostrarQuestoes, type OrdenacaoQuestoes } from '../components/TabelaQuestoes';
import { useTelemetriaGestor } from '../lib/telemetria';
import type { DetalhamentoComExtras, RecorteCruzado } from '../api/detalhamentoExtras';
import type { FiltrosGestor, Meta } from '../api/types';
import { useGestorPortalContainer } from '../shell/GestorShell';

const META_VAZIA: Meta = {
  periodo: '—',
  fonte: '—',
  atualizadoEm: '',
  criterio: '—',
  partial: false,
  lowSample: false,
};

/**
 * /gestor/detalhamento — "O que exatamente aconteceu neste simulado?" (spec
 * §2.1, §4.7). 3 sub-estados: sem simulado selecionado (nenhuma requisição de
 * métrica), carregando, e com dado. Segue o mesmo padrão de bloco
 * (`BlocoGestor`/`ContextoDoRecorte`) estabelecido na Visão Geral (Fase 4).
 */
export default function Detalhamento() {
  const filtros = useFiltrosGestor();
  const contexto = useGestorContexto();
  const { telaVista, filtroAlterado, drawerAberto, marcarPrimeiroInsight } = useTelemetriaGestor();
  const portalContainer = useGestorPortalContainer();

  // Mesmo padrão de Inicio.tsx/VisaoGeral.tsx: a URL é hint de UI, a IES
  // autoritativa vem do servidor.
  const iesAtivaId = filtros.iesId ?? contexto.data?.iesAtual.id ?? null;
  const iesNomeAtiva = contexto.data?.iesDisponiveis.find((ies) => ies.id === iesAtivaId)?.nome ?? '';

  const cronograma = useCronograma(iesAtivaId);
  const itensCronograma = cronograma.data ?? [];

  const filtrosGestor: FiltrosGestor = React.useMemo(
    () => ({ iesId: iesAtivaId, semestre: filtros.semestre, simulados: filtros.simulados }),
    [iesAtivaId, filtros.semestre, filtros.simulados],
  );

  /** `gestor_tela_vista` (spec §10, "adoção por tela") — reinicia também o relógio do primeiro insight. */
  React.useEffect(() => {
    telaVista('detalhamento', filtros.semestre);
  }, [telaVista, filtros.semestre]);

  /**
   * `gestor_filtro_alterado` para o semestre (spec §10). Mesmo motivo de
   * `VisaoGeral.tsx`: `FiltroSemestre` lê/escreve `useFiltrosGestor()` direto,
   * sem prop de callback — a troca é observada no valor já consumido aqui,
   * nunca disparada no mount.
   */
  const semestreAnterior = React.useRef(filtros.semestre);
  React.useEffect(() => {
    if (semestreAnterior.current !== filtros.semestre) {
      filtroAlterado('semestre', filtros.semestre);
      semestreAnterior.current = filtros.semestre;
    }
  }, [filtros.semestre, filtroAlterado]);

  /**
   * `gestor_filtro_alterado` para simulados (spec §10) — aqui SIM dá para
   * envolver o `onChange` direto (`SeletorSimulados` recebe o handler como
   * prop, ao contrário de `FiltroSemestre`), então o valor emitido é o exato
   * clique da gestora, nunca uma correção automática de URL.
   */
  const aoTrocarSimulados = React.useCallback(
    (ids: string[]) => {
      filtros.setSimulados(ids);
      filtroAlterado('simulados', ids.join(','));
    },
    [filtros, filtroAlterado],
  );

  const consulta = useDetalhamento(filtrosGestor);
  const dados = consulta.data as DetalhamentoComExtras | undefined;
  const meta = consulta.meta ?? META_VAZIA;

  const mostrarQuestoes = deveMostrarQuestoes(filtros.simulados);
  const [ordenacaoQuestoes, setOrdenacaoQuestoes] = React.useState<OrdenacaoQuestoes>('ordem_da_prova');
  const [areaQuestoes, setAreaQuestoes] = React.useState<string | null>(null);
  const [pageQuestoes, setPageQuestoes] = React.useState(1);
  const questoes = useQuestoes(
    filtrosGestor,
    { page: pageQuestoes, pageSize: 20, sort: ordenacaoQuestoes, area: areaQuestoes },
  );
  const paginaQuestoes = questoes.data;

  const [recorte, setRecorte] = React.useState<RecorteCruzado | null>(null);
  const [alunoSelecionadoId, setAlunoSelecionadoId] = React.useState<string | null>(null);

  /**
   * `gestor_drawer_aberto('aluno')` + `marcarPrimeiroInsight` (spec §10):
   * `TabelaAlunosSimulado` e `DispersaoChart` são os dois gatilhos de abertura
   * do `DrawerAluno` — ambos já recebem este handler como prop, então a
   * telemetria entra aqui, uma única vez, para os dois.
   */
  const aoSelecionarAluno = React.useCallback(
    (id: string) => {
      setAlunoSelecionadoId(id);
      drawerAberto('aluno');
      marcarPrimeiroInsight();
    },
    [drawerAberto, marcarPrimeiroInsight],
  );

  const semSelecao = filtros.simulados.length === 0;
  const multiSimulado = filtros.simulados.length > 1;

  // §12 caso 4: sem simulado, `useDetalhamento` nasce `enabled:false` e não
  // passa por `isLoading` — o vazio aqui é sobre a SELEÇÃO, não sobre a query.
  const estado: EstadoBloco = semSelecao
    ? 'empty'
    : iesAtivaId === null || consulta.isLoading
      ? 'loading'
      : consulta.isError
        ? 'error'
        : dados
          ? 'ok'
          : 'empty';

  const alunoSelecionado = dados?.alunos?.find((a) => a.id === alunoSelecionadoId) ?? null;

  return (
    <div className="space-y-6 p-6">
      <h1 className="text-xl font-semibold text-foreground">Detalhamento por simulados</h1>

      <div data-testid="bloco-filtros" className="space-y-3">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <FiltroSemestre />
          <Sheet>
            <SheetTrigger asChild>
              <Button variant="outline" size="sm">
                <CalendarDays className="mr-1.5 h-4 w-4" aria-hidden="true" />
                Ver cronograma
              </Button>
            </SheetTrigger>
            <SheetContent container={portalContainer} side="right" className="w-full sm:max-w-md">
              <SheetHeader>
                <SheetTitle>Cronograma de simulados</SheetTitle>
              </SheetHeader>
              <div className="mt-4">
                <CronogramaSimulados iesId={iesAtivaId ?? ''} iesNome={iesNomeAtiva} />
              </div>
            </SheetContent>
          </Sheet>
        </div>

        <ContextoDoRecorte semestre={filtros.semestre} meta={meta} emTransicao={consulta.isPlaceholderData === true} />

        <SeletorSimulados itens={itensCronograma} selecionados={filtros.simulados} onChange={aoTrocarSimulados} />

        <p data-testid="nota-reatividade" className="text-sm text-muted-foreground">
          Os indicadores abaixo reagem ao semestre e aos simulados selecionados. Com 2 ou mais simulados as médias são
          recalculadas e o conceito ENAMED vira comparativo, nunca média.
        </p>
      </div>

      {semSelecao ? (
        <EstadoVazioDetalhamento />
      ) : (
        <>
          <div data-testid="bloco-kpis">
            <BlocoGestor estado={estado} alturaSkeleton={140} bloco="kpis" testIdLoading="bloco-kpis-loading">
              {dados ? <KpisDetalhamento metricas={dados.metricas} meta={meta} /> : null}
            </BlocoGestor>
          </div>

          {multiSimulado && (
            <div data-testid="bloco-comparativo">
              <BlocoGestor estado={estado} alturaSkeleton={220} bloco="comparativo" testIdLoading="bloco-comparativo-loading">
                {dados ? <ComparativoSimulados metricas={dados.metricas} comparativoTemas={dados.comparativoTemas} /> : null}
              </BlocoGestor>
            </div>
          )}

          <div data-testid="bloco-evolucao">
            <BlocoGestor estado={estado} alturaSkeleton={300} bloco="evolucao" testIdLoading="bloco-evolucao-loading">
              {dados ? (
                <EvolucaoRecorte metricas={dados.metricas} semestre={filtros.semestre} dispersao={dados.dispersao} />
              ) : null}
            </BlocoGestor>
          </div>

          <div data-testid="bloco-area-semestre">
            <BlocoGestor estado={estado} alturaSkeleton={280} bloco="area-semestre" testIdLoading="bloco-area-semestre-loading">
              {dados ? (
                <AcertoPorAreaESemestre
                  dados={dados.acertoPorAreaESemestre}
                  semestre={filtros.semestre}
                  matriz={dados.acertoPorAreaESemestre.matriz}
                  recorte={recorte}
                  onRecorteChange={setRecorte}
                />
              ) : null}
            </BlocoGestor>
          </div>

          <div data-testid="bloco-dispersao" className="rounded-lg border border-border bg-card p-4">
            <h3 className="mb-3 text-base font-semibold text-foreground">Nota por semestre</h3>
            <BlocoGestor estado={estado} alturaSkeleton={280} bloco="dispersao" testIdLoading="bloco-dispersao-loading">
              {dados ? <DispersaoChart pontos={dados.dispersao} onSelecionarAluno={aoSelecionarAluno} /> : null}
            </BlocoGestor>
          </div>

          <div data-testid="bloco-alunos">
            <BlocoGestor estado={estado} alturaSkeleton={320} bloco="alunos" testIdLoading="bloco-alunos-loading">
              {dados ? (
                <TabelaAlunosSimulado
                  alunos={dados.alunos ?? []}
                  multiSimulado={multiSimulado}
                  alunoSelecionadoId={alunoSelecionadoId}
                  onSelecionarAluno={aoSelecionarAluno}
                />
              ) : null}
            </BlocoGestor>
          </div>

          {/* §4.7.3-4: último componente da página e ausente com 2+ simulados. */}
          {mostrarQuestoes && (
            <div data-testid="bloco-questoes">
              <TabelaQuestoes
                questoes={paginaQuestoes?.data ?? []}
                total={paginaQuestoes?.total ?? 0}
                page={paginaQuestoes?.page ?? pageQuestoes}
                pageSize={paginaQuestoes?.pageSize ?? 20}
                onPageChange={setPageQuestoes}
                ordenacao={ordenacaoQuestoes}
                onOrdenacaoChange={(o) => {
                  setOrdenacaoQuestoes(o);
                  setPageQuestoes(1);
                }}
                areas={dados ? [...new Set(dados.acertoPorAreaESemestre.areas.map((a) => a.nome))] : []}
                areaSelecionada={areaQuestoes}
                onAreaChange={(a) => {
                  setAreaQuestoes(a);
                  setPageQuestoes(1);
                }}
                processando={itensCronograma.some((i) => filtros.simulados.includes(i.id) && i.status === 'processing')}
              />
            </div>
          )}

          <DrawerAluno
            alunoId={alunoSelecionadoId}
            nome={alunoSelecionado?.nome ?? ''}
            simulados={filtros.simulados}
            onFechar={() => setAlunoSelecionadoId(null)}
          />
        </>
      )}
    </div>
  );
}
