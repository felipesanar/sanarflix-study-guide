import * as React from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { AuthContext } from '@/contexts/AuthContext';
import { useDiagnostico } from '@/features/gestor/api/queries';
import { prefetchDiagnosticoNivel } from '@/features/gestor/api/prefetch';
import { Icon } from '@/features/gestor/components/Icon';
import type { DendeIconName } from '@/features/gestor/components/icon-names';
import { TagCoberturaParcial, TagNivel } from '@/features/gestor/components/Tag';
import { ROTULO_NIVEL } from '@/features/gestor/lib/rotulos';
import { EstadoErro } from '@/features/gestor/components/EstadoErro';
import { EstadoVazio } from '@/features/gestor/components/EstadoVazio';
import { GestorSkeleton } from '@/features/gestor/components/GestorSkeleton';
import { useDelayedLoading } from '@/features/gestor/hooks/useDelayedLoading';
import { usePrefersReducedMotion } from '@/features/gestor/hooks/usePrefersReducedMotion';
import { formatPct } from '@/features/gestor/lib/formatters';
import { NIVEL_CRITICO_MAX, NIVEL_EXCELENTE_MIN } from '@/features/gestor/lib/regras';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';

import type {
  FiltroSemestre,
  FiltrosGestor,
  NivelDesempenho,
  NoDiagnostico,
  VisaoGeral,
} from '@/features/gestor/api/types';

/**
 * Lê `user?.id` sem exigir `<AuthProvider>` real na árvore: `useAuth()`
 * (contexts/AuthContext.tsx) LANÇA fora do provider, e os testes deste
 * componente (`CascataDiagnostico.test.tsx`) montam sem um — só mockam
 * `api/queries`. `useContext(AuthContext)` direto devolve `null` nesse caso
 * (o valor padrão do contexto), nunca lança; o prefetch do item 6 (spec §22)
 * simplesmente não aquece a chave com `userId`, o que é inofensivo (o
 * pior caso é o cache aquecido não ser aproveitado por `useDiagnostico`).
 */
function useUserIdSemExigirProvider(): string | undefined {
  return React.useContext(AuthContext)?.user?.id;
}

/**
 * `Card` encaminha `ref` e espalha o resto das props no `<div>` (ver
 * `components/ui/card.tsx`) — exatamente o que `motion.create` exige para
 * animar um componente que não é `motion.div` direto. Usado só pela entrada
 * do painel lateral (spec §13.3): fade + `translateX(12px → 0)`, 320ms.
 */
const CardAnimado = motion.create(Card);

/** Ordem fixa de exibição dos 3 níveis de desempenho (spec §4.4). */
const ORDEM_NIVEL: NivelDesempenho[] = ['excelente', 'mediano', 'critico'];

/**
 * Semáforo do cartão de nível: `--gp-*` cheio no ponto, `--gp-*-on` no texto.
 *
 * A referência crava o par (#149142 ponto / #0C5728 texto e irmãos) — os
 * mesmos dois tons que os tokens semânticos do portal já carregam. Nunca a
 * paleta de GRÁFICO (`--chart-*`), que é cor de série, não de status, e nunca
 * hex cru, que não acompanharia o tema escuro.
 */
const COR_NIVEL: Record<
  NivelDesempenho,
  { ponto: string; texto: string; superficie: string; icone: DendeIconName }
> = {
  excelente: {
    ponto: 'var(--gp-success)',
    texto: 'var(--gp-success-on)',
    superficie: 'var(--gp-success-surface)',
    icone: 'arrow_upward',
  },
  mediano: {
    ponto: 'var(--gp-warning)',
    texto: 'var(--gp-warning-on)',
    superficie: 'var(--gp-warning-surface)',
    icone: 'arrow_right',
  },
  critico: {
    ponto: 'var(--gp-danger)',
    texto: 'var(--gp-danger-on)',
    superficie: 'var(--gp-danger-surface)',
    icone: 'arrow_downward',
  },
};

/**
 * Faixa de % de acerto de cada classificação, derivada de `regras.ts`
 * (`nivelDesempenho`) — nunca escrita na mão. É o critério que o gestor vê no
 * tooltip do cartão: sem isso, "Excelente desempenho" é um rótulo sem régua.
 */
const FAIXA_NIVEL: Record<NivelDesempenho, string> = {
  excelente: `${NIVEL_EXCELENTE_MIN}% de acerto ou mais`,
  mediano: `de ${NIVEL_CRITICO_MAX}% a ${NIVEL_EXCELENTE_MIN - 1}% de acerto`,
  critico: `abaixo de ${NIVEL_CRITICO_MAX}% de acerto`,
};

type AreaResumo = VisaoGeral['diagnosticoResumo'][number]['areas'][number];


