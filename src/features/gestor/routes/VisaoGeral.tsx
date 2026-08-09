import * as React from 'react';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { useGestorContexto, useVisaoGeral } from '@/features/gestor/api/queries';
import { useFiltrosGestor } from '@/features/gestor/hooks/useFiltrosGestor';
import { useDelayedLoading } from '@/features/gestor/hooks/useDelayedLoading';
import { FiltroSemestre } from '@/features/gestor/components/FiltroSemestre';
import { BlocoGestor } from '@/features/gestor/components/BlocoGestor';
import { BlocoInsights } from '@/features/gestor/components/BlocoInsights';
import { CascataDiagnostico, type RecorteDiagnostico } from '@/features/gestor/components/CascataDiagnostico';
import { CabecalhoTela, ChipRecorte, ContainerRota } from '@/features/gestor/components/CabecalhoTela';
import { ContextoDoRecorte } from '@/features/gestor/components/ContextoDoRecorte';

import { Dica } from '@/features/gestor/components/Dica';
import { DrawerTemas, type EspecialidadeSelecionada } from '@/features/gestor/components/DrawerTemas';
import { GestorSkeleton } from '@/features/gestor/components/GestorSkeleton';
import { Glossario } from '@/features/gestor/components/Glossario';
import { GraficoProtagonista } from '@/features/gestor/components/GraficoProtagonista';
import { KpisVisaoGeral } from '@/features/gestor/components/KpisVisaoGeral';
import { TabelaAlunos } from '@/features/gestor/components/TabelaAlunos';
import { VisaoDeAlunos, VisaoDeAlunosCarregando } from '@/features/gestor/components/VisaoDeAlunos';
import { useTelemetriaGestor } from '@/features/gestor/lib/telemetria';
import type { FiltrosGestor, Meta, NivelDesempenho } from '@/features/gestor/api/types';
import { ROTULO_NIVEL } from '@/features/gestor/lib/rotulos';

const META_VAZIA: Meta = {
  periodo: '—',
  fonte: '—',
  atualizadoEm: '',
  criterio: '—',
  partial: false,
  lowSample: false,
};

/**
 * Reveal em cascata na MONTAGEM da rota (spec de motion §16): `opacity 0→1` +
 * `translateY(8px→0)`, 320ms, curva de entrada (`--gp-ease-in`), 40ms de
 * defasagem entre blocos, no máximo 3 níveis — do 4º bloco em diante (índice
 * ≥ 2) o delay fica cravado em 80ms, nunca cresce.
 *
 * CSS puro (`tailwindcss-animate`), não Framer Motion, por dois motivos: (1)
 * o `animate-in`/`fade-in-0`/`slide-in-from-bottom-2` já é o padrão usado
 * nesta mesma tela para a entrada do detalhe micro (`animate-in
 * [animation-duration:320ms] fade-in-0 slide-in-from-top-2`, abaixo) — usar a
 * mesma família de classe para os blocos de nível superior não introduz uma
 * segunda linguagem de motion nem uma dependência nova neste arquivo; (2) a
 * keyframe do plugin dispara uma única vez, na CRIAÇÃO do nó — trocar filtro,
 * paginar ou voltar de um drawer nunca desmonta estes blocos, então nada
 * disso redispara o reveal, sem precisar de nenhum controle de estado extra.
 * `fill-mode-backwards` evita o flash de conteúdo cheio durante o delay: sem
 * ele, o bloco fica visível no estado final por 40/80ms antes de "saltar"
 * para opacidade 0/translateY(8px) no instante em que a animação começa.
 *
 * `prefers-reduced-motion` já está coberto: o bloco global de
 * `gestor-theme.css` zera `animation-duration` (`!important`) para todo
 * descendente de `.gestor-portal` — que é onde `GestorShell` monta esta rota
 * — então não é preciso nenhum tratamento extra em JS (isso só seria
 * necessário com Framer Motion, que não passa por CSS `animation-duration`).
 */
function classeRevelacao(indice: number): string {
  const BASE =
    'animate-in fade-in-0 slide-in-from-bottom-2 fill-mode-backwards [animation-duration:320ms] [animation-timing-function:var(--gp-ease-in)]';
  if (indice <= 0) return `${BASE} [animation-delay:0ms]`;
  if (indice === 1) return `${BASE} [animation-delay:40ms]`;
  return `${BASE} [animation-delay:80ms]`;
}

