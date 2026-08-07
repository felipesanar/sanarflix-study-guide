import * as React from 'react';
import { useNavigate } from 'react-router-dom';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { Icon } from '../components/Icon';
import { useCronograma, useDetalhamento, useGestorContexto, useQuestoes } from '../api/queries';
import { useFiltrosGestor } from '../hooks/useFiltrosGestor';
import { AcertoPorAreaESemestre } from '../components/AcertoPorAreaESemestre';
import { BlocoGestor, type EstadoBloco } from '../components/BlocoGestor';
import { ComparativoSimulados } from '../components/ComparativoSimulados';
import { ContextoDoRecorte } from '../components/ContextoDoRecorte';
import { CronogramaSimulados } from '../components/CronogramaSimulados';
import { DrawerAluno } from '../components/DrawerAluno';
import { DispersaoChart } from '../charts/DispersaoChart';
import { EstadoVazio } from '../components/EstadoVazio';
import { EstadoVazioDetalhamento } from '../components/EstadoVazioDetalhamento';
import { EvolucaoRecorte, ehSemestreEspecifico } from '../components/EvolucaoRecorte';
import { FiltroSemestre } from '../components/FiltroSemestre';
import { KpisDetalhamento } from '../components/KpisDetalhamento';
import { SeletorSimulados, motivoIndisponivel } from '../components/SeletorSimulados';
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
  const navegar = useNavigate();

  // Mesmo padrão de Inicio.tsx/VisaoGeral.tsx: a URL é hint de UI, a IES
  // autoritativa vem do servidor.
  const iesAtivaId = filtros.iesId ?? contexto.data?.iesAtual.id ?? null;
  const iesNomeAtiva = contexto.data?.iesDisponiveis.find((ies) => ies.id === iesAtivaId)?.nome ?? '';

  const cronograma = useCronograma(iesAtivaId);
  /* Estabilizado: `?? []` cria um array novo a cada render, e este valor entra
     na lista de dependências do useMemo do recorte logo abaixo. */
  const itensCronograma = React.useMemo(() => cronograma.data ?? [], [cronograma.data]);

  /**
   * A URL é hint de UI e pode carregar um simulado que não pode entrar no
   * recorte — previsto, ou com gabarito em processamento. Sem reconciliar
   * contra o cronograma, `?simulados=<id em processamento>` fazia duas coisas
   * erradas ao mesmo tempo: as métricas eram pedidas e renderizadas para um
   * simulado sem gabarito fechado (spec §10.4: "nenhum número é exibido"), e o
   * item aparecia marcado E desabilitado no seletor, deixando o estado
   * "desmarcado" inalcançável.
   *
   * Só filtra depois que o cronograma chega: com a lista vazia ainda não há
   * como distinguir "id inválido" de "ainda não sei", e descartar cedo faria a
   * seleção piscar para vazio em todo primeiro render.
   */
  const simuladosNoRecorte = React.useMemo(() => {
    if (itensCronograma.length === 0) return filtros.simulados;
    const disponiveis = new Set(
      itensCronograma.filter((item) => motivoIndisponivel(item) === null).map((item) => item.id),
    );
    return filtros.simulados.filter((id) => disponiveis.has(id));
  }, [filtros.simulados, itensCronograma]);

  const filtrosGestor: FiltrosGestor = React.useMemo(
    () => ({ iesId: iesAtivaId, semestre: filtros.semestre, simulados: simuladosNoRecorte }),
    [iesAtivaId, filtros.semestre, simuladosNoRecorte],
  );

  /**
   * Fecha a divergência entre o que a URL diz e o que a tela mostra: depois que
   * o cronograma chega, o que foi descartado do recorte também sai do `?simulados=`.
   * Sem isto, um id inválido (trocou de IES e os ids da anterior sobreviveram na
   * query string) continuava no link colável — e voltar para ele reencenava o
   * mesmo estado inconsistente. A comparação é por string porque `filtros.simulados`
   * é um array novo a cada render.
   */
  const { setSimulados } = filtros;
  const chaveRecorte = simuladosNoRecorte.join(',');
  const chaveUrl = filtros.simulados.join(',');
  React.useEffect(() => {
    if (chaveRecorte === chaveUrl) return;
    setSimulados(chaveRecorte === '' ? [] : chaveRecorte.split(','));
  }, [chaveRecorte, chaveUrl, setSimulados]);

  /**
   * Identidade do recorte inteiro numa string. Serve aos efeitos que precisam
   * reagir a "o recorte mudou" sem depender de `useLocation().search`: os
   * filtros vêm de `useSearchParams`, que é o mesmo estado da URL por outro
   * caminho — e o único que sobrevive quando `useLocation` está stubado.
   */
  const chaveDoRecorte = `${iesAtivaId ?? ''}|${filtros.semestre}|${chaveUrl}`;

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

  /**
   * Selecionar TODOS os simulados não é um recorte — é o período inteiro, que
   * é a pergunta da Visão Geral. O Detalhamento existe para aprofundar num
   * simulado ou num subconjunto deles; com tudo marcado, cada bloco vira uma
   * média de tudo contra tudo, que é exatamente o número que a outra tela já
   * dá, e com mais contexto.
   *
   * Não bloqueamos o clique: o gestor marca à vontade e a tela EXPLICA. Um
   * checkbox que se recusa a marcar sem dizer por quê é pior do que o estado.
   *
   * Só vale a partir de 2 selecionáveis — com um simulado só na IES,
   * "todos" e "esse aqui" são a mesma coisa, e não há nada a explicar.
   */
  const idsSelecionaveis = React.useMemo(
    () => itensCronograma.filter((item) => motivoIndisponivel(item) === null).map((item) => item.id),
    [itensCronograma],
  );
  const todosSelecionados =
    idsSelecionaveis.length > 1 && simuladosNoRecorte.length === idsSelecionaveis.length;

  const consulta = useDetalhamento(filtrosGestor, !todosSelecionados);
  const dados = consulta.data as DetalhamentoComExtras | undefined;
  const meta = consulta.meta ?? META_VAZIA;
  /**
   * `partial` = há simulado selecionado que não entrou em nenhum número (a RPC
   * marca isso quando algum simulado do recorte veio com `n_tri = 0`). A Visão
   * Geral já repassava; aqui os blocos apresentavam KPIs, comparativo e tabelas
   * sem nenhum aviso de que o recorte estava incompleto.
   */
  const parcial = meta.partial;

  /**
   * Semestres que o recorte consegue responder — alimentam o dropdown do
   * filtro para ele não oferecer opção que leva a tela vazia. A própria RPC
   * já devolve só os semestres que produziram acerto. `undefined` enquanto o
   * dado não chega: mantém a lista completa em vez de piscar um dropdown
   * vazio.
   */
  const semestresComResultado = React.useMemo(
    () => dados?.acertoPorAreaESemestre?.semestres.map((s) => s.semestre),
    [dados],
  );

  const mostrarQuestoes = deveMostrarQuestoes(simuladosNoRecorte);
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
   * O recorte cruzado (área × semestre) é estado do BLOCO e só existe dentro do
   * recorte que o gerou. Sem esta limpeza, trocar semestre/simulados/IES deixava
   * o chip "Recorte: …" ligado sobre uma matriz que já não tem aquela linha: o
   * bloco mostrava "Sem dado de grande área neste recorte" com o chip aceso e,
   * quando a área sumia de `dados.areas`, o rótulo caía no id CRU da área.
   */
  React.useEffect(() => {
    setRecorte(null);
  }, [chaveDoRecorte]);

  /**
   * Paginação e filtro de área das questões também são estado do RECORTE, não
   * da tela — e não eram limpos junto.
   *
   * O sintoma: gestora na página 3 do Simulado A (60 questões) troca para o
   * Simulado B (18). `pageQuestoes` continua 3, a RPC faz
   * `v_page := GREATEST(COALESCE(p_page,1),1)` sem clampar contra o total, e
   * devolve `data: []` com `total: 18`. Como o bloco só entra em estado vazio
   * quando `total = 0`, a tabela renderiza cabeçalho e rodapé dizendo
   * "Mostrando 0 de 18 questões" com o corpo vazio. Pior: a `Paginacao` clampa
   * a exibição para "1 de 1", então os dois chevrons saem desabilitados e não
   * sobra nenhum controle que ofereça saída — a gestora fica presa.
   *
   * Mesma coisa com `areaQuestoes`: "Clínica Médica" filtrada no Simulado A
   * continuava sendo enviada no Simulado B, que pode nem ter a área. Aí a RPC
   * devolve `total: 0`, o bloco diz "Sem questões para este recorte" e o gatilho
   * do Select mostra "Grande área:" com o valor em branco, porque o valor
   * selecionado não está mais na lista derivada de `dados`.
   *
   * `setPageQuestoes(1)` já existia dentro de `onOrdenacaoChange`/`onAreaChange`
   * — a lacuna era só a troca de recorte, que não passa por nenhum dos dois.
   */
  React.useEffect(() => {
    setPageQuestoes(1);
    setAreaQuestoes(null);
  }, [chaveDoRecorte]);

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

  const semSelecao = simuladosNoRecorte.length === 0;
  const multiSimulado = simuladosNoRecorte.length > 1;

  /**
   * Retry dos blocos desta tela, no mesmo padrão da Visão Geral. Sem ele, o
   * `BlocoGestor` caía no fallback `onRetry={aoTentarNovamente ?? (() => undefined)}`:
   * o botão "Tentar novamente" renderizava, recebia foco, era clicável — e não
   * fazia nada. `refetch` vem do React Query e muda de identidade a cada
   * render; o `useCallback` fixa a referência que os seis blocos recebem.
   */
  const { refetch } = consulta;
  const aoTentarNovamente = React.useCallback(() => {
    refetch();
  }, [refetch]);

  /**
   * Mesmo remédio da Visão Geral para o `placeholderData`: na troca de recorte
   * a query serve o dado ANTERIOR, `isLoading` é false e os blocos afirmam
   * números do recorte abandonado. Não vira skeleton (a tela piscaria vazia a
   * cada filtro) — fica anunciado nos dois canais, `aria-busy` na região e uma
   * faixa `role="status"`, com a mesma copy da outra tela: componentes
   * repetidos entre as duas telas são idênticos (§12).
   */
  const emTransicao = consulta.isPlaceholderData === true;

  /**
   * Drawer do cronograma CONTROLADO. Um clique num simulado realizado navega
   * para `/gestor/detalhamento?...&simulados=<id>` — mesmo pathname, então o
   * React Router não desmonta esta rota e o Sheet ficava aberto, cobrindo o
   * resultado que a gestora acabou de filtrar. Fechar na mudança do RECORTE é
   * exatamente o gatilho certo: enquanto o Sheet está aberto ele é modal, e
   * nenhum outro filtro da tela é alcançável — então só o cronograma pode ter
   * causado a troca.
   */
  const [cronogramaAberto, setCronogramaAberto] = React.useState(false);
  React.useEffect(() => {
    setCronogramaAberto(false);
  }, [chaveDoRecorte]);

  /**
   * Estado do bloco de questões, no mesmo padrão dos outros seis. Era o único
   * fora do `BlocoGestor`: em carregamento e em erro a gestora via a mesma
   * tabela vazia com "Página 1 de 1", sem skeleton, mensagem nem retry.
   *
   * `processando` vence tudo: aí a tabela renderiza o próprio aviso de gabarito
   * em processamento, e trocá-lo por um vazio genérico perderia a explicação.
   */
  const processandoQuestoes = itensCronograma.some(
    (item) => simuladosNoRecorte.includes(item.id) && item.status === 'processing',
  );
  const estadoQuestoes: EstadoBloco = processandoQuestoes
    ? 'ok'
    : questoes.isLoading
      ? 'loading'
      : questoes.isError
        ? 'error'
        : (paginaQuestoes?.total ?? 0) > 0
          ? 'ok'
          : 'empty';

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
    <div className="space-y-6 p-8" data-testid="gestor-detalhamento" aria-busy={emTransicao}>
      <div data-testid="bloco-filtros" className="space-y-3">
        <div className="flex flex-wrap items-center gap-4">
          <div>
            <h1 style={{ fontSize: 20, fontWeight: 700, letterSpacing: '-0.01em' }}>
              Detalhamento por simulados
            </h1>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Camada investigativa · métricas por simulado específico
            </p>
          </div>

          <div className="ml-auto flex flex-wrap items-center gap-2.5">
            {/* `acertoPorAreaESemestre.semestres` já é a lista de semestres
                que produziram acerto no recorte — não oferecer os outros. */}
            <FiltroSemestre semestresDisponiveis={semestresComResultado} />
            <Sheet open={cronogramaAberto} onOpenChange={setCronogramaAberto}>
              <SheetTrigger asChild>
                {/* Link de texto, não botão de contorno: na referência o glifo de
                    calendário pertence ao CABEÇALHO do drawer, e o gatilho leva só
                    o chevron, DEPOIS do rótulo. */}
                <button
                  type="button"
                  className="inline-flex items-center gap-1 whitespace-nowrap rounded-sm underline-offset-4 hover:underline focus-visible:outline-none"
                  style={{ fontSize: 12, fontWeight: 600, color: 'var(--gp-brand-on-dark)' }}
                >
                  Ver cronograma
                  <Icon name="chevron_right" size={14} />
                </button>
              </SheetTrigger>
              {/* Fechar do PORTAL, não o do shadcn: o `X` do Lucide é de outra
                  família de ícones (handoff §3 exige 100% Fontello do Dendê) e
                  anunciava "Close" num portal inteiro em pt-BR. O scrim vem de
                  `--gp-scrim`, calibrado por tema no `gestor-theme.css` —
                  `bg-black/80` é opaco demais para o claro. */}
              <SheetContent
                container={portalContainer}
                side="right"
                className="w-full sm:max-w-md"
                closeIcon={<Icon name="close" size={16} />}
                closeLabel="Fechar"
                closeClassName="inline-flex h-[30px] w-[30px] items-center justify-center rounded-[8px] border border-[color:var(--gp-border-strong)] text-[color:var(--gp-text-3)] opacity-100"
                overlayClassName="bg-[var(--gp-scrim)]"
              >
                <SheetHeader>
                  <SheetTitle className="flex items-center gap-2" style={{ fontSize: 15, fontWeight: 700 }}>
                    <Icon name="calendar_month" variant="filled" size={18} />
                    Cronograma de simulados
                  </SheetTitle>
                </SheetHeader>
                <div className="mt-4">
                  <CronogramaSimulados iesId={iesAtivaId ?? ''} iesNome={iesNomeAtiva} />
                </div>
              </SheetContent>
            </Sheet>
          </div>
        </div>

        <ContextoDoRecorte semestre={filtros.semestre} meta={meta} emTransicao={emTransicao} />

        <SeletorSimulados itens={itensCronograma} selecionados={simuladosNoRecorte} onChange={aoTrocarSimulados} />
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

      {semSelecao ? (
        <EstadoVazioDetalhamento />
      ) : todosSelecionados ? (
        <div data-testid="detalhamento-todos-selecionados">
          <EstadoVazio
            glifo="insights"
            titulo="Todos os simulados estão selecionados"
            descricao="Isso é o período inteiro, que é a leitura da Visão Geral. O Detalhamento existe para aprofundar num simulado específico — ou num recorte deles. Desmarque ao menos um para ver os números aqui."
            acao={{
              rotulo: 'Ir para a Visão Geral',
              onClick: () => navegar({ pathname: '/gestor/visao-geral', search: window.location.search }),
            }}
          />
        </div>
      ) : (
        <>
          {/* A nota é LEGENDA do grupo de métricas, não parágrafo da barra de
              filtros: 11px, colada no topo do que ela explica. Em 14px dentro do
              bloco de filtros ela competia com os próprios KPIs que legenda. */}
          <div className="space-y-0.5" data-testid="bloco-kpis">
            <p data-testid="nota-reatividade" className="text-muted-foreground" style={{ fontSize: 11, lineHeight: '16px' }}>
              Os indicadores abaixo reagem ao semestre e aos simulados selecionados. Com 2 ou mais simulados as médias são
              recalculadas e o conceito ENAMED vira comparativo, nunca média.
            </p>
            <BlocoGestor
              estado={estado}
              parcial={parcial}
              alturaSkeleton={140}
              bloco="kpis"
              testIdLoading="bloco-kpis-loading"
              aoTentarNovamente={aoTentarNovamente}
            >
              {dados ? <KpisDetalhamento metricas={dados.metricas} meta={meta} /> : null}
            </BlocoGestor>
          </div>

          {multiSimulado && (
            <div data-testid="bloco-comparativo">
              <BlocoGestor
                estado={estado}
                parcial={parcial}
                alturaSkeleton={220}
                bloco="comparativo"
                testIdLoading="bloco-comparativo-loading"
                aoTentarNovamente={aoTentarNovamente}
              >
                {dados ? <ComparativoSimulados metricas={dados.metricas} comparativoTemas={dados.comparativoTemas} /> : null}
              </BlocoGestor>
            </div>
          )}

          {/*
            "Evolução do recorte" só com 2+ simulados no recorte.

            Com um simulado não há evolução: o card ficava 300px de altura
            para mostrar um ponto solto no meio do vazio e a frase "primeira
            medição; a evolução aparece a partir do segundo simulado" — meia
            tela de scroll para dizer que não há o que dizer, entre dois
            blocos que TÊM conteúdo. O número daquele ponto já está no KPI de
            proficiência logo acima, então nada se perde ao remover o bloco.
            A decisão sai da SELEÇÃO (`simuladosNoRecorte`), conhecida antes
            da resposta, e não da contagem de pontos medidos: assim o bloco
            nunca aparece como skeleton para sumir quando o dado chega.

            Com um semestre específico o bloco não é evolução — é a
            distribuição daquele semestre (`ehSemestreEspecifico`, §4.5), que
            faz sentido com um simulado só e por isso continua aparecendo.
          */}
          {ehSemestreEspecifico(filtros.semestre) || simuladosNoRecorte.length > 1 ? (
            <div data-testid="bloco-evolucao">
              <BlocoGestor
                estado={estado}
                parcial={parcial}
                alturaSkeleton={300}
                bloco="evolucao"
                testIdLoading="bloco-evolucao-loading"
                aoTentarNovamente={aoTentarNovamente}
              >
                {dados ? (
                  <EvolucaoRecorte metricas={dados.metricas} semestre={filtros.semestre} dispersao={dados.dispersao} />
                ) : null}
              </BlocoGestor>
            </div>
          ) : null}

          {/* Área × semestre e dispersão são o MESMO movimento de exploração — a
              referência os põe lado a lado (1.15fr/1fr). Empilhados, a dispersão
              caía um scroll inteiro depois da leitura que ela complementa. */}
          <div className="grid items-stretch gap-4 lg:grid-cols-[1.15fr_1fr]">
            <div data-testid="bloco-area-semestre">
              <BlocoGestor
                estado={estado}
                parcial={parcial}
                alturaSkeleton={280}
                bloco="area-semestre"
                testIdLoading="bloco-area-semestre-loading"
                aoTentarNovamente={aoTentarNovamente}
              >
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
              {/* O nome nomeia os dois eixos — é o que a legenda abaixo explica. */}
              <h3 className="mb-3 text-base font-semibold text-foreground">Dispersão Nota × Semestre</h3>
              <BlocoGestor
                estado={estado}
                parcial={parcial}
                alturaSkeleton={280}
                bloco="dispersao"
                testIdLoading="bloco-dispersao-loading"
                aoTentarNovamente={aoTentarNovamente}
              >
                {dados ? <DispersaoChart pontos={dados.dispersao} onSelecionarAluno={aoSelecionarAluno} /> : null}
              </BlocoGestor>
            </div>
          </div>

          <div data-testid="bloco-alunos">
            <BlocoGestor
              estado={estado}
              parcial={parcial}
              alturaSkeleton={320}
              bloco="alunos"
              testIdLoading="bloco-alunos-loading"
              aoTentarNovamente={aoTentarNovamente}
            >
              {/* `undefined` e `[]` NÃO são a mesma coisa aqui, e tratá-los
                  igual era um defeito: `get_gestor_detalhamento` nunca emitiu a
                  chave `alunos` (nenhuma versão da função, em nenhuma
                  migration), então `dados.alunos ?? []` fazia a tabela afirmar
                  "Nenhum aluno neste recorte · 0 participantes" para uma IES
                  com centenas de alunos que participaram. `[]` é uma resposta
                  do servidor e pode ser dita; `undefined` é o servidor não ter
                  respondido, e sobre isso a tela não pode concluir nada. */}
              {dados ? (
                dados.alunos === undefined ? (
                  <EstadoVazio
                    glifo="groups"
                    titulo="Lista de alunos indisponível neste recorte"
                    descricao="A consulta do Detalhamento ainda não devolve os alunos por simulado. Os indicadores acima e a dispersão já refletem este recorte."
                  />
                ) : (
                  <TabelaAlunosSimulado
                    alunos={dados.alunos}
                    multiSimulado={multiSimulado}
                    alunoSelecionadoId={alunoSelecionadoId}
                    onSelecionarAluno={aoSelecionarAluno}
                  />
                )
              ) : null}
            </BlocoGestor>
          </div>

          {/* §4.7.3-4: último componente da página e ausente com 2+ simulados. */}
          {mostrarQuestoes && (
            <div data-testid="bloco-questoes">
              <BlocoGestor
                estado={estadoQuestoes}
                alturaSkeleton={360}
                bloco="questoes"
                testIdLoading="bloco-questoes-loading"
                aoTentarNovamente={questoes.refetch}
                mensagemVazio="Sem questões para este recorte."
              >
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
                  processando={processandoQuestoes}
                />
              </BlocoGestor>
            </div>
          )}

          <DrawerAluno
            alunoId={alunoSelecionadoId}
            nome={alunoSelecionado?.nome ?? ''}
            simulados={simuladosNoRecorte}
            onFechar={() => setAlunoSelecionadoId(null)}
          />
        </>
      )}
    </div>
  );
}
