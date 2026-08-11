import * as React from 'react';
import { cn } from '@/lib/utils';
import { Icon } from '@/features/gestor/components/Icon';
import { Tag } from '@/features/gestor/components/Tag';
import type { ItemCronograma } from '../api/types';

/**
 * Acima disso a leitura dos gráficos degrada — aviso, nunca bloqueio (§4.7.2).
 *
 * Limiar mantido em "acima de 5" (`>`), como mandam docs/02-regras-de-negocio.md §4.2
 * e docs/04-componentes.md §1.2.
 */
export const LIMITE_LEGIBILIDADE = 5;

const MOTIVO_POR_STATUS: Record<ItemCronograma['status'], string | null> = {
  realizado: null,
  processing: 'Gabarito em processamento',
  agendado: 'Simulado ainda não realizado',
  reagendado: 'Simulado ainda não realizado',
  previsto: 'Simulado previsto, sem data definida',
};

/** `null` = selecionável. Qualquer string = motivo de indisponibilidade (§4.7.1). */
export function motivoIndisponivel(item: ItemCronograma): string | null {
  return item.indisponivelPorque ?? MOTIVO_POR_STATUS[item.status];
}

/**
 * `dd/MM` a partir dos dígitos do ISO — mesma razão de `formatData` em
 * lib/formatters.ts: `new Date('2026-03-15')` é meia-noite UTC e, em UTC-3,
 * renderizaria o dia anterior.
 */
function dataCurta(iso: string | null): string | null {
  if (iso === null) return null;
  const match = /^\d{4}-(\d{2})-(\d{2})/.exec(iso);
  return match ? `${match[2]}/${match[1]}` : null;
}

/**
 * "Sim. Nacional 1 · 15/03 · presencial" (referência §10.4). Só o nome não
 * basta: dois simulados de nome parecido no mesmo período ficam
 * indistinguíveis, e `data`/`modalidade` já vêm no `ItemCronograma`.
 */
export function rotuloItem(item: ItemCronograma): string {
  return [item.nome, dataCurta(item.data), item.modalidade].filter(Boolean).join(' · ');
}

/** Raio do quadrado de marcação (16×16) — a referência crava 4px aqui. */
const RAIO_CHECKBOX = 4;

export interface SeletorSimuladosProps {
  itens: ItemCronograma[];
  selecionados: string[];
  onChange: (ids: string[]) => void;
  /**
   * `true` = a lista fica sempre aberta e no fluxo do documento, sem popover
   * flutuante. É o que o drawer de exportação precisa: lá dentro um painel
   * `absolute` cai por cima dos blocos do arquivo e fica ilegível.
   */
  inline?: boolean;
  /**
   * `true` = nenhum simulado escolhido é estado válido (é o caso do arquivo de
   * exportação, que sempre tem blocos do período). Sem isso o controle pinta a
   * borda de erro e cobra uma escolha que ali não é obrigatória.
   */
  opcional?: boolean;

}


/** Ordena por data desc (sem data vai para o fim) — usado no atalho de recentes. */
function porDataDesc(a: ItemCronograma, b: ItemCronograma): number {
  return (b.data ?? '').localeCompare(a.data ?? '');
}

/**
 * Multi-seleção de simulados do Detalhamento (§4.7, handoff §10.4).
 *
 * Anatomia: cabeçalho com rótulo + contador + "Limpar", campo com os
 * selecionados em CHIPS REMOVÍVEIS e um painel flutuante (dentro da subárvore
 * `.gestor-portal`, sem Portal, para os tokens `--gp-*` e o
 * `prefers-reduced-motion` do tema alcançarem) com o atalho de um clique para os
 * 2 mais recentes e a lista de checkboxes separada em disponíveis ×
 * indisponíveis. Sem campo de busca: o cronograma de uma IES é curto e os dois
 * agrupamentos já dão a leitura.

 *
 * O "×" do chip é o único caminho para desmarcar um simulado que ficou
 * indisponível DEPOIS de selecionado (a outra metade da correção, o filtro de
 * ids indisponíveis, mora em `routes/Detalhamento.tsx`).
 */