/** Ordem fixa dos 3 grupos de nível no skeleton — mesma de `CascataDiagnostico`. */
const ORDEM_NIVEL_SKELETON: NivelDesempenho[] = ['critico', 'mediano', 'excelente'];

/**
 * Quantas linhas de "área" o skeleton de cada nível desenha — não é a
 * contagem real (que ainda não chegou), só o suficiente para comunicar
 * "isto vai ser uma lista", sem virar 3 retângulos idênticos.
 */
const LINHAS_SKELETON_POR_NIVEL: Record<NivelDesempenho, number> = {
  critico: 2,
  mediano: 3,
  excelente: 1,
};

/**
 * Skeleton do card-resumo do Diagnóstico Curricular (spec §5, item 10): 3
 * grupos de nível (crítico/mediano/excelente), cada um com 1 a 3 linhas de
 * área em skeleton (nome + trilho + %) — não precisa ser pixel-perfect (o
 * card real, em `CascataDiagnostico`, desenha chips soltos por área, não
 * trilho+%), só precisa comunicar a FORMA "lista de áreas por nível", nunca
 * um retângulo genérico.
 *
 * Vive aqui, e não em `CascataDiagnostico.tsx`: o loading desta seção é
 * decidido pela query da TELA (`estado`, calculado nesta rota) ANTES de
 * `CascataDiagnostico` chegar a montar — exatamente por isso o skeleton
 * genérico de sempre vinha de `BlocoGestor`, não do componente real. Este
 * substitui aquele, só para este bloco.
 *
 * `useDelayedLoading` (Onda 1, spec de motion §7): o chamador só monta este
 * componente enquanto `estado === 'loading'`, e cada montagem nova rearma os
 * 400ms do hook — o mesmo comportamento de `VisaoDeAlunosCarregando`.
 */
