import * as React from 'react';
import { Separator } from '@/components/ui/separator';
import { useToast } from '@/hooks/use-toast';
import { useGestorContexto, useVisaoGeral } from '@/features/gestor/api/queries';
import { useFiltrosGestor } from '@/features/gestor/hooks/useFiltrosGestor';
import { FiltroSemestre } from '@/features/gestor/components/FiltroSemestre';
import { BlocoGestor } from '@/features/gestor/components/BlocoGestor';
import { BlocoInsights } from '@/features/gestor/components/BlocoInsights';
import { CascataDiagnostico, type RecorteDiagnostico } from '@/features/gestor/components/CascataDiagnostico';
import { ContextoDoRecorte } from '@/features/gestor/components/ContextoDoRecorte';
import { DrawerTemas, type EspecialidadeSelecionada } from '@/features/gestor/components/DrawerTemas';
import { GraficoProtagonista } from '@/features/gestor/components/GraficoProtagonista';
import { KpisVisaoGeral } from '@/features/gestor/components/KpisVisaoGeral';
import { TabelaAlunos } from '@/features/gestor/components/TabelaAlunos';
import { VisaoDeAlunos } from '@/features/gestor/components/VisaoDeAlunos';
import { useTelemetriaGestor } from '@/features/gestor/lib/telemetria';
import type { FiltrosGestor, Meta } from '@/features/gestor/api/types';

const META_VAZIA: Meta = {
  periodo: '—',
  fonte: '—',
  atualizadoEm: '',
  criterio: '—',
  partial: false,
  lowSample: false,
};

/**
 * /gestor/visao-geral — "Como estamos e onde dói?" (spec §2.1, §4.8).
 *
 * Uma única query de tela (`useVisaoGeral`) alimenta KPIs, gráfico
 * protagonista, Visão de Alunos, Diagnóstico Curricular e Insights — cada
 * bloco com seu próprio estado (`BlocoGestor`, §8.4), nunca a tela inteira.
 * A tabela de alunos e o drawer de temas têm consulta própria (paginação e
 * lazy-load, respectivamente) e por isso não dependem deste estado.
 *
 * Ordem vertical §4.8, com Visão de Alunos ACIMA da visão por área (decisão
 * 22/07: macro antes do micro).
 */