/**
 * Recorte mínimo que este bloco precisa (IES + semestre). `lib/recorte.ts`
 * (Task 41, de outro agente em paralelo) promete um tipo `Recorte` com este
 * exato formato — ainda não existe nesta working tree. Definido localmente
 * por ora; troque pelo import de lá quando pousar, mesmo shape, sem quebra
 * de contrato. `useDiagnostico` (já em produção) espera `FiltrosGestor`
 * completo (com `simulados`), então a ponte é feita internamente — o
 * `simulados` nunca chega até aqui, porque a RPC `get_gestor_diagnostico`
 * não o usa.
 */
export interface RecorteDiagnostico {
  iesId: string | null;
  semestre: FiltroSemestre;
}

export interface CascataDiagnosticoProps {
  resumo: VisaoGeral['diagnosticoResumo'];
  recorte: RecorteDiagnostico;
  /**
   * `grandeArea` é o `node` do nível que contém a especialidade clicada — o
   * mesmo texto que `get_gestor_diagnostico.sql` devolve como `id`/`nome` do
   * nó de grande área (`'id', n.nome`: id e nome são o mesmo valor). É esse
   * texto que `get_gestor_diagnostico_temas` agora EXIGE em `p_grande_area`
   * (migration `20260804163000_get_gestor_diagnostico_temas_grande_area_obrigatoria.sql`)
   * para não somar temas de duas grandes áreas diferentes que tenham
   * especialidade com o mesmo nome.
   */
  onAbrirTemas: (especialidade: { id: string; nome: string; grandeArea: string }) => void;
}

/**
 * Vazio do grupo crítico — continua sendo um caminho comum, ainda que menos
 * que com o corte antigo de 30 (que deixava 87,9% dos recortes reais sem
 * nenhuma área crítica; hoje o corte é `NIVEL_CRITICO_MAX = 50`). Uma
 * gestora que vê a seção em branco conclui que a ferramenta quebrou — então
 * este bloco sempre diz o que aconteceu (com o corte vindo de `regras.ts`,
 * nunca escrito na mão) e aponta por onde começar: as áreas medianas, da
 * pior para a melhor.
 */

function DiagnosticoCriticoVazio({ mediano }: { mediano: AreaResumo[] }) {
  void mediano;

  return (
    <div data-testid="diagnostico-critico-vazio" className="space-y-2">
      <EstadoVazio
        compacto
        titulo={`Nenhuma área abaixo de ${NIVEL_CRITICO_MAX}% de acerto neste recorte`}
      />
    </div>
  );
}


/** Linha de um nó da cascata (grande área ou especialidade). */
function LinhaNo({
  no,
  aberto,
  ehFolha,
  onClick,
  onPrefetch,
}: {
  no: NoDiagnostico;
  aberto: boolean;
  ehFolha: boolean;
  onClick: () => void;
  /**
   * Prefetch do próximo nível no hover (spec §22 / motion §11 comportamento
   * 4): só passa a existir aqui quando `no.temFilhos` — hover num nó sem
   * filho não tem o que aquecer.
   */
  onPrefetch?: () => void;
}) {
  return (
    <button
      type="button"
      data-no-cascata=""
      onClick={onClick}
      onMouseEnter={no.temFilhos ? onPrefetch : undefined}
      aria-expanded={ehFolha ? undefined : aberto}
      className={cn(
        'group flex w-full items-start gap-2 rounded-md px-2 py-2 text-left text-sm transition-colors',
        '[transition-duration:var(--gp-motion-1)] [transition-timing-function:var(--gp-ease)]',
        'hover:bg-[color:var(--gp-surface-2)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
      )}
    >
      {/*
        Dois GLIFOS distintos, nunca um só girado por CSS: o handoff §3 troca
        `chevron_right-outlined` (recolhido) por `expand_more-outlined`
        (expandido) — a seta apontando para baixo é um desenho próprio da
        fonte, não o mesmo desenho a 90°. A folha não tem disclosure nenhum,
        só a caixa óptica vazia para os nomes alinharem entre irmãos.
      */}
      {ehFolha ? (
        <span aria-hidden="true" className="mt-0.5 inline-block w-4 shrink-0" />
      ) : (
        <Icon
          name={aberto ? 'expand_more' : 'chevron_right'}
          variant="outlined"
          size={16}
          box={16}
          className={cn(
            'mt-0.5 shrink-0 transition-colors [transition-duration:var(--gp-motion-1)] [transition-timing-function:var(--gp-ease)]',
            'group-hover:text-[color:var(--gp-text-2)]',
            aberto ? 'text-foreground' : 'text-muted-foreground',
          )}
        />
      )}

      {/*
        Nome em CIMA, metadados EMBAIXO. Antes tudo dividia uma linha só e, com
        a cascata em meia largura, o nome era a única parte flexível: ele
        truncava para "Pedia…" enquanto tag, % e "respostas" ficavam inteiros —
        exatamente o inverso da prioridade de leitura. O nome nunca trunca
        (`break-words`, sem `truncate`) e os metadados envolvem em várias
        linhas quando a coluna aperta.
      */}
      <span className="flex min-w-0 flex-1 flex-col gap-1">
        <span className="flex items-baseline gap-2">
          <span className="min-w-0 flex-1 break-words font-medium leading-snug text-foreground">
            {no.nome}
          </span>
          <span className="shrink-0 tabular-nums font-semibold text-foreground">
            {formatPct(no.acertoPct)}
          </span>
        </span>

        <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
          {/* Nível por NÓ (handoff §04-componentes, "Por nó: % de acerto, nível,
              badge de cobertura parcial") — é aqui, e não só nos 3 cards de
              resumo, que a classificação guia a ação da gestora. */}
          <TagNivel nivel={no.desempenho} className="shrink-0" />

          {no.lowSample ? <TagCoberturaParcial n={no.amostra} className="shrink-0" /> : null}

          {/* O `n` vive FORA da pílula (a pílula carrega só o rótulo + tooltip),
              como metadado — mesma anatomia do drawer de temas. */}
          <span
            data-testid={`amostra-${no.id}`}
            className="whitespace-nowrap"
            style={{ fontSize: 11, color: 'var(--gp-text-3)' }}
          >
            {no.respostas} respostas
          </span>

          {/* Afordância de folha: só este rótulo distingue "abre o drawer de
              temas" de "nó terminal inerte" — a cascata para no 2º nível. */}
          {ehFolha ? (
            <span
              className="ml-auto inline-flex shrink-0 items-center gap-0.5 whitespace-nowrap"
              style={{ fontSize: 12, fontWeight: 600, color: 'var(--gp-brand-on-dark)' }}
            >
              Ver temas
              <Icon name="chevron_right" variant="outlined" size={13} />
            </span>
          ) : null}
        </span>
      </span>
    </button>
  );
}


