import * as React from 'react';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { useDiagnostico } from '@/features/gestor/api/queries';
import { ChipNivel } from '@/features/gestor/components/ChipNivel';
import { Icon } from '@/features/gestor/components/Icon';
import { TagCoberturaParcial, TagNivel } from '@/features/gestor/components/Tag';
import { ROTULO_NIVEL } from '@/features/gestor/lib/rotulos';
import { EstadoErro } from '@/features/gestor/components/EstadoErro';
import { EstadoVazio } from '@/features/gestor/components/EstadoVazio';
import { GestorSkeleton } from '@/features/gestor/components/GestorSkeleton';
import { formatPct } from '@/features/gestor/lib/formatters';
import { NIVEL_CRITICO_MAX } from '@/features/gestor/lib/regras';
import type {
  FiltroSemestre,
  FiltrosGestor,
  NivelDesempenho,
  NoDiagnostico,
  VisaoGeral,
} from '@/features/gestor/api/types';

/** Ordem fixa de exibição dos 3 níveis de desempenho (spec §4.4). */
const ORDEM_NIVEL: NivelDesempenho[] = ['excelente', 'mediano', 'critico'];

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
 * Vazio do grupo crítico — o CAMINHO PRINCIPAL desta tela, não uma borda.
 * Com `NIVEL_CRITICO_MAX = 30`, 87,9% dos recortes reais não têm nenhuma
 * área crítica (100% descontada a IES de teste, ver `lib/regras.ts`). Uma
 * gestora que vê a seção em branco conclui que a ferramenta quebrou — então
 * este bloco sempre diz o que aconteceu (com o corte vindo de `regras.ts`,
 * nunca escrito na mão) e aponta por onde começar: as áreas medianas, da
 * pior para a melhor.
 */
function DiagnosticoCriticoVazio({ mediano }: { mediano: AreaResumo[] }) {
  const piorParaMelhor = [...mediano].sort((a, b) => a.acertoPct - b.acertoPct);

  return (
    <div data-testid="diagnostico-critico-vazio" className="space-y-3">
      <EstadoVazio
        titulo={`Nenhuma área abaixo de ${NIVEL_CRITICO_MAX}% de acerto neste recorte`}
        descricao={
          piorParaMelhor.length > 0
            ? 'Comece pelas áreas medianas a seguir, da pior para a melhor.'
            : undefined
        }
      />
      {piorParaMelhor.length > 0 ? (
        <ol data-testid="sugestao-mediano" className="space-y-1">
          {piorParaMelhor.map((area) => (
            <li key={area.id} className="flex items-center justify-between gap-2 text-xs">
              <span className="truncate text-foreground">{area.nome}</span>
              <span className="tabular-nums text-muted-foreground">{formatPct(area.acertoPct)}</span>
            </li>
          ))}
        </ol>
      ) : null}
    </div>
  );
}

