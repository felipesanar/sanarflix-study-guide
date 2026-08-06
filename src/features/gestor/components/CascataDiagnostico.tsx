import * as React from 'react';
import { ChevronRight } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { useDiagnostico } from '@/features/gestor/api/queries';
import { ChipNivel } from '@/features/gestor/components/ChipNivel';
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
      onClick={onClick}
      aria-expanded={ehFolha ? undefined : aberto}
      className={cn(
        'flex w-full items-center justify-between gap-3 rounded-md px-2 py-2 text-left text-sm transition-colors',
        'hover:bg-muted/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
      )}
    >
      <span className="flex min-w-0 items-center gap-2">
        {ehFolha ? null : (
          <ChevronRight
            className={cn('h-3.5 w-3.5 shrink-0 transition-transform', aberto && 'rotate-90')}
            aria-hidden="true"
          />
        )}
        <span className="truncate">{no.nome}</span>
        {no.lowSample ? (
          <Badge variant="outline" className="shrink-0 gap-1 text-[10px] font-medium">
            cobertura parcial
            <span data-testid={`amostra-${no.id}`} className="text-muted-foreground">
              n = {no.amostra}
            </span>
          </Badge>
        ) : null}
      </span>
      <span className="shrink-0 tabular-nums text-muted-foreground">{formatPct(no.acertoPct)}</span>
    </button>
  );
}

interface NivelCascataProps {
  filtros: FiltrosGestor;
  node: string | null;
  nodeAberto: string | null;
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
function NivelCascata({ filtros, node, nodeAberto, onAlternar, onAbrirTemas }: NivelCascataProps) {
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

  const nos = consulta.data ?? [];
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
            {/* Expande PARA BAIXO, no lugar, empurrando o conteúdo (spec §4.8). Especialidade nunca expande em cascata — abre o drawer de temas (§4.9, Task 43). */}
            {!ehEspecialidade && aberto ? (
              <div data-testid={`filhos-${no.id}`} className="ml-4 border-l border-border pl-2">
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
                      <ChevronRight
                        className={cn('h-4 w-4 transition-transform', setaAberta && 'rotate-90')}
                        aria-hidden="true"
                      />
                    </button>
                  </CardHeader>
                  <CardContent className="pt-0">
                    {areas.length > 0 ? (
                      <ul className="flex flex-wrap gap-1.5">
                        {areas.map((area) => (
                          <li key={area.id}>
                            <span
                              data-testid={`chip-${area.id}`}
                              className="inline-flex items-center gap-1 rounded-full border border-border px-2 py-0.5 text-xs"
                            >
                              {area.nome}
                              <span className="tabular-nums text-muted-foreground">
                                {formatPct(area.acertoPct)}
                              </span>
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
            <Card data-testid="cascata">
              <CardHeader className="pb-2">
                <span className="text-xs font-semibold">Grande área → especialidade</span>
              </CardHeader>
              <CardContent className="pt-0">
                <NivelCascata
                  filtros={filtros}
                  node={null}
                  nodeAberto={nodeAberto}
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