/**
 * Skeleton de um nível da cascata (spec §5, item 6): 3 nós na altura final
 * da linha real (`LinhaNo`, `px-2 py-2`), cada um com a MESMA anatomia —
 * barra de nome (50% de largura) e barra de % (30px, alinhada à direita) —,
 * nunca duas manchas genéricas soltas. Substitui as 2 barras de 36px sem
 * anatomia (achado da auditoria de 09/08): aquele skeleton nem reservava o
 * número certo de linhas (2, não 3) nem desenhava o que está chegando.
 */
function CascataNivelSkeleton() {
  const rotulo = 'Carregando nível do diagnóstico';
  return (
    <div className="space-y-0.5 py-1" data-testid="cascata-nivel-skeleton">
      {[0, 1, 2].map((indice) => (
        <div key={indice} className="flex w-full items-center gap-2 px-2 py-2" style={{ minHeight: 36 }}>
          {/* Wrapper com largura explícita, não `className` direto no
              `GestorSkeleton`: o `bloco` dele já é `w-full` (para caber no
              pai), e duas classes de largura na mesma string disputam a
              MESMA propriedade CSS por ordem de definição no stylesheet do
              Tailwind, não pela ordem em que aparecem aqui — o wrapper
              elimina a disputa, o `w-full` de dentro só preenche os 50%/30px
              que o próprio wrapper já reservou. */}
          <div className="w-1/2">
            <GestorSkeleton altura={12} rotulo={rotulo} />
          </div>
          <div className="ml-auto w-[30px] shrink-0">
            <GestorSkeleton altura={12} rotulo={rotulo} />
          </div>
        </div>
      ))}
    </div>
  );
}

interface NivelCascataProps {
  filtros: FiltrosGestor;
  node: string | null;
  nodeAberto: string | null;
  /**
   * Só no nível raiz (`node === null`): recorta a árvore ao grupo de
   * desempenho cuja seta foi clicada. Sem isso, abrir a seta do card
   * "Crítico" listaria TODAS as grandes áreas do recorte, contradizendo o
   * próprio `aria-label` do botão.
   */
  desempenhoAlvo?: NivelDesempenho | null;
  onAlternar: (id: string) => void;
  onAbrirTemas: (especialidade: { id: string; nome: string; grandeArea: string }) => void;
}

/**
 * Um nível da cascata. Só é montado quando o pai está aberto — daí a
 * laziness do fetch (`useDiagnostico` só é chamado quando este componente
 * existe na árvore).
 *
 * `node` (o pai deste nível, usado como `p_node`) É a grande área quando este
 * nível está listando especialidades: a RPC identifica nó por NOME
 * (`get_gestor_diagnostico.sql`, `'id', n.nome`), então o nível 1 (node=null)
 * só devolve nós de grande área e o nível 2 (node = nome da grande área) só
 * devolve especialidades daquela grande área. Por contrato, `ehFolha`/
 * especialidade NUNCA aparece com `node === null` — mas `abrirTemas` guarda
 * essa invariante em runtime em vez de confiar só no tipo, porque abrir o
 * drawer sem a grande área real reintroduziria exatamente o bug do
 * placeholder vazio que esta correção fecha.
 */