export function SeletorSimulados({
  itens,
  selecionados,
  onChange,
  inline = false,
  opcional = false,

}: SeletorSimuladosProps) {
  const [abertoPorClique, setAberto] = React.useState(false);
  const aberto = inline || abertoPorClique;
  const idPainel = React.useId();
  const raiz = React.useRef<HTMLDivElement>(null);
  const painel = React.useRef<HTMLDivElement>(null);


  const semSelecao = selecionados.length === 0;
  const excedeLegibilidade = selecionados.length > LIMITE_LEGIBILIDADE;

  // Chips na ordem do cronograma, não na ordem de clique: a mesma leitura da lista.
  const escolhidos = itens.filter((item) => selecionados.includes(item.id));

  const disponiveis = itens.filter((item) => motivoIndisponivel(item) === null);
  const indisponiveis = itens.filter((item) => motivoIndisponivel(item) !== null);


  const alternar = (id: string) => {
    onChange(
      selecionados.includes(id)
        ? selecionados.filter((outro) => outro !== id)
        : [...selecionados, id],
    );
  };

  // Fecha no ESC e no clique fora: o painel flutua sobre o conteúdo, então
  // precisa das duas saídas que todo mundo já espera de um popover.
  React.useEffect(() => {
    if (!aberto || inline) return;
    const noEsc = (evento: KeyboardEvent) => {
      if (evento.key === 'Escape') setAberto(false);
    };
    const noClique = (evento: MouseEvent) => {
      if (raiz.current && !raiz.current.contains(evento.target as Node)) setAberto(false);
    };
    document.addEventListener('keydown', noEsc);
    document.addEventListener('mousedown', noClique);
    return () => {
      document.removeEventListener('keydown', noEsc);
      document.removeEventListener('mousedown', noClique);
    };
  }, [aberto, inline]);

  // Abriu = o teclado precisa de um ponto de entrada dentro do painel. Sem a
  // busca, esse ponto é o primeiro controle focável (atalho ou 1ª linha).
  React.useEffect(() => {
    if (!aberto || inline) return;
    painel.current
      ?.querySelector<HTMLElement>('button, input[type="checkbox"]:not([disabled])')
      ?.focus();
  }, [aberto, inline]);


  const maisRecentes = [...disponiveis].sort(porDataDesc).slice(0, 2);
  const doisMaisRecentes = maisRecentes.map((item) => item.id);
  const rotulosMaisRecentes = maisRecentes.map((item) =>
    [item.nome, dataCurta(item.data)].filter(Boolean).join(' · '),
  );
  const podeCompararRecentes =
    doisMaisRecentes.length === 2 &&
    [...doisMaisRecentes].sort().join(',') !== [...selecionados].sort().join(',');


  const linhaItem = (item: ItemCronograma, indice: number) => {
    const motivo = motivoIndisponivel(item);
    const marcado = selecionados.includes(item.id);
    const rotulo = rotuloItem(item);
    return (
      <label
        key={item.id}
        className={cn(
          'group flex items-center gap-3 transition-colors',
          motivo === null ? 'gp-hover-surface cursor-pointer' : 'cursor-not-allowed',
        )}
        style={{
          padding: '10px 12px',
          fontSize: 13,
          borderTop: indice === 0 ? undefined : '1px solid var(--gp-border-subtle)',
          background: marcado ? 'var(--gp-brand-surface)' : undefined,
          boxShadow: marcado ? 'inset 2px 0 0 var(--gp-brand)' : undefined,
          opacity: motivo === null ? undefined : 0.65,
        }}
      >
        <input
          type="checkbox"
          className="peer sr-only"
          checked={marcado}
          disabled={motivo !== null}
          onChange={() => alternar(item.id)}
          aria-label={motivo === null ? rotulo : `${rotulo} — ${motivo}`}
        />
        <span
          aria-hidden="true"
          // O input real é `sr-only`: sem isto o foco de teclado ficaria
          // invisível, porque o anel nasceria num nó de 1px.
          className="flex items-center justify-center shadow-sm peer-focus-visible:ring-2 peer-focus-visible:ring-ring peer-focus-visible:ring-offset-2"
          style={{
            width: 20,
            height: 20,
            flex: 'none',
            borderRadius: RAIO_CHECKBOX,
            border: `2px ${motivo === null ? 'solid' : 'dashed'} ${
              marcado ? 'var(--gp-info)' : 'var(--gp-text-1)'
            }`,
            background: marcado ? 'var(--gp-info)' : 'var(--gp-surface-1)',
            color: 'var(--gp-text-inverse)',
            transitionProperty: 'background-color, border-color',
            transitionDuration: 'var(--gp-motion-2)',
            transitionTimingFunction: 'var(--gp-ease)',
          }}
        >
          {/*
            Comportamento 17 (spec de motion, Parte IV §11): a marca de "check"
            entra com `scale(0.6 → 1)` + fade, 140ms (`--gp-motion-2`). O ícone
            fica SEMPRE montado — uma transição CSS não roda em elemento que
            nunca existiu antes.
          */}
          <span
            aria-hidden="true"
            className="inline-flex"
            style={{
              transform: marcado ? 'scale(1)' : 'scale(0.6)',
              opacity: marcado ? 1 : 0,
              transitionProperty: 'transform, opacity',
              transitionDuration: 'var(--gp-motion-2)',
              transitionTimingFunction: 'var(--gp-ease)',
            }}
          >
            <Icon name="check" variant="filled" size={15} />
          </span>
        </span>

        <span className="flex min-w-0 flex-1 flex-col">
          <span
            className="truncate"
            style={{
              color: marcado ? 'var(--gp-text-1)' : 'var(--gp-text-1)',
              fontWeight: marcado ? 600 : 500,
            }}
          >
            {item.nome}
          </span>
          <span style={{ fontSize: 11, color: 'var(--gp-text-3)' }}>
            {[dataCurta(item.data), item.modalidade, typeof item.participantes === 'number' ? `${item.participantes} participantes` : null]
              .filter(Boolean)
              .join(' · ')}
          </span>
        </span>

        {motivo !== null && <Tag variant="qualificador">{motivo}</Tag>}
      </label>
    );
  };

  return (
    <div
      ref={raiz}
      data-testid="seletor-simulados"
      className={cn(
        'relative rounded-xl border border-border bg-card p-3.5',
        semSelecao && !opcional && 'border-destructive ring-2 ring-destructive/20',
      )}
    >
      {/* Cabeçalho: o que é isto, quantos entraram e a saída rápida. */}
      <div className="mb-2 flex items-center gap-2">
        <Icon name="filter_list" size={15} className="text-[color:var(--gp-text-3)]" aria-hidden="true" />
        <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--gp-text-1)' }}>
          Simulados no recorte
        </span>
        <span
          aria-hidden="true"
          style={{
            fontSize: 11,
            fontWeight: 700,
            padding: '1px 7px',
            borderRadius: 'var(--gp-radius-pill)',
            background: semSelecao ? 'var(--gp-surface-3)' : 'var(--gp-brand)',
            color: semSelecao ? 'var(--gp-text-3)' : 'var(--gp-on-brand)',
          }}
        >
          {selecionados.length}
        </span>
        {!semSelecao && (
          <button
            type="button"
            onClick={() => onChange([])}
            className="ml-auto rounded-sm underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            style={{ fontSize: 11, fontWeight: 600, color: 'var(--gp-text-3)' }}
          >
            Limpar seleção
          </button>
        )}
      </div>

      {/* Campo: chips removíveis + gatilho do painel. O clique em qualquer área
          vazia do campo abre — alvo grande em vez de só o chevron. */}
      <div
        onClick={(evento) => {
          if (evento.target === evento.currentTarget) setAberto((estava) => !estava);
        }}
        className="flex flex-wrap items-center gap-1.5 transition-colors"
        style={{
          border: `1.5px solid ${aberto ? 'var(--gp-brand)' : 'var(--gp-border-input)'}`,
          borderRadius: 'var(--gp-radius-sm)',
          padding: '7px 8px 7px 10px',
          fontSize: 13,
          color: 'var(--gp-text-1)',
          background: 'var(--gp-surface-1)',
          cursor: 'pointer',
        }}
      >
        {escolhidos.map((item) => (
          <span
            key={item.id}
            className="inline-flex items-center gap-1.5 whitespace-nowrap leading-none"
            style={{
              border: '1px solid var(--gp-brand)',
              background: 'var(--gp-brand-surface)',
              color: 'var(--gp-text-1)',
              borderRadius: 'var(--gp-radius-pill)',
              padding: '4px 5px 4px 10px',
              fontSize: 12,
              fontWeight: 600,
            }}
          >
            {item.nome}
            <button
              type="button"
              onClick={() => alternar(item.id)}
              aria-label={`Remover ${item.nome} do recorte`}
              className="inline-flex h-4 w-4 items-center justify-center rounded-full text-[color:var(--gp-text-3)] transition-colors hover:bg-[var(--gp-surface-3)] hover:text-[color:var(--gp-text-1)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <Icon name="close" size={12} />
            </button>
          </span>
        ))}

        {inline ? (
          <span className="flex-1 py-0.5 text-[color:var(--gp-text-3)]">
            {semSelecao ? 'Marque os simulados na lista abaixo' : 'Marque outro na lista abaixo'}
          </span>
        ) : (
          <button
            type="button"
            onClick={() => setAberto((estava) => !estava)}
            aria-expanded={aberto}
            // Só referencia o painel quando ele existe: `aria-controls` apontando
            // para um id ausente é atributo inválido para a AT (e para o axe).
            aria-controls={aberto ? idPainel : undefined}
            aria-label="Escolher simulados"
            className="flex flex-1 items-center justify-between gap-2 rounded-sm py-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <span className="text-[color:var(--gp-text-3)]">
              {semSelecao ? 'Selecione 1 ou mais simulados' : 'Adicionar outro'}
            </span>
            <Icon
              name={aberto ? 'expand_less' : 'expand_more'}
              size={16}
              className="text-[color:var(--gp-text-3)]"
            />
          </button>
        )}
      </div>

      {aberto && (
        <div
          ref={painel}
          id={idPainel}

          role="group"
          aria-label="Simulados do recorte"
          className={cn(
            'mt-2 overflow-hidden',
            inline
              ? 'relative'
              : 'absolute left-3.5 right-3.5 z-30 animate-in fade-in-0 slide-in-from-top-1 [animation-duration:140ms]',
          )}

          style={{
            border: '1px solid var(--gp-border-strong)',
            borderRadius: 'var(--gp-radius-md)',
            background: 'var(--gp-surface-1)',
            boxShadow: 'var(--gp-shadow-drawer)',
          }}
        >
          {/* Sugestão discreta de um clique. Diz QUAIS dois simulados vai
              marcar: comparar às cegas é a fonte de erro aqui. */}
          {podeCompararRecentes && (
            <div
              className="flex items-center gap-2"
              style={{
                padding: '7px 12px',
                borderBottom: '1px solid var(--gp-border-subtle)',
              }}
            >
              <span
                className="shrink-0"
                style={{
                  fontSize: 10,
                  letterSpacing: '0.04em',
                  textTransform: 'uppercase',
                  fontWeight: 700,
                  color: 'var(--gp-text-3)',
                }}
              >
                Sugestão
              </span>
              <button
                type="button"
                onClick={() => onChange(doisMaisRecentes)}
                title={rotulosMaisRecentes.join('  ·vs·  ')}
                className="flex min-w-0 items-center gap-1.5 transition-colors hover:brightness-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                style={{
                  padding: '3px 8px',
                  borderRadius: 999,
                  border: '1px solid var(--gp-border-strong)',
                  background: 'var(--gp-surface-2)',
                }}
              >
                <Icon
                  name="equalizer"
                  size={13}
                  aria-hidden="true"
                  className="shrink-0 text-[color:var(--gp-text-2)]"
                />
                <span className="truncate" style={{ fontSize: 11, fontWeight: 600, color: 'var(--gp-text-1)' }}>
                  Comparar os 2 mais recentes
                </span>
              </button>
            </div>
          )}


          <div className="max-h-[52vh] overflow-y-auto">
            {disponiveis.length > 0 && (
              <>
                <p
                  style={{
                    padding: '7px 12px',
                    fontSize: 10,
                    letterSpacing: '0.04em',
                    textTransform: 'uppercase',
                    fontWeight: 700,
                    color: 'var(--gp-text-3)',
                    borderBottom: '1px solid var(--gp-border-subtle)',
                  }}
                >
                  Disponíveis · marque 1 ou mais
                </p>
                {disponiveis.map((item, indice) => linhaItem(item, indice))}
              </>
            )}

            {indisponiveis.length > 0 && (
              <>
                <p
                  style={{
                    padding: '7px 12px',
                    fontSize: 10,
                    letterSpacing: '0.04em',
                    textTransform: 'uppercase',
                    fontWeight: 700,
                    color: 'var(--gp-text-3)',
                    borderTop: '1px solid var(--gp-border-strong)',
                    borderBottom: '1px solid var(--gp-border-subtle)',
                    background: 'var(--gp-surface-2)',
                  }}
                >
                  Ainda sem resultado
                </p>
                {indisponiveis.map((item, indice) => linhaItem(item, indice))}
              </>
            )}

            {itens.length === 0 && (
              <p style={{ padding: '18px 12px', fontSize: 12, color: 'var(--gp-text-3)' }}>
                Nenhum simulado no cronograma desta instituição.
              </p>
            )}
          </div>


          <div
            className="flex items-center justify-between gap-2"
            style={{
              padding: '8px 10px',
              borderTop: '1px solid var(--gp-border-strong)',
              background: 'var(--gp-surface-2)',
            }}
          >
            <span style={{ fontSize: 11, color: 'var(--gp-text-3)' }}>
              {selecionados.length} selecionado{selecionados.length === 1 ? '' : 's'}
            </span>
            {!inline && (
              <button
                type="button"
                onClick={() => setAberto(false)}
                className="rounded-sm px-2.5 py-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                style={{
                  fontSize: 11,
                  fontWeight: 700,
                  background: 'var(--gp-brand)',
                  color: 'var(--gp-on-brand)',
                  borderRadius: 'var(--gp-radius-sm)',
                }}
              >
                Concluir
              </button>
            )}

          </div>
        </div>
      )}

      {/* Escopo do controle. Fica sempre visível, não só no estado vazio: com um
          simulado já escolhido, nada mais na tela explica por que não há "todos"
          nem por que alguns itens vêm desabilitados. */}
      <p className="mt-2" style={{ fontSize: 11, color: 'var(--gp-text-3)' }}>
        Não existe &quot;todos&quot; — o agregado do período é a Visão Geral.
        Previstos/em processamento ficam desabilitados.
      </p>

      {semSelecao && !opcional && (
        // Contraste AA: `text-destructive` reprovava sobre o bg-card (3,78:1 no
        // claro). `gp-text-danger` (--gp-danger-on) dá 11,09:1 / 7,15:1.
        <p role="alert" className="mt-2 flex items-center gap-1.5 text-sm gp-text-danger">
          {/* `error_outline`, não `info`: a gramática do handoff §3 reserva
              `info-outlined` para informação — erro nunca sai de informativo. */}
          <Icon name="error_outline" size={17} className="shrink-0" />
          Escolha ao menos um simulado
        </p>
      )}

      {excedeLegibilidade && (
        <div
          role="status"
          data-testid="aviso-legibilidade"
          className="mt-2 flex gap-2.5"
          style={{
            background: 'var(--gp-warning-surface)',
            border: '1px solid var(--gp-warning)',
            borderRadius: 'var(--gp-radius-sm)',
            padding: '10px 13px',
          }}
        >
          <Icon
            name="error_outline"
            size={16}
            className="shrink-0 text-[color:var(--gp-warning-on)]"
          />
          <span style={{ fontSize: 11, lineHeight: '16px', color: 'var(--gp-warning-on)' }}>
            Comparações com mais de {LIMITE_LEGIBILIDADE} simulados ficam difíceis de ler
            ({selecionados.length} selecionados). Você pode continuar, mas considere focar
            nos mais relevantes.
          </span>
        </div>
      )}
    </div>
  );
}