function DiagnosticoResumoCarregando() {
  const mostrarSkeleton = useDelayedLoading(true);

  return (
    <section data-testid="bloco-diagnostico" aria-labelledby="titulo-diagnostico" aria-busy="true">
      <Card>
        <CardHeader className="flex flex-row flex-wrap items-center gap-2 pb-4">
          <h2 id="titulo-diagnostico" style={{ fontSize: 16, fontWeight: 700 }}>
            Diagnóstico Curricular
          </h2>
        </CardHeader>
        <CardContent className="pt-0">
          {mostrarSkeleton ? (
            <div data-testid="bloco-diagnostico-loading" className="grid gap-3.5 sm:grid-cols-3">
              {ORDEM_NIVEL_SKELETON.map((nivel) => (
                <div
                  key={nivel}
                  className="flex flex-col gap-2.5 border border-border p-4"
                  style={{ borderRadius: 12 }}
                >
                  {/* Contagem + classificação do nível, em skeleton. */}
                  <GestorSkeleton altura={22} rotulo={`Carregando ${ROTULO_NIVEL[nivel]}`} className="w-8" />
                  <span className="flex items-center gap-[7px]">
                    <span
                      aria-hidden="true"
                      className="inline-block shrink-0"
                      style={{ width: 8, height: 8, borderRadius: 2, background: 'var(--gp-skeleton-brilho)' }}
                    />
                    <GestorSkeleton altura={12} rotulo={`Carregando ${ROTULO_NIVEL[nivel]}`} className="w-16" />
                  </span>
                  {/* Linhas de área: nome + trilho + % — a forma que diz
                      "lista", não um bloco só. */}
                  <ul className="flex flex-col gap-1.5">
                    {Array.from({ length: LINHAS_SKELETON_POR_NIVEL[nivel] }, (_, indice) => (
                      <li key={indice} className="flex items-center gap-2">
                        <GestorSkeleton
                          altura={10}
                          rotulo={`Carregando ${ROTULO_NIVEL[nivel]}`}
                          className="flex-1"
                        />
                        <GestorSkeleton altura={10} rotulo={`Carregando ${ROTULO_NIVEL[nivel]}`} className="w-8" />
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          ) : (
            <div aria-hidden="true" style={{ minHeight: 150 }} />
          )}
        </CardContent>
      </Card>
    </section>
  );
}

/**
 * /gestor/visao-geral — "Como estamos e onde dói?" (spec §2.1, §4.8).
 *
 * Uma única query de tela (`useVisaoGeral`) alimenta KPIs, gráfico
 * protagonista, Visão de Alunos, Diagnóstico Curricular e Insights — cada
 * bloco com seu próprio estado (`BlocoGestor`, §8.4), nunca a tela inteira.
 * A tabela de alunos e o drawer de temas têm consulta própria (paginação e
 * lazy-load, respectivamente) e por isso não dependem deste estado.
 *
 * Ordem vertical: filtros → 4 indicadores → gráfico protagonista →
 * Diagnóstico Curricular → Visão de Alunos → [tabela de alunos, sob demanda]
 * → insights. A referência PROMOVE o Diagnóstico para logo abaixo do gráfico
 * (`<!-- Diagnóstico (promovido) -->`), invertendo a ordem que o portal tinha
 * até 05/08: "onde dói?" vem antes de "quem dói?".
 *
 * Duas divergências deliberadas da §4.8, decididas em 07/08: a tabela de
 * alunos só monta quando o gestor clica em "Ver visão detalhada", e ela ficou
 * colada na Visão de Alunos (antes dos insights, sem o divisor "Detalhe ·
 * micro") em vez de no fim da página — quem abre a tabela é o CTA daquele
 * bloco, e ver a lista aparecer depois de um bloco sem relação fazia o clique
 * parecer não ter surtido efeito.
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

  /**
   * NOME da IES em foco, para o chip de contexto. Vem de `iesDisponiveis`, não
   * de `iesAtual`: `get_gestor_contexto()` não recebe `p_ies_id` e por isso
   * `iesAtual` continua sendo a IES PADRÃO do usuário mesmo depois de uma troca
   * no seletor — mesma armadilha documentada em `Inicio.tsx` e `SidebarIes.tsx`.
   */
  const iesNomeAtiva =
    contexto.data?.iesDisponiveis.find((ies) => ies.id === iesAtivaId)?.nome ?? '';



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

  /**
   * A tabela nominal de alunos só existe depois que o gestor pede.
   *
   * A tela é uma leitura MACRO — "como estamos e onde dói" (spec §2.1). A
   * tabela de alunos é a resposta a outra pergunta, feita depois, e vinha
   * montada em toda visita: centenas de linhas com nome, semestre e
   * proficiência de cada aluno pendurando o fim do scroll, além de uma
   * consulta paginada que ninguém tinha pedido. Sob demanda ela vira o que o
   * CTA promete — o passo seguinte —, e o custo (dado nominal de aluno na
   * tela, §7.7) passa a ser uma escolha, não o padrão.
   */
  const [detalheAberto, setDetalheAberto] = React.useState(false);

  /**
   * Rolar até o detalhe depois que ele monta. Sem isso o clique parece não
   * fazer nada: o bloco nasce ABAIXO da dobra, fora da vista.
   *
   * `requestAnimationFrame` porque o nó só existe no commit seguinte ao
   * `setState`. `prefers-reduced-motion` decide o `behavior`: a regra CSS de
   * `gestor-theme.css` cobre `scroll-behavior` declarado em folha, não a
   * opção passada por JS aqui.
   */
  const aoAlternarDetalhe = React.useCallback(() => {
    setDetalheAberto((aberto) => {
      if (aberto) return false;
      requestAnimationFrame(() => {
        const suave = !window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
        document
          .getElementById('alunos-detalhe')
          ?.scrollIntoView({ behavior: suave ? 'smooth' : 'auto', block: 'start' });
      });
      return true;
    });
  }, []);

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

  /**
   * Semestres que têm ao menos um aluno com resultado. Alimenta o dropdown do
   * filtro para ele não oferecer recorte que leva a tela vazia.
   *
   * A fonte preferida é `visao.semestresComResultado`, que a RPC calcula SEM o
   * recorte vigente. Derivar de `dispersao` (o caminho antigo, mantido como
   * fallback para RPC antiga/mock de teste) só funcionava enquanto o filtro
   * `6ano` não recortava nada: agora que ele recorta, `dispersao` em "6º ano"
   * só traz 11º e 12º — e o dropdown ofereceria apenas esses dois, sem caminho
   * de volta para os demais semestres.
   */
  const semestresComResultado = React.useMemo(() => {
    if (!visao) return undefined;
    if (Array.isArray(visao.semestresComResultado)) return visao.semestresComResultado;
    return [...new Set((visao.dispersao ?? []).map((ponto) => ponto.semestre))].sort((a, b) => a - b);
  }, [visao]);

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
   * Rodapé de ações do `DrawerTemas` (Task 46 / auditoria de 09/08, B4).
   *
   * O ARQUIVO é gerado pelo próprio `DrawerTemas`, que é quem tem os temas do
   * recorte em mão (`lib/exportarCsv.ts`); esta função roda DEPOIS e responde
   * pela TELA: telemetria e confirmação. Antes, era um toast de "ainda não
   * disponível" — o achado 1/3 da revisão de 04/08 tinha tirado o clique do
   * silêncio, mas o ciclo continuava aberto: o gestor não terminava a tarefa
   * dentro do produto.
   *
   * `gestor_export_solicitado` (spec §10, "valor percebido") continua com
   * `escopo: 'visao_geral'` — a §10 mede por TELA; o parâmetro recebido aqui
   * identifica a especialidade, não o escopo da telemetria.
   */
  const aoExportarRecorte = React.useCallback(
    (_escopo: string) => {
      exportSolicitado('visao_geral');
      toast({ description: 'Arquivo CSV gerado com os temas deste recorte.' });
    },
    [toast, exportSolicitado],
  );


  return (
    <ContainerRota className="pb-12" data-testid="gestor-visao-geral" aria-busy={emTransicao}>
      {/* SEM cabeçalho de tela (pedido de 09/08): sem título, sem apoio e sem
          chip de instituição. Sobra a barra de controles — glossário e filtro de
          semestre — com o resumo do recorte logo abaixo. */}
      <div data-testid="barra-filtros" className="space-y-3">
        <div className="flex flex-wrap items-center justify-end gap-3">
          {/* Único caminho de UI para o glossário no produto: sem este gatilho o
              componente existia e era inalcançável em produção. */}
          <Glossario />
          {/* `dispersao` é exatamente "aluno com nota de proficiência no
              recorte" — a mesma população que o filtro por semestre
              consegue responder. Enquanto a query não volta, `undefined`
              mantém a lista completa em vez de piscar um dropdown vazio. */}
          <FiltroSemestre semestresDisponiveis={semestresComResultado} />
        </div>
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

      {/* 1. Panorama — os 4 indicadores, sob o overline que os nomeia como bloco. */}
      <div className={`flex flex-col gap-3 ${classeRevelacao(0)}`}>
        {/*
         * A nota da régua vive num "i", não na linha do overline.
         *
         * Ela nasceu (item B5 do passe de conformidade) como texto solto ao
         * lado do rótulo, do jeito que a referência desenha. Na tela real
         * ficou uma frase técnica de uma linha inteira — "compara 1º simulado
         * · anterior · atual; com 1 simulado a régua não aparece; com 2,
         * mostra só os dois" — competindo em altura com o próprio bloco que
         * rotula, todo dia, para uma explicação que se lê uma vez. No tooltip
         * continua a um gesto de distância, e agora em linguagem de gestor:
         * o que a régua responde, não como ela é construída.
         */}
        <div className="flex flex-wrap items-center gap-[10px]">
          <span
            data-testid="overline-panorama"
            className="uppercase text-muted-foreground"
            style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.1em' }}
          >
            Panorama da instituição
          </span>
          <Dica
            testId="nota-regua-panorama"
            rotulo="Como ler a régua dos indicadores"
            texto="Cada indicador mostra a mesma medida em três momentos — o primeiro simulado do período, o anterior e o mais recente — para você ver de relance se a instituição está subindo ou caindo. Com um único simulado realizado não há o que comparar e a régua não aparece; com dois, ela mostra apenas esses dois."
          />
        </div>
        <KpisVisaoGeral
          kpis={
            visao?.kpis ?? {
              enamedProjetado: { valor: null, delta: null, serie: [], criterio: meta.criterio, origem: 'estimado' },
              proficientesPct: { valor: null, delta: null, serie: [], criterio: meta.criterio },
              acertoPct: { valor: null, delta: null, serie: [], criterio: meta.criterio },
              simulados: { realizados: 0, contratados: null },
            }
          }
          meta={meta}
          estado={estado}
          onTentarNovamente={aoTentarNovamente}
        />
      </div>

      {/* 2. Gráfico protagonista com 3 modos (Geral / Por grande área / Por aluno). */}
      <div className={classeRevelacao(1)}>
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
      </div>

      {/* 3. Diagnóstico Curricular (por grande área) + cascata ao lado. A referência
          o PROMOVE para logo abaixo do gráfico protagonista (`<!-- Diagnóstico
          (promovido) -->`), antes da Visão de Alunos — a pergunta "onde dói?" vem
          antes de "quem dói?". O vazio do grupo crítico é o CAMINHO PRINCIPAL
          (87,9% dos recortes reais, NIVEL_CRITICO_MAX em lib/regras.ts) —
          CascataDiagnostico já trata isso, nunca escondendo a seção. */}
      <div className={classeRevelacao(2)}>
        {estado === 'loading' ? (
          /* Skeleton composto do card-resumo (spec §5, item 10) em vez do
             bloco genérico de `BlocoGestor` — ver `DiagnosticoResumoCarregando`
             acima neste arquivo. */
          <DiagnosticoResumoCarregando />
        ) : (
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
        )}
      </div>

      {/* 4. Visão de Alunos — faixa larga, com o CTA "Ver visão detalhada" apontando
          para a tabela de alunos lá embaixo (nunca "drill-down"). */}
      <div className={classeRevelacao(3)}>
        {estado === 'loading' ? (
          /* Skeleton composto do card-resumo de alunos (spec §5, item 9) em
             vez do bloco genérico de `BlocoGestor` — ver
             `VisaoDeAlunosCarregando` em `components/VisaoDeAlunos.tsx`. */
          <VisaoDeAlunosCarregando />
        ) : (
          <BlocoGestor
            estado={estado}
            parcial={parcial}
            alturaSkeleton={320}
            bloco="visao-alunos"
            testIdLoading="bloco-visao-alunos-loading"
            aoTentarNovamente={aoTentarNovamente}
            mensagemVazio="Sem alunos com resultado neste recorte."
          >
            {visao ? (
              <VisaoDeAlunos
                distribuicao={visao.distribuicaoAlunos}
                /* Mesma contagem que o KPI "Simulados realizados" exibe
                   (`contarSimuladosComNotaReal`, já aplicada por `useVisaoGeral`):
                   a nota de contexto do bloco e o indicador do topo não podem
                   dizer números diferentes sobre a mesma pergunta. */
                totalSimulados={visao.kpis.simulados.realizados}
                /* Campo novo confirmado em produção em `get_gestor_visao_geral`
                   (mesmo nível de `kpis`/`evolucao`): a população matriculada da
                   IES no recorte vigente, sem o corte que `distribuicaoAlunos`
                   aplica — ver o comentário de `totalMatriculados` em
                   `VisaoDeAlunos.tsx`. */
                totalMatriculados={visao.alunosMatriculadosNoRecorte}
                onAlternarDetalhe={aoAlternarDetalhe}
                detalheAberto={detalheAberto}
              />
            ) : null}
          </BlocoGestor>
        )}
      </div>

      {/*
        4b. O detalhe micro é EXTENSÃO da Visão de Alunos, não rodapé da tela.

        Ele nasceu no fim da página, atrás dos Insights, sob o divisor
        "Detalhe · micro" da ordem original da §4.8. Só que quem abre a tabela
        é o CTA da Visão de Alunos, logo acima — e a lista aparecia depois de
        um bloco inteiro sem relação, o que fazia o clique parecer não ter
        surtido efeito e quebrava a leitura "grupos de evolução → quem são
        esses alunos".

        Sem divisor: a tabela já traz o próprio cabeçalho ("Alunos", com
        subtítulo), e um separador entre ela e o bloco que a abriu empurraria
        de volta para a leitura de "seção nova". Divergência deliberada da
        ordem vertical da §4.8, decidida em 07/08.

        A entrada é `motion-4` (320ms), a mesma família de classes do ramo que
        abre na cascata do Diagnóstico — o portal tem uma régua só de
        movimento. Sob `prefers-reduced-motion` o bloco `@media` de
        `gestor-theme.css` zera a duração para todo descendente do portal: o
        conteúdo aparece, o movimento não.

        `id` é o destino do scroll e o `aria-controls` do CTA.
      */}
      {detalheAberto ? (
        <div
          id="alunos-detalhe"
          data-testid="detalhe-micro"
          className="animate-in [animation-duration:320ms] fade-in-0 slide-in-from-top-2"
        >
          <TabelaAlunos
            recorte={filtrosGestor}
            colunasSimulados={colunasSimulados}
            distribuicaoGrupos={visao?.distribuicaoAlunos}
          />
        </div>
      ) : null}

      {/* 5. Insights autogerados (1 por área, 1 por aluno). */}
      <div className={classeRevelacao(4)}>
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
      </div>

      <DrawerTemas
        especialidade={especialidadeAberta}
        recorte={recorteDiagnostico}
        onFechar={() => setEspecialidadeAberta(null)}
        onExportarRecorte={aoExportarRecorte}
      />
    </ContainerRota>

  );
}