function NivelCascata({
  filtros,
  node,
  nodeAberto,
  desempenhoAlvo = null,
  onAlternar,
  onAbrirTemas,
}: NivelCascataProps) {
  const consulta = useDiagnostico(filtros, node);
  /** Regra dos 400ms (spec de motion §7) — evita o flash de skeleton em resposta rápida. */
  const mostrarSkeleton = useDelayedLoading(consulta.isLoading);
  const reduzido = usePrefersReducedMotion();
  const queryClient = useQueryClient();
  const userId = useUserIdSemExigirProvider();

  const abrirTemas = (especialidade: NoDiagnostico) => {
    if (node === null) {
      // Nunca deveria acontecer (ver contrato acima) — mas jamais abrimos o
      // drawer sem a grande área real, nunca com string vazia/nula.
      return;
    }
    onAbrirTemas({ id: especialidade.id, nome: especialidade.nome, grandeArea: node });
  };

  /**
   * Prefetch no hover do nó (spec §22): aquece o PRÓXIMO nível da cascata
   * antes do clique, para que a expansão rode sem skeleton. Sem `iesId`
   * (recorte ainda não resolvido) não há o que aquecer.
   *
   * `try/catch` em volta da CHAMADA, não só de uma promise: `prefetchQuery`
   * em si nunca rejeita (a lib engole o erro do `queryFn` internamente), mas
   * um hover é gatilho de FUNDO, nunca deve poder derrubar a interação do
   * gestor por nenhum motivo — nem um `queryFn` que lance de forma síncrona
   * antes de devolver a promise (é exatamente o que acontece nos testes
   * deste componente: `userEvent.click` dispara hover antes do clique, e o
   * módulo `api/queries` costuma vir mockado sem `GESTOR_STALE_TIME`/
   * `chamarRpcGestor` nesses arquivos — o Vitest LANÇA na leitura de um
   * export ausente do mock, e essa leitura roda dentro de
   * `prefetchDiagnosticoNivel`, antes de qualquer `.catch()` do React Query
   * ter chance de agir).
   */
  const prefetchFilhos = (idDoNo: string) => {
    if (!filtros.iesId) return;
    try {
      void prefetchDiagnosticoNivel(queryClient, userId, filtros.iesId, filtros.semestre, idDoNo);
    } catch {
      // Aquecimento best-effort — nunca propaga para a interação do gestor.
    }
  };

  if (consulta.isLoading) {
    return mostrarSkeleton ? <CascataNivelSkeleton /> : null;
  }

  if (consulta.isError) {
    return (
      <EstadoErro titulo="Não foi possível carregar este nível." onRetry={consulta.refetch} className="py-3" />
    );
  }

  const todos = consulta.data ?? [];
  const nos =
    node === null && desempenhoAlvo !== null
      ? todos.filter((no) => no.desempenho === desempenhoAlvo)
      : todos;

  if (nos.length === 0) {
    return <EstadoVazio titulo="Nenhum nó classificado neste nível." className="py-3" />;
  }

  return (
    <ul className="space-y-0.5">
      {nos.map((no) => {
        const ehEspecialidade = no.nivel === 'especialidade';
        const aberto = nodeAberto === no.id;
        return (
          <li key={no.id}>
            <LinhaNo
              no={no}
              aberto={aberto}
              ehFolha={ehEspecialidade}
              onClick={() => (ehEspecialidade ? abrirTemas(no) : onAlternar(no.id))}
              onPrefetch={() => prefetchFilhos(no.id)}
            />
            {/* Expande PARA BAIXO, no lugar, empurrando o conteúdo (spec §4.8, §13.2).
                Especialidade nunca expande em cascata — abre o drawer de temas (§4.9,
                Task 43). Accordion EXCLUSIVO: ao trocar de nó aberto, o ramo antigo (em
                outro <li> desta mesma lista) sai e o novo entra nos MESMOS 320ms — por
                isso `AnimatePresence` aqui, por nó, em vez de um desmonte condicional
                simples: cada `<li>` tem sua própria `AnimatePresence`, mas como as duas
                trocas (a que sai e a que entra) disparam no mesmo commit do React, as
                animações rodam juntas. O mount continua condicional (é ele que mantém o
                fetch preguiçoso), só a transição passou a cobrir entrada E saída. */}
            {!ehEspecialidade ? (
              <AnimatePresence initial={false}>
                {aberto ? (
                  <motion.div
                    key={no.id}
                    data-testid={`filhos-${no.id}`}
                    className="ml-4 overflow-hidden border-l-[3px] border-primary/40 pl-3"
                    initial={{ opacity: 0, scale: 0.98 }}
                    animate={{
                      opacity: 1,
                      scale: 1,
                      transition: { duration: reduzido ? 0.001 : 0.32, ease: [0, 0, 0, 1] }, // --gp-ease-in
                    }}
                    exit={{
                      opacity: 0,
                      scale: 0.98,
                      transition: { duration: reduzido ? 0.001 : 0.32, ease: [0.4, 0, 1, 1] }, // --gp-ease-out
                    }}
                  >
                    <NivelCascata
                      filtros={filtros}
                      node={no.id}
                      nodeAberto={null}
                      onAlternar={() => undefined}
                      onAbrirTemas={onAbrirTemas}
                    />
                  </motion.div>
                ) : null}
              </AnimatePresence>
            ) : null}
          </li>
        );
      })}
    </ul>
  );
}

