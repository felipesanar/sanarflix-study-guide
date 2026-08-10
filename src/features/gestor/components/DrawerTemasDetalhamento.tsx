import * as React from 'react';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { EstadoErro } from '@/features/gestor/components/EstadoErro';
import { EstadoVazio } from '@/features/gestor/components/EstadoVazio';
import { GestorSkeleton } from '@/features/gestor/components/GestorSkeleton';
import { Icon } from '@/features/gestor/components/Icon';
import { TagCoberturaParcial, TagNivel } from '@/features/gestor/components/Tag';
import { useDetalhamentoTemas, type NoDetalhamentoTemas } from '@/features/gestor/api/queries';
import { formatPct } from '@/features/gestor/lib/formatters';
import { useDelayedLoading } from '@/features/gestor/hooks/useDelayedLoading';
import { useDevolverFocoAoFechar } from '@/features/gestor/hooks/useDevolverFocoAoFechar';
import { useGestorPortalContainer } from '@/features/gestor/shell/GestorShell';
import type { FiltroSemestre } from '@/features/gestor/api/types';

/** Grande área clicada em `AcertoPorAreaESemestre` que abre este drawer. */
export interface AreaSelecionadaDetalhamento {
  id: string;
  nome: string;
}

export interface DrawerTemasDetalhamentoProps {
  area: AreaSelecionadaDetalhamento | null;
  iesId: string | null;
  /** Mesmo recorte de simulados da tela. */
  simulados: string[];
  /**
   * Recorte de semestre vigente no card que abriu o drawer — o semestre
   * clicado no cruzamento área × semestre ou, na falta dele, o filtro global
   * da tela. Sem isso, especialidade e tema mostravam o recorte cheio
   * enquanto a lista de grandes áreas já estava recortada.
   */
  semestre: FiltroSemestre | null;
  onFechar: () => void;
}

/** Rótulo humano do recorte de semestre, para o gestor ver de qual corte o número vem. */
function rotuloSemestre(semestre: FiltroSemestre | null): string {
  if (semestre === null || semestre === 'geral') return 'Todos os semestres';
  if (semestre === '6ano') return '6º ano (11º e 12º em evidência)';
  return `${semestre}º semestre`;
}


/**
 * Cor de preenchimento da barra do nó — mesma régua visual de
 * `DrawerTemas.tsx` (a barra é reforço do número já impresso, nunca o único
 * canal), mas lida direto de `no.desempenho`: esta RPC já devolve a
 * classificação pronta (mesmo cálculo de `get_gestor_diagnostico`), então não
 * há por que recalcular via `lib/regras.ts` como o drawer de Diagnóstico faz
 * para `TemaCritico` (que não carrega `desempenho`).
 */
function corDaBarra(no: NoDetalhamentoTemas): string {
  if (no.lowSample) return 'var(--gp-text-3)';
  switch (no.desempenho) {
    case 'critico':
      return 'var(--gp-danger)';
    case 'mediano':
      return 'var(--gp-warning)';
    default:
      return 'var(--gp-success)';
  }
}

/**
 * Corpo do drawer em carregamento (spec de motion §5, item 7 — "Drawer /
 * painel"): mesma anatomia de `DrawerTemas.tsx` — grade 2×2 de cartões na
 * altura aproximada de um nó real (nome+tag+% / barra / rodapé com amostra e
 * afordância de "Ver temas") seguida de um bloco de barras representando o
 * resto da lista que continua na rolagem. Antes eram 3 barras genéricas.
 */
function CorpoDetalhamentoTemasSkeleton({ rotulo }: { rotulo: string }) {
  return (
    <div className="space-y-3" data-testid="drawer-detalhamento-temas-skeleton">
      <div className="grid grid-cols-2 gap-2.5">
        <GestorSkeleton forma="cartao" altura={90} rotulo={rotulo} />
        <GestorSkeleton forma="cartao" altura={90} rotulo={rotulo} />
        <GestorSkeleton forma="cartao" altura={90} rotulo={rotulo} />
        <GestorSkeleton forma="cartao" altura={90} rotulo={rotulo} />
      </div>
      <div className="space-y-2">
        <GestorSkeleton altura={40} rotulo={rotulo} />
        <GestorSkeleton altura={40} rotulo={rotulo} />
        <GestorSkeleton altura={40} rotulo={rotulo} />
      </div>
    </div>
  );
}