/** Linha de um nó da cascata (grande área ou especialidade). */
function LinhaNo({
  no,
  aberto,
  ehFolha,
  onClick,
}: {
  no: NoDiagnostico;
  aberto: boolean;
  ehFolha: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      data-no-cascata=""
      onClick={onClick}
      aria-expanded={ehFolha ? undefined : aberto}
      className={cn(
        'flex w-full items-center gap-2 rounded-md px-2 py-2 text-left text-sm transition-colors',
        'hover:bg-muted/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
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
        <span aria-hidden="true" className="inline-block w-4 shrink-0" />
      ) : (
        <Icon
          name={aberto ? 'expand_more' : 'chevron_right'}
          variant="outlined"
          size={16}
          box={16}
          className={aberto ? 'text-foreground' : 'text-muted-foreground'}
        />
      )}

      <span className="min-w-0 truncate">{no.nome}</span>

      {/* Nível por NÓ (handoff §04-componentes, "Por nó: % de acerto, nível,
          badge de cobertura parcial") — é aqui, e não só nos 3 cards de
          resumo, que a classificação guia a ação da gestora. */}
      <TagNivel nivel={no.desempenho} className="shrink-0" />

      {no.lowSample ? <TagCoberturaParcial n={no.amostra} className="shrink-0" /> : null}

      <span className="ml-auto shrink-0 tabular-nums text-muted-foreground">{formatPct(no.acertoPct)}</span>

      {/* O `n` vive FORA da pílula (a pílula carrega só o rótulo + tooltip),
          como metadado à direita — mesma anatomia do drawer de temas. */}
      <span
        data-testid={`amostra-${no.id}`}
        className="shrink-0 whitespace-nowrap"
        style={{ fontSize: 11, color: 'var(--gp-text-3)' }}
      >
        {no.amostra} respostas
      </span>

      {/* Afordância de folha: só este rótulo distingue "abre o drawer de
          temas" de "nó terminal inerte" — a cascata para no 2º nível. */}
      {ehFolha ? (
        <span
          className="inline-flex shrink-0 items-center gap-0.5 whitespace-nowrap"
          style={{ fontSize: 12, fontWeight: 600, color: 'var(--gp-brand-on-dark)' }}
        >
          Ver temas
          <Icon name="chevron_right" variant="outlined" size={13} />
        </span>
      ) : null}
    </button>
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

  const abrirTemas = (especialidade: NoDiagnostico) => {
    if (node === null) {
      // Nunca deveria acontecer (ver contrato acima) — mas jamais abrimos o
      // drawer sem a grande área real, nunca com string vazia/nula.
      return;
    }
    onAbrirTemas({ id: especialidade.id, nome: especialidade.nome, grandeArea: node });
  };

  if (consulta.isLoading) {
    return (
      <div className="space-y-1.5 py-1">
        <GestorSkeleton altura={36} rotulo="Carregando nível do diagnóstico" />
        <GestorSkeleton altura={36} rotulo="Carregando nível do diagnóstico" />
      </div>
    );
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
            />
            {/* Expande PARA BAIXO, no lugar, empurrando o conteúdo (spec §4.8). Especialidade nunca expande em cascata — abre o drawer de temas (§4.9, Task 43).
                O ramo entra em `motion-4` (320ms): o mount continua condicional (é ele que
                mantém o fetch preguiçoso e a exclusividade), a animação só cobre a entrada. */}
            {!ehEspecialidade && aberto ? (
              <div
                data-testid={`filhos-${no.id}`}
                className="ml-4 animate-in border-l border-border pl-2 duration-[320ms] fade-in-0 slide-in-from-top-1"
              >
                <NivelCascata
                  filtros={filtros}
                  node={no.id}
                  nodeAberto={null}
                  onAlternar={() => undefined}
                  onAbrirTemas={onAbrirTemas}
                />
              </div>
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

  const abrirCascata = (nivel: NivelDesempenho) => {
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
    <section data-testid="bloco-diagnostico" aria-labelledby="titulo-diagnostico" className="space-y-3">
      <div>
        <h2 id="titulo-diagnostico" className="text-sm font-semibold">
          Diagnóstico Curricular
        </h2>
        <p className="text-xs text-muted-foreground">Desempenho por grande área, em percentual de acerto.</p>
      </div>

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
          <div className="grid gap-3 sm:grid-cols-3">
            {ORDEM_NIVEL.map((nivel) => {
              const areas = porNivel.get(nivel) ?? [];
              const setaAberta = cascataAberta && nivelOrigem === nivel;
              return (
                <Card key={nivel}>
                  <CardHeader className="flex flex-row items-center justify-between gap-2 pb-3">
                    <div className="flex items-center gap-2">
                      <ChipNivel nivel={nivel} />
                      <span className="text-xs text-muted-foreground">
                        {areas.length} {areas.length === 1 ? 'área' : 'áreas'}
                      </span>
                    </div>
                    <button
                      type="button"
                      aria-label={`Abrir cascata do nível ${ROTULO_NIVEL[nivel].toLowerCase()}`}
                      aria-expanded={setaAberta}
                      onClick={() => abrirCascata(nivel)}
                      className="rounded-md p-1 text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    >
                      <Icon name={setaAberta ? 'expand_more' : 'chevron_right'} variant="outlined" size={16} box={16} />
                    </button>
                  </CardHeader>
                  <CardContent className="pt-0">
                    {areas.length > 0 ? (
                      <ul className="flex flex-wrap gap-1.5">
                        {areas.map((area) => (
                          <li key={area.id}>
                            {/*
                              Chip é só o NOME da área. O % saiu de dentro dele
                              porque o card já agrupa por nível — a faixa de
                              desempenho é o que o chip comunica, e o número
                              exato mora um clique adiante, na cascata, onde
                              vem acompanhado de amostra e cobertura. Dois
                              números concorrentes no mesmo cartão (o do chip e
                              o da lista de sugestão logo abaixo) faziam a
                              gestora comparar grandezas de recortes
                              diferentes.
                            */}
                            <span
                              data-testid={`chip-${area.id}`}
                              className="inline-flex items-center whitespace-nowrap"
                              style={{
                                fontSize: 12,
                                fontWeight: 500,
                                color: 'var(--gp-text-2)',
                                border: '1px solid var(--gp-border-input)',
                                borderRadius: 'var(--gp-radius-pill)',
                                padding: '3px 11px',
                              }}
                            >
                              {area.nome}
                            </span>
                          </li>
                        ))}
                      </ul>
                    ) : nivel === 'critico' ? (
                      <DiagnosticoCriticoVazio mediano={porNivel.get('mediano') ?? []} />
                    ) : (
                      <EstadoVazio
                        titulo={
                          nivel === 'excelente'
                            ? 'Nenhuma área em excelência neste recorte'
                            : 'Nenhuma área com desempenho mediano neste recorte'
                        }
                      />
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>

          {cascataAberta ? (
            <Card data-testid="cascata" className="max-h-[560px] overflow-y-auto">
              {/* Cabeçalho e trilha ficam FIXOS ao rolar (handoff §04-componentes):
                  com um ramo aberto e a lista rolada, é a trilha que diz onde
                  a gestora está. */}
              <CardHeader className="sticky top-0 z-10 gap-1 bg-card pb-2">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-semibold">Diagnóstico</span>
                  <span data-testid="cascata-trilha" className="truncate text-xs text-muted-foreground">
                    {nodeAberto === null ? '/ grande área' : `/ ${nodeAberto} / especialidade`}
                  </span>
                </div>
                {nivelOrigem !== null ? <TagNivel nivel={nivelOrigem} className="self-start" /> : null}
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
            </Card>
          ) : null}
        </div>
      )}
    </section>
  );
}