/**
 * Move o foco entre os nós VISÍVEIS da árvore com ↑/↓ (handoff §11, tabela de
 * teclado: "Cascata | Enter/Espaço expande; `aria-expanded`; setas ↑ ↓ entre
 * nós"). Fica no contêiner e não em cada linha porque o evento borbulha: um
 * único handler enxerga os nós do ramo aberto sem precisar de registro.
 */
function navegarEntreNos(evento: React.KeyboardEvent<HTMLDivElement>) {
  if (evento.key !== 'ArrowDown' && evento.key !== 'ArrowUp') return;
  const nos = Array.from(
    evento.currentTarget.querySelectorAll<HTMLButtonElement>('button[data-no-cascata]'),
  );
  const atual = nos.indexOf(document.activeElement as HTMLButtonElement);
  if (atual < 0) return;
  evento.preventDefault();
  const destino = evento.key === 'ArrowDown' ? Math.min(atual + 1, nos.length - 1) : Math.max(atual - 1, 0);
  nos[destino]?.focus();
}

/**
 * Cascata de 2 níveis do Diagnóstico Curricular: grande área → especialidade
 * (spec §4.9 — "não existe subespecialidade", a hierarquia real do banco
 * tem 3 níveis e este bloco para no 2º; o 3º, tema, é o drawer da Task 43).
 *
 * A seta de cada card de nível abre a MESMA cascata ao lado, dividindo o
 * grid em dois — nunca um drawer (spec §4.8). O nível 1 só é buscado depois
 * do primeiro clique em qualquer seta; expandir uma grande área busca o
 * nível 2 sob demanda, lazy por nó. Accordion exclusivo: só um ramo aberto
 * por vez, e clicar de novo recolhe.
 */