/**
 * Drill-down de área do Detalhamento (Task A4): especialidade → tema dentro
 * da grande área clicada em `AcertoPorAreaESemestre`.
 *
 * Reaproveita o padrão VISUAL de `DrawerTemas.tsx` (cascata, cor por
 * desempenho, `lowSample`) — mas é um componente próprio, com hook próprio
 * (`useDetalhamentoTemas`), porque a RPC nova recorta por `p_simulados`
 * (array explícito da tela de Detalhamento), nunca por `p_semestre` como
 * `get_gestor_diagnostico_temas`. Reusar `DrawerTemas` acoplaria este drawer
 * à RPC/recorte errados.
 *
 * Dois níveis dentro do MESMO drawer (nunca dois drawers empilhados):
 * `especialidadeAberta === null` lista especialidades da grande área;
 * clicar numa com `temFilhos` drila para os temas dela, com um "Voltar" que
 * some ao nível de especialidade.
 */
export function DrawerTemasDetalhamento({ area, iesId, simulados, semestre, onFechar }: DrawerTemasDetalhamentoProps) {
  const [especialidadeAberta, setEspecialidadeAberta] = React.useState<string | null>(null);

  /**
   * Trocar de área (novo clique em `AcertoPorAreaESemestre` enquanto o
   * drawer de outra área ainda está montado, ou reabertura) sempre volta ao
   * nível raiz — um ramo de especialidade aberto de OUTRA grande área não
   * tem sentido aqui.
   */
  React.useEffect(() => {
    setEspecialidadeAberta(null);
  }, [area?.id]);

  const consulta = useDetalhamentoTemas(iesId, simulados, area?.nome ?? null, especialidadeAberta, semestre);
  /** Regra dos 400ms (spec de motion §7) — evita o flash de skeleton em resposta rápida. */
  const mostrarSkeleton = useDelayedLoading(consulta.isLoading);
  useDevolverFocoAoFechar(area !== null);
  const container = useGestorPortalContainer();
  const tituloRef = React.useRef<HTMLHeadingElement>(null);

  if (!area) return null;

  const nos = consulta.data ?? [];
  const meta = consulta.meta;
  const nivelTema = especialidadeAberta !== null;

  return (
    <Sheet
      open
      onOpenChange={(aberto) => {
        if (!aberto) onFechar();
      }}
    >
      <SheetContent
        container={container}
        side="right"
        className="flex w-full flex-col gap-4 overflow-y-auto sm:max-w-md"
        closeIcon={<Icon name="close" size={16} />}
        closeLabel="Fechar"
        closeClassName="inline-flex h-[30px] w-[30px] items-center justify-center rounded-[8px] border border-[color:var(--gp-border-strong)] text-[color:var(--gp-text-3)] opacity-100"
        overlayClassName="bg-[var(--gp-scrim)]"
        onOpenAutoFocus={(evento) => {
          evento.preventDefault();
          tituloRef.current?.focus();
        }}
      >
        <SheetHeader>
          {/*
            Mesmo cabeçalho em dois níveis do `DrawerTemas`: sobrelinha +
            título. No nível raiz a sobrelinha diz "Grande área" e o título é
            a área clicada; drilado numa especialidade, a sobrelinha passa a
            ser a própria área (contexto) e o título a especialidade.
          */}
          <SheetTitle ref={tituloRef} tabIndex={-1} className="outline-none">
            <span className="sr-only">
              {nivelTema
                ? `Temas de ${especialidadeAberta} em ${area.nome}`
                : `Especialidades de ${area.nome}`}
            </span>
            <span aria-hidden="true" className="block" style={{ fontSize: 11, color: 'var(--gp-text-3)' }}>
              {nivelTema ? area.nome : 'Grande área'}
            </span>
            <span aria-hidden="true" className="block" style={{ fontSize: 15, fontWeight: 700 }}>
              {nivelTema ? especialidadeAberta : area.nome}
            </span>
          </SheetTitle>
          <SheetDescription>
            Percentual de acerto por {nivelTema ? 'tema' : 'especialidade'}, no recorte de{' '}
            <span data-testid="drawer-detalhamento-recorte-semestre">
              {rotuloSemestre(semestre).toLowerCase()}
            </span>
            . Nunca usa a escala de proficiência.
          </SheetDescription>
        </SheetHeader>

        {nivelTema ? (
          <button
            type="button"
            data-testid="drawer-detalhamento-voltar"
            onClick={() => setEspecialidadeAberta(null)}
            className="-mt-2 inline-flex w-fit items-center gap-0.5 rounded-md text-xs font-semibold transition-colors hover:opacity-80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            style={{ color: 'var(--gp-brand-on-dark)' }}
          >
            <Icon name="chevron_left" variant="outlined" size={14} box={14} />
            Voltar para especialidades
          </button>
        ) : null}

        <div className="flex-1">
          {consulta.isLoading ? (
            mostrarSkeleton ? (
              <CorpoDetalhamentoTemasSkeleton
                rotulo={`Carregando ${nivelTema ? 'temas' : 'especialidades'}`}
              />
            ) : null
          ) : consulta.isError ? (
            <EstadoErro
              titulo={`Não foi possível carregar ${nivelTema ? 'os temas' : 'as especialidades'}.`}
              onRetry={consulta.refetch}
            />
          ) : nos.length === 0 ? (
            <div data-testid="detalhamento-temas-vazio">
              <EstadoVazio
                titulo={`Sem ${nivelTema ? 'tema' : 'especialidade'} com resultado neste recorte`}
              />
            </div>
          ) : (
            <>
              <p
                className="mb-2 uppercase"
                style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.06em', color: 'var(--gp-text-3)' }}
              >
                {nivelTema ? 'Temas' : 'Especialidades'} · índice de acerto
              </p>
              <ul className="space-y-2.5">
                {nos.map((no) => {
                  const conteudo = (
                    <>
                      <div className="flex items-center justify-between gap-2 text-sm">
                        <span className="min-w-0 truncate font-semibold">{no.nome}</span>
                        <span className="flex shrink-0 items-center gap-2">
                          <TagNivel nivel={no.desempenho} />
                          <span className="font-semibold tabular-nums">{formatPct(no.acertoPct)}</span>
                        </span>
                      </div>
                      <div
                        data-testid={`detalhamento-barra-${no.id}`}
                        role="progressbar"
                        aria-label={`Percentual de acerto em ${no.nome}`}
                        aria-valuemin={0}
                        aria-valuemax={100}
                        aria-valuenow={Math.round(no.acertoPct)}
                        className="mt-2 w-full overflow-hidden"
                        style={{
                          height: 6,
                          borderRadius: 'var(--gp-radius-pill)',
                          background: 'var(--gp-surface-3)',
                        }}
                      >
                        <div
                          className="h-full"
                          style={{
                            width: `${no.acertoPct}%`,
                            borderRadius: 'var(--gp-radius-pill)',
                            background: corDaBarra(no),
                          }}
                        />
                      </div>
                      <div className="mt-2 flex items-center gap-2">
                        {no.lowSample ? <TagCoberturaParcial n={no.amostra} /> : null}
                        <span
                          data-testid={`detalhamento-amostra-${no.id}`}
                          className="ml-auto whitespace-nowrap"
                          style={{ fontSize: 11, color: 'var(--gp-text-3)' }}
                        >
                          {no.respostas} respostas
                        </span>
                        {/* Afordância de "tem próximo nível" — só a especialidade
                            com `temFilhos` drila; tema é sempre folha nesta RPC. */}
                        {no.temFilhos ? (
                          <span
                            className="inline-flex shrink-0 items-center gap-0.5 whitespace-nowrap"
                            style={{ fontSize: 12, fontWeight: 600, color: 'var(--gp-brand-on-dark)' }}
                          >
                            Ver temas
                            <Icon name="chevron_right" variant="outlined" size={13} />
                          </span>
                        ) : null}
                      </div>
                    </>
                  );

                  return (
                    <li
                      key={no.id}
                      data-testid={`detalhamento-no-${no.id}`}
                      className="border border-border p-3"
                      style={{ borderRadius: 'var(--gp-radius-md)' }}
                    >
                      {no.temFilhos ? (
                        <button
                          type="button"
                          onClick={() => setEspecialidadeAberta(no.nome)}
                          className="block w-full text-left transition-colors hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                        >
                          {conteudo}
                        </button>
                      ) : (
                        conteudo
                      )}
                    </li>
                  );
                })}
              </ul>
            </>
          )}
        </div>

        {meta ? (
          <p data-testid="detalhamento-temas-proveniencia" style={{ fontSize: 11, color: 'var(--gp-text-3)' }}>
            agregado de {meta.periodo} · fonte: {meta.fonte}
          </p>
        ) : null}
      </SheetContent>
    </Sheet>
  );
}