export default function VisaoGeral() {
  const filtros = useFiltrosGestor();
  const contexto = useGestorContexto();
  const { toast } = useToast();
  const { telaVista, filtroAlterado, drawerAberto, marcarPrimeiroInsight, exportSolicitado } = useTelemetriaGestor();

  /**
   * A URL é hint de UI; a IES autoritativa vem do servidor — mesmo padrão de
   * `Inicio.tsx` (`iesAtivaId = iesId ?? contexto?.iesAtual.id ?? null`).
   * Sem esta queda para o contexto, um acesso sem `?ies` na URL (link colado,
   * bookmark, F5 no caminho puro `/gestor/visao-geral`) mantém `iesId` nulo
   * até `SidebarIes` semear a URL, e a query desta tela nasce `enabled:false`
   * — achados 2 e 4 da revisão de 04/08.
   */
  const iesAtivaId = filtros.iesId ?? contexto.data?.iesAtual.id ?? null;

  const filtrosGestor: FiltrosGestor = React.useMemo(
    () => ({ iesId: iesAtivaId, semestre: filtros.semestre, simulados: filtros.simulados }),
    [iesAtivaId, filtros.semestre, filtros.simulados],
  );

  /** `CascataDiagnostico`/`DrawerTemas` só precisam de IES + semestre (`RecorteDiagnostico`). */
  const recorteDiagnostico: RecorteDiagnostico = React.useMemo(
    () => ({ iesId: iesAtivaId, semestre: filtros.semestre }),
    [iesAtivaId, filtros.semestre],
  );

  /** `gestor_tela_vista` (spec §10, "adoção por tela") — reinicia também o relógio do primeiro insight. */
  React.useEffect(() => {
    telaVista('visao_geral', filtros.semestre);
  }, [telaVista, filtros.semestre]);

  /**
   * `gestor_filtro_alterado` para o semestre (spec §10, "o filtro está sendo
   * usado?"). `FiltroSemestre` lê/escreve `useFiltrosGestor()` direto, sem
   * prop de callback até aqui — por isso a troca é OBSERVADA no valor já
   * consumido nesta rota, nunca disparada no mount (o ref começa igual ao
   * valor atual; só o dispara quando o valor realmente muda).
   */
  const semestreAnterior = React.useRef(filtros.semestre);
  React.useEffect(() => {
    if (semestreAnterior.current !== filtros.semestre) {
      filtroAlterado('semestre', filtros.semestre);
      semestreAnterior.current = filtros.semestre;
    }
  }, [filtros.semestre, filtroAlterado]);

  const consulta = useVisaoGeral(filtrosGestor);
  const [especialidadeAberta, setEspecialidadeAberta] = React.useState<EspecialidadeSelecionada | null>(null);

  const visao = consulta.data;
  const meta = consulta.meta ?? META_VAZIA;

  /**
   * Sem IES resolvida (nem da URL, nem do contexto) a query da tela nasce
   * DESABILITADA: no React Query v5, `isLoading` só é `true` com um fetch em
   * andamento (`isPending && isFetching`), então uma query `enabled:false`
   * fica em 'pending'/'idle' para sempre — nunca passa por `isLoading`. Sem
   * este ramo o ternário caía direto em 'empty' e a tela afirmava "sem
   * simulados"/"sem alunos" ANTES de qualquer requisição (achados 2 e 4).
   *
   * Uma falha do contexto (`get_gestor_contexto`) só pode travar ESTA tela
   * quando é a ÚNICA fonte possível de IES — ou seja, quando a URL ainda não
   * tem `?ies` (`filtros.iesId === null`). Com `?ies` presente, a query já
   * dispara pelo valor da URL, independente do contexto: um erro dele aqui
   * NÃO pode derrubar uma tela que já tem dado bom (ressalva do achado 4 —
   * "com ?ies presente, uma falha do contexto não afeta esta tela").
   */
  const semRecorteNaUrl = filtros.iesId === null;
  const contextoTravouRecorte = semRecorteNaUrl && contexto.isError;
  const semIesResolvida = iesAtivaId === null;
  const estado = contextoTravouRecorte
    ? 'error'
    : semIesResolvida || consulta.isLoading
      ? 'loading'
      : consulta.isError
        ? 'error'
        : visao
          ? 'ok'
          : 'empty';
  const parcial = meta.partial;

  /**
   * Troca de IES/semestre com dado do recorte ANTERIOR na mão: `useEnvelope`
   * serve `placeholderData` nesta tela (o recorte é filtro sobre a mesma tela,
   * não outro objeto), então na troca `data`/`meta` continuam sendo os do
   * recorte velho, `isLoading` é `false` e `estado` cai em 'ok' — a tela
   * AFIRMA números antigos sob um seletor já trocado, sem sinal nenhum
   * (cenário 1 da revisão de 05/08).
   *
   * Não vira 'loading': jogar skeleton a cada troca de filtro mata a razão de
   * existir do placeholder (a tela piscaria vazia toda vez). Em vez disso o
   * dado velho fica, mas ANUNCIADO — `aria-busy` na região inteira e uma
   * faixa `role="status"`, os dois canais, nunca só a opacidade — e a `meta`
   * do recorte anterior para de alimentar o `ContextoDoRecorte`, que é onde o
   * rótulo NOVO (semestre da URL) encostava no período VELHO.
   *
   * `=== true` porque hooks mockados em teste podem não devolver o campo.
   */
  const emTransicao = consulta.isPlaceholderData === true;

  /** Retry único para os blocos desta tela: refaz o contexto quando é ele que travou o recorte, senão a query da tela. */
  const aoTentarNovamente = React.useCallback(() => {
    if (contextoTravouRecorte) contexto.refetch();
    else consulta.refetch();
  }, [contextoTravouRecorte, contexto, consulta]);

  const colunasSimulados = React.useMemo(
    () => (visao?.evolucao ?? []).map((ponto) => ({ id: ponto.simuladoId, nome: ponto.nome })),
    [visao?.evolucao],
  );

  /**
   * `gestor_drawer_aberto('temas')` + `marcarPrimeiroInsight` (spec §10,
   * "profundidade de investigação" / "tempo até o primeiro insight"): a
   * abertura do `DrawerTemas` é decidida aqui (`setEspecialidadeAberta`), por
   * isso a telemetria entra neste wrapper em vez de dentro do drawer.
   */
  const aoAbrirTemas = React.useCallback(
    (especialidade: EspecialidadeSelecionada) => {
      setEspecialidadeAberta(especialidade);
      drawerAberto('temas');
      marcarPrimeiroInsight();
    },
    [drawerAberto, marcarPrimeiroInsight],
  );

  /**
   * Rodapé de ações do `DrawerTemas` (Task 46): a exportação de verdade
   * ainda não existe no produto — spec §7.7 pede export com auditoria de
   * quem/quando/escopo/formato, e nenhuma task implementa isso. O achado 1/3
   * da revisão de 04/08 apontou o clique como um no-op silencioso
   * (`() => undefined`): nenhum download, toast ou erro, ao lado de "Copiar
   * resumo", que funciona. Enquanto o export real não entra nesta fase,
   * avisamos — nunca engolimos o clique em silêncio.
   *
   * `gestor_export_solicitado` (spec §10, "valor percebido") dispara ANTES do
   * toast — a §10 pede o clique em si, não o resultado (que hoje nem existe).
   * `escopo` é sempre `'visao_geral'`: é a única tela com export hoje (via
   * `DrawerTemas`/`AcoesRecorte`); o parâmetro recebido aqui identifica a
   * especialidade, não o escopo da telemetria (que é por TELA, spec §10).
   */
  const aoExportarRecorte = React.useCallback(
    (_escopo: string) => {
      exportSolicitado('visao_geral');
      toast({ description: 'Exportação ainda não está disponível.' });
    },
    [toast, exportSolicitado],
  );

  return (
    <div className="space-y-6 p-8 pb-12" data-testid="gestor-visao-geral" aria-busy={emTransicao}>
      <div data-testid="barra-filtros" className="space-y-2">
        <FiltroSemestre />
        <ContextoDoRecorte semestre={filtros.semestre} meta={meta} emTransicao={emTransicao} />
      </div>

      {emTransicao ? (
        <p
          data-testid="faixa-transicao-recorte"
          role="status"
          className="rounded-md border border-border bg-muted/40 px-3 py-2 text-xs text-muted-foreground"
        >
          Atualizando para o recorte selecionado. Os números abaixo ainda são do recorte anterior.
        </p>
      ) : null}

      {/* 1. KPIs — o próprio componente propaga `estado` para cada KpiCard. */}
      <KpisVisaoGeral
        kpis={
          visao?.kpis ?? {
            enamedProjetado: { valor: null, delta: null, serie: [], criterio: meta.criterio },
            proficientesPct: { valor: null, delta: null, serie: [], criterio: meta.criterio },
            acertoPct: { valor: null, delta: null, serie: [], criterio: meta.criterio },
            simulados: { realizados: 0, contratados: null },
          }
        }
        meta={meta}
        estado={estado}
        onTentarNovamente={aoTentarNovamente}
      />

      {/* 2. Gráfico protagonista com 3 modos (Geral / Por grande área / Por aluno). */}
      <BlocoGestor
        estado={estado}
        parcial={parcial}
        alturaSkeleton={360}
        bloco="grafico"
        testIdLoading="bloco-grafico-loading"
        aoTentarNovamente={aoTentarNovamente}
        mensagemVazio="Sem simulados realizados neste recorte."
      >
        {visao ? <GraficoProtagonista visao={visao} /> : null}
      </BlocoGestor>

      {/* 3. Visão de Alunos (macro) — ACIMA do diagnóstico por área (decisão 22/07). */}
      <BlocoGestor
        estado={estado}
        parcial={parcial}
        alturaSkeleton={320}
        bloco="visao-alunos"
        testIdLoading="bloco-visao-alunos-loading"
        aoTentarNovamente={aoTentarNovamente}
        mensagemVazio="Sem alunos com resultado neste recorte."
      >
        {visao ? <VisaoDeAlunos distribuicao={visao.distribuicaoAlunos} dispersao={visao.dispersao} /> : null}
      </BlocoGestor>

      {/* 4. Diagnóstico Curricular (micro por grande área) + cascata ao lado. O vazio
          do grupo crítico é o CAMINHO PRINCIPAL (87,9% dos recortes reais, NIVEL_CRITICO_MAX
          em lib/regras.ts) — CascataDiagnostico já trata isso, nunca escondendo a seção. */}
      <BlocoGestor
        estado={estado}
        parcial={parcial}
        alturaSkeleton={220}
        bloco="diagnostico"
        testIdLoading="bloco-diagnostico-loading"
        aoTentarNovamente={aoTentarNovamente}
        mensagemVazio="Sem classificação por grande área neste recorte."
      >
        {visao ? (
          <CascataDiagnostico
            resumo={visao.diagnosticoResumo}
            recorte={recorteDiagnostico}
            onAbrirTemas={aoAbrirTemas}
          />
        ) : null}
      </BlocoGestor>

      {/* 5. Insights autogerados (1 por área, 1 por aluno). */}
      <BlocoGestor
        estado={estado}
        alturaSkeleton={120}
        bloco="insights"
        testIdLoading="bloco-insights-loading"
        aoTentarNovamente={aoTentarNovamente}
        mensagemVazio="Sem insights para este recorte."
      >
        {visao ? <BlocoInsights insights={visao.insights} /> : null}
      </BlocoGestor>

      {/* 6. Divisor + tabela de alunos — query própria, paginada no servidor, estado independente. */}
      <div data-testid="divisor-detalhe-micro" className="flex items-center gap-3 pt-2">
        <span className="text-[10px] uppercase tracking-widest text-muted-foreground">Detalhe · micro</span>
        <Separator className="flex-1" />
      </div>

      <TabelaAlunos recorte={filtrosGestor} colunasSimulados={colunasSimulados} />

      <DrawerTemas
        especialidade={especialidadeAberta}
        recorte={recorteDiagnostico}
        onFechar={() => setEspecialidadeAberta(null)}
        onExportarRecorte={aoExportarRecorte}
      />
    </div>
  );
}