export function CascataDiagnostico({ resumo, recorte, onAbrirTemas }: CascataDiagnosticoProps) {
  const [cascataAberta, setCascataAberta] = React.useState(false);
  const [nivelOrigem, setNivelOrigem] = React.useState<NivelDesempenho | null>(null);
  const [nodeAberto, setNodeAberto] = React.useState<string | null>(null);
  const reduzido = usePrefersReducedMotion();

  /**
   * `nivel === null` abre a cascata SEM recorte de nível — as grandes áreas
   * todas, que é o que o "Ver por nível de desempenho" do cabeçalho promete.
   * Com um nível, recorta ao grupo daquele cartão (comportamento de sempre).
   */
  const abrirCascata = (nivel: NivelDesempenho | null) => {
    const fechar = cascataAberta && nivelOrigem === nivel;
    setCascataAberta(!fechar);
    setNivelOrigem(fechar ? null : nivel);
    setNodeAberto(null);
  };

  /**
   * Trocar o recorte recolhe a árvore e recarrega: manter um ramo aberto de
   * outro recorte mostraria especialidades de um filtro que não está mais na
   * tela (o `useDiagnostico` do nível filho refaz o fetch com os `filtros`
   * novos, mas o nó pai aberto continuava sendo o do recorte anterior).
   */
  React.useEffect(() => {
    setCascataAberta(false);
    setNivelOrigem(null);
    setNodeAberto(null);
  }, [recorte.iesId, recorte.semestre]);

  const porNivel = new Map(resumo.map((grupo) => [grupo.nivel, grupo.areas]));

  /**
   * `diagnosticoResumo` sempre chega com os 3 grupos (a RPC monta
   * `VALUES ('critico',1),('mediano',2),('excelente',3)` incondicionalmente,
   * `areas` vira `[]` quando não há dado) — então `visao` nunca é `undefined`
   * só porque o recorte não teve nenhuma resposta, e o `mensagemVazio` do
   * `BlocoGestor` (que só cobre `estado === 'empty'`) nunca dispara aqui.
   * Quando os TRÊS grupos estão vazios não houve classificação NENHUMA
   * (recorte sem resposta registrada) — semântica diferente do caminho
   * principal (só o grupo crítico vazio, §4.4), que continua usando as 3
   * frases de resultado abaixo. Sem essa distinção, a seção afirmaria um
   * resultado de classificação ('nenhuma área crítica'/'nenhuma em
   * excelência'/'nenhuma mediana') onde não houve classificação alguma.
   */
  const totalAreas = resumo.reduce((soma, grupo) => soma + grupo.areas.length, 0);

  /**
   * `useDiagnostico` (já em produção) espera `FiltrosGestor` completo. Este
   * bloco só precisa de IES + semestre — `simulados` nunca é usado pela RPC
   * `get_gestor_diagnostico`, mas o tipo exige o campo, então a ponte fica
   * aqui, num único lugar.
   */
  const filtros: FiltrosGestor = { iesId: recorte.iesId, semestre: recorte.semestre, simulados: [] };

  return (
    /*
     * O bloco inteiro num card só, com o título, a nota de contexto e o CTA na
     * MESMA linha — a anatomia da referência (`<!-- Diagnóstico (promovido) -->`
     * em docs/handoff/gestor/design/extracted/LIGHT.markup.html). Antes o
     * cabeçalho flutuava sobre o fundo da página e os três cartões eram cards
     * soltos embaixo; agora é um bloco só, igual à Visão de Alunos logo abaixo
     * e ao gráfico protagonista logo acima.
     */
    <section data-testid="bloco-diagnostico" aria-labelledby="titulo-diagnostico">
      <Card className="relative overflow-hidden">
        {/* Aura de marca no topo do bloco: só um fio de 1px, em opacidade
            baixa. O halo radial saiu — com o gradiente do fundo da página já
            atrás do card, ele lia como mancha, não como acabamento. */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-x-0 top-0 h-px"
          style={{
            background:
              'linear-gradient(90deg, transparent, var(--gp-brand-border) 30%, var(--gp-brand-border) 70%, transparent)',
            opacity: 0.5,
          }}
        />
        <CardHeader className="relative flex flex-row flex-wrap items-center gap-3 pb-4">
          <div className="min-w-0">
            <h2
              id="titulo-diagnostico"
              className="truncate"
              style={{ fontSize: 16, fontWeight: 700, letterSpacing: '-0.01em' }}
            >
              Diagnóstico Curricular
            </h2>
            {/* A UNIDADE fica na nota: área, especialidade e tema são sempre
                percentual de acerto, nunca proficiência (spec §4.1 / caso
                crítico nº14). */}
            <p className="truncate text-[11px] text-muted-foreground">
              desempenho por grande área no período, em percentual de acerto
            </p>
          </div>


        </CardHeader>

        <CardContent className="pt-0">
      {totalAreas === 0 ? (
        <div data-testid="diagnostico-sem-classificacao">
          <EstadoVazio
            titulo="Sem grande área classificada neste recorte"
            descricao="Nenhum aluno com resposta registrada neste recorte."
          />
        </div>
      ) : (
        <div
          data-testid="diagnostico-grid"
          data-dividido={cascataAberta ? 'true' : 'false'}
          className={cn('grid gap-3', cascataAberta ? 'lg:grid-cols-2' : 'grid-cols-1')}
        >
          {/*
           * Com a cascata aberta, os três cards passam a dividir METADE da
           * largura — em `sm:grid-cols-3` cada um ficava com ~180px, os chips
           * de área quebravam palavra a palavra e a coluna crescia mais que a
           * própria cascata que ela abriu. Empilhados (`lg:grid-cols-1`) eles
           * viram uma lista curta ao lado do detalhe, que é o que a divisão em
           * dois quer dizer. Abaixo de `lg` o grid externo já é de 1 coluna, e
           * os três voltam a caber lado a lado.
           */}
          <div className={cn('grid gap-3.5 sm:grid-cols-3', cascataAberta && 'lg:grid-cols-1')}>
            {ORDEM_NIVEL.map((nivel) => {
              const areas = porNivel.get(nivel) ?? [];
              const setaAberta = cascataAberta && nivelOrigem === nivel;
              return (
                /* Cartão de nível na anatomia da referência: CONTAGEM primeiro
                   (número grande no canto superior esquerdo, com "áreas" em
                   cinza claro colado nele), a classificação logo abaixo com o
                   ponto do semáforo, e só então a lista de áreas. A ordem
                   importa: o cartão responde "quantas?" antes de "quais?", e
                   era isso que a tag de nível no topo invertia.

                   `<div>` e não `<Card>`: é um cartão DENTRO de um card, com
                   raio e respiro menores (12px/16px na referência, contra
                   16px/24px do bloco) — a casca do `Card` traria a sombra e o
                   padding do nível de fora. */
                <div
                  key={nivel}
                  data-testid={`cartao-nivel-${nivel}`}
                  data-selecionado={setaAberta ? 'true' : 'false'}
                  className={cn(
                    'group/nivel relative flex flex-col gap-3 overflow-hidden border border-border p-4 transition-colors',
                    '[transition-duration:var(--gp-motion-1)] [transition-timing-function:var(--gp-ease)]',
                    'hover:border-[color:var(--gp-brand-border)]',
                    setaAberta && 'ring-1 ring-[color:var(--gp-brand-border)]',
                  )}
                  style={{
                    borderRadius: 14,
                    background: setaAberta
                      ? 'var(--gp-brand-surface-soft)'
                      : 'var(--gp-surface-1, hsl(var(--card)))',
                    boxShadow: 'none',
                  }}
                >
                  {/* Fio de status: a faixa de desempenho vira COR na aresta do
                      cartão, legível antes de qualquer leitura de texto. Fino e
                      em baixa opacidade — marcação, não destaque. */}
                  <span
                    aria-hidden="true"
                    className="absolute inset-x-0 top-0 h-[2px]"
                    style={{ background: COR_NIVEL[nivel].ponto, opacity: 0.6 }}
                  />



                  {/* A contagem + a classificação SÃO o gatilho da cascata. */}
                  <button
                    type="button"
                    aria-label={`Abrir cascata de ${ROTULO_NIVEL[nivel].toLowerCase()} (${FAIXA_NIVEL[nivel]})`}
                    aria-expanded={setaAberta}
                    onClick={() => abrirCascata(nivel)}
                    className="relative -m-1 flex w-full flex-col items-start gap-2 rounded-lg p-1 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    <span className="flex w-full items-start justify-between gap-2">
                      <span className="flex items-baseline gap-1.5">
                        <span
                          className="tabular-nums"
                          style={{
                            fontSize: 34,
                            fontWeight: 700,
                            lineHeight: 1,
                            letterSpacing: '-0.03em',
                            color: areas.length > 0 ? COR_NIVEL[nivel].texto : 'var(--gp-text-3)',
                          }}
                        >
                          {areas.length}
                        </span>
                        <span className="text-[11px] uppercase tracking-wide text-muted-foreground">
                          {areas.length === 1 ? 'área' : 'áreas'}
                        </span>
                      </span>
                      <span
                        aria-hidden="true"
                        className="inline-flex shrink-0 items-center justify-center transition-transform [transition-duration:var(--gp-motion-1)] group-hover/nivel:translate-x-0.5"
                        style={{
                          width: 26,
                          height: 26,
                          borderRadius: 8,
                          background: COR_NIVEL[nivel].superficie,
                          color: COR_NIVEL[nivel].texto,
                        }}
                      >
                        <Icon
                          name={setaAberta ? 'expand_more' : COR_NIVEL[nivel].icone}
                          variant="outlined"
                          size={15}
                          box={15}
                        />
                      </span>
                    </span>
                    {/* O critério da classificação mora no tooltip: o rótulo
                        diz "o quê", a faixa de % de acerto diz "por quê". */}
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <span
                          data-testid={`criterio-nivel-${nivel}`}
                          className="flex cursor-help items-center gap-[7px]"
                          style={{ fontSize: 12, fontWeight: 600, color: COR_NIVEL[nivel].texto }}
                        >
                          <span
                            aria-hidden="true"
                            className="inline-block shrink-0"
                            style={{
                              width: 8,
                              height: 8,
                              borderRadius: 999,
                              background: COR_NIVEL[nivel].ponto,
                              boxShadow: `0 0 0 3px ${COR_NIVEL[nivel].superficie}`,
                            }}
                          />
                          {ROTULO_NIVEL[nivel]}
                          <Icon
                            name="info"
                            variant="outlined"
                            size={13}
                            box={13}
                            className="shrink-0 opacity-60"
                          />
                        </span>
                      </TooltipTrigger>
                      <TooltipContent side="top" className="max-w-[220px] text-xs">
                        <p className="font-semibold">{ROTULO_NIVEL[nivel]}</p>
                        <p className="mt-0.5 text-muted-foreground">
                          Grande área com {FAIXA_NIVEL[nivel]}.
                        </p>
                      </TooltipContent>
                    </Tooltip>

                  </button>

                  <div className="relative">
                    {areas.length > 0 ? (
                      <ul className="flex flex-wrap gap-1.5">
                        {/* No máximo duas áreas visíveis; o restante vira um
                            selo de contagem — indicativo, não interativo. */}
                        {areas.slice(0, 2).map((area) => (
                          <li key={area.id}>
                            {/* Chip é só o NOME da área — o % mora um clique
                                adiante, na cascata, com amostra e cobertura. */}
                            <span
                              data-testid={`chip-${area.id}`}
                              className="inline-flex items-center transition-colors"
                              style={{
                                fontSize: 12,
                                fontWeight: 500,
                                color: COR_NIVEL[nivel].texto,
                                border: '1px solid var(--gp-border-input)',
                                background: COR_NIVEL[nivel].superficie,
                                borderRadius: 'var(--gp-radius-pill)',
                                padding: '4px 11px',
                              }}
                            >
                              {area.nome}
                            </span>
                          </li>
                        ))}
                        {areas.length > 2 ? (
                          <li>
                            <span
                              data-testid={`chip-mais-${nivel}`}
                              className="inline-flex items-center tabular-nums"
                              title={areas
                                .slice(2)
                                .map((area) => area.nome)
                                .join(', ')}
                              style={{
                                fontSize: 12,
                                fontWeight: 500,
                                color: 'var(--gp-text-3)',
                                border: '1px dashed var(--gp-border-input)',
                                background: 'transparent',
                                borderRadius: 'var(--gp-radius-pill)',
                                padding: '4px 11px',
                              }}
                            >
                              +{areas.length - 2}
                            </span>
                          </li>
                        ) : null}
                      </ul>



                    ) : nivel === 'critico' ? (
                      <DiagnosticoCriticoVazio mediano={porNivel.get('mediano') ?? []} />
                    ) : (
                      /* `compacto`: um card de resumo não comporta o vazio de
                         bloco inteiro — ver o comentário da prop em
                         `EstadoVazio`. */
                      <EstadoVazio
                        compacto
                        titulo={
                          nivel === 'excelente'
                            ? 'Nenhuma área em excelência neste recorte'
                            : 'Nenhuma área com desempenho mediano neste recorte'
                        }
                      />
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {cascataAberta ? (
            /* `shadow-none` porque a cascata agora vive DENTRO do card do
               bloco: a sombra do `Card` é do nível de fora, e repetida aqui
               dentro dava a leitura de "card sobre card". Entrada do painel
               lateral (spec §13.3): fade + `translateX(12px → 0)`, 320ms,
               curva de entrada — o grid já reserva a coluna no mesmo frame
               (é o `grid-cols-2` do wrapper acima, não esta animação, que
               abre o espaço), então só o conteúdo do painel se move. */
            <CardAnimado
              data-testid="cascata"
              className="max-h-[560px] overflow-y-auto shadow-none"
              initial={{ opacity: 0, x: 12 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: reduzido ? 0.001 : 0.32, ease: [0, 0, 0, 1] }}
            >
              {/* Cabeçalho e trilha ficam FIXOS ao rolar (handoff §04-componentes):
                  com um ramo aberto e a lista rolada, é a trilha que diz onde
                  a gestora está. */}
              <CardHeader className="sticky top-0 z-10 gap-1 bg-card pb-2">
                <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                  <span className="shrink-0 text-sm font-semibold">Diagnóstico</span>
                  <span data-testid="cascata-trilha" className="min-w-0 break-words text-xs text-muted-foreground">
                    {nodeAberto === null ? '/ grande área' : `/ ${nodeAberto} / especialidade`}
                  </span>
                  {/* Saída explícita. Antes, sair era achar de novo a seta do
                      card que abriu — que, com a lista rolada, podia nem estar
                      na tela. `ml-auto` mantém o fecho no canto, onde se
                      procura por ele. */}
                  <button
                    type="button"
                    data-testid="cascata-fechar"
                    onClick={() => abrirCascata(nivelOrigem)}
                    className="gp-hover-surface ml-auto inline-flex shrink-0 items-center gap-1 rounded-md px-2 py-1 text-xs text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    <Icon name="close" variant="outlined" size={14} box={14} />
                    Fechar
                  </button>
                </div>
                <div className="flex items-center gap-2">
                  {nivelOrigem !== null ? <TagNivel nivel={nivelOrigem} /> : null}
                  {/* Volta UM nível dentro da árvore — o ramo aberto empurra as
                      grandes áreas para fora da vista, e recolher exigia rolar
                      de volta até a linha que foi clicada. */}
                  {nodeAberto !== null ? (
                    <button
                      type="button"
                      data-testid="cascata-voltar"
                      onClick={() => setNodeAberto(null)}
                      className={cn(
                        'inline-flex items-center gap-0.5 rounded-md text-xs font-semibold text-[color:var(--gp-brand-on-dark)] transition-colors',
                        '[transition-duration:var(--gp-motion-1)] [transition-timing-function:var(--gp-ease)]',
                        'hover:text-[color:var(--gp-brand-strong)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                      )}
                    >
                      <Icon name="chevron_left" variant="outlined" size={14} box={14} />
                      Voltar para as grandes áreas
                    </button>
                  ) : null}
                </div>
              </CardHeader>
              <CardContent className="pt-0" onKeyDown={navegarEntreNos}>
                <NivelCascata
                  filtros={filtros}
                  node={null}
                  nodeAberto={nodeAberto}
                  desempenhoAlvo={nivelOrigem}
                  onAlternar={(id) => setNodeAberto((atual) => (atual === id ? null : id))}
                  onAbrirTemas={onAbrirTemas}
                />
              </CardContent>
            </CardAnimado>
          ) : null}
        </div>
      )}
        </CardContent>
      </Card>
    </section>
  );
}
