import * as React from 'react';
import { cn } from '@/lib/utils';
import { Icon } from '@/features/gestor/components/Icon';
import { Tag } from '@/features/gestor/components/Tag';
import type { ItemCronograma } from '../api/types';

/**
 * Acima disso a leitura dos gráficos degrada — aviso, nunca bloqueio (§4.7.2).
 *
 * Limiar mantido em "acima de 5" (`>`), como mandam docs/02-regras-de-negocio.md §4.2
 * e docs/04-componentes.md §1.2. A cópia do mockup diz "5 ou mais", mas é a
 * legenda de um estado ilustrativo, não a regra — e as duas fontes normativas
 * concordam entre si. O texto do aviso abaixo foi escrito para o limiar real,
 * para não anunciar uma regra que o componente não cumpre.
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
}

/**
 * Multi-seleção de simulados do Detalhamento (§4.7, handoff §10.4).
 *
 * Campo com os selecionados em CHIPS REMOVÍVEIS + painel de checkboxes. A
 * forma importa: antes daqui a lista era um `ToggleGroup` sempre expandido, e
 * um simulado que ficasse indisponível DEPOIS de selecionado virava um botão
 * marcado e desabilitado — sem nenhum caminho para desmarcá-lo. O "×" do chip
 * é esse caminho (a outra metade da correção, o filtro de ids indisponíveis,
 * mora em `routes/Detalhamento.tsx`).
 *
 * Sem Portal de propósito: o painel é um bloco no fluxo, dentro da subárvore
 * `.gestor-portal`, onde os tokens `--gp-*` e o `prefers-reduced-motion` do
 * tema alcançam. Um popover portalizado em `document.body` sairia do escopo.
 */
export function SeletorSimulados({ itens, selecionados, onChange }: SeletorSimuladosProps) {
  const [aberto, setAberto] = React.useState(false);
  const idPainel = React.useId();

  const semSelecao = selecionados.length === 0;
  const excedeLegibilidade = selecionados.length > LIMITE_LEGIBILIDADE;

  // Chips na ordem do cronograma, não na ordem de clique: a mesma leitura da lista.
  const escolhidos = itens.filter((item) => selecionados.includes(item.id));

  const alternar = (id: string) => {
    onChange(
      selecionados.includes(id)
        ? selecionados.filter((outro) => outro !== id)
        : [...selecionados, id],
    );
  };

  return (
    <div
      data-testid="seletor-simulados"
      className={cn(
        'rounded-lg border border-border bg-card p-3',
        semSelecao && 'border-destructive ring-2 ring-destructive/20',
      )}
    >
      <div
        className="flex flex-wrap items-center gap-2"
        style={{
          border: '1.5px solid var(--gp-text-2)',
          borderRadius: 'var(--gp-radius-sm)',
          padding: '9px 12px',
          fontSize: 13,
          color: 'var(--gp-text-1)',
        }}
      >
        <span>Simulados:</span>

        {escolhidos.map((item) => (
          <span
            key={item.id}
            className="inline-flex items-center gap-1.5 whitespace-nowrap leading-none"
            style={{
              border: '1px solid var(--gp-border-input)',
              background: 'var(--gp-surface-3)',
              borderRadius: 'var(--gp-radius-pill)',
              padding: '3px 6px 3px 10px',
              fontSize: 12,
              fontWeight: 600,
            }}
          >
            {item.nome}
            <button
              type="button"
              onClick={() => alternar(item.id)}
              aria-label={`Remover ${item.nome} do recorte`}
              className="inline-flex items-center rounded-full text-[color:var(--gp-text-3)] hover:text-[color:var(--gp-text-1)]"
            >
              <Icon name="close" size={12} />
            </button>
          </span>
        ))}

        <button
          type="button"
          onClick={() => setAberto((estava) => !estava)}
          aria-expanded={aberto}
          // Só referencia o painel quando ele existe: `aria-controls` apontando
          // para um id ausente é atributo inválido para a AT (e para o axe).
          aria-controls={aberto ? idPainel : undefined}
          aria-label="Escolher simulados"
          className="flex flex-1 items-center justify-between gap-2"
        >
          <span className="text-[color:var(--gp-text-3)]">
            {semSelecao ? 'selecione 1 ou mais' : ''}
          </span>
          <Icon
            name={aberto ? 'expand_less' : 'expand_more'}
            size={15}
            className="text-[color:var(--gp-text-3)]"
          />
        </button>
      </div>

      {aberto && (
        <div
          id={idPainel}
          role="group"
          aria-label="Simulados do recorte"
          className="mt-3 overflow-hidden"
          style={{
            border: '1px solid var(--gp-border-strong)',
            borderRadius: 'var(--gp-radius-sm)',
          }}
        >
          <p
            style={{
              padding: '9px 12px',
              fontSize: 11,
              color: 'var(--gp-text-3)',
              background: 'var(--gp-surface-2)',
              borderBottom: '1px solid var(--gp-border-strong)',
            }}
          >
            Simulados do recorte · marque 1 ou mais
          </p>

          {itens.map((item, indice) => {
            const motivo = motivoIndisponivel(item);
            const marcado = selecionados.includes(item.id);
            const rotulo = rotuloItem(item);
            return (
              <label
                key={item.id}
                className={cn(
                  'flex items-center gap-3',
                  motivo === null ? 'gp-hover-surface cursor-pointer' : 'cursor-not-allowed',
                )}
                style={{
                  padding: '11px 12px',
                  fontSize: 13,
                  borderTop: indice === 0 ? undefined : '1px solid var(--gp-border-subtle)',
                  background: marcado ? 'var(--gp-brand-surface)' : undefined,
                  opacity: motivo === null ? undefined : 0.6,
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
                  className="flex items-center justify-center peer-focus-visible:ring-2 peer-focus-visible:ring-ring peer-focus-visible:ring-offset-2"
                  style={{
                    width: 16,
                    height: 16,
                    flex: 'none',
                    borderRadius: RAIO_CHECKBOX,
                    border: `1.5px ${motivo === null ? 'solid' : 'dashed'} ${
                      marcado ? 'var(--gp-brand)' : 'var(--gp-border-input)'
                    }`,
                    background: marcado ? 'var(--gp-brand)' : 'transparent',
                    color: 'var(--gp-on-brand)',
                  }}
                >
                  {marcado && <Icon name="check" size={11} />}
                </span>
                <span
                  style={{
                    flex: 1,
                    color: marcado ? 'var(--gp-text-1)' : 'var(--gp-text-2)',
                    fontWeight: marcado ? 600 : 400,
                  }}
                >
                  {rotulo}
                </span>
                {motivo !== null && <Tag variant="qualificador">{motivo}</Tag>}
              </label>
            );
          })}
        </div>
      )}

      {/* Escopo do controle. Fica sempre visível, não só no estado vazio: com um
          simulado já escolhido, nada mais na tela explica por que não há "todos"
          nem por que alguns itens vêm desabilitados. */}
      <p className="mt-2" style={{ fontSize: 11, color: 'var(--gp-text-3)' }}>
        Não existe &quot;todos&quot; — o agregado do período é a Visão Geral.
        Previstos/em processamento ficam desabilitados.
      </p>

      {semSelecao && (
        // Task: contraste AA de "Escolha ao menos um simulado" (texto real, text-sm — mínimo
        // 4,5:1; o ícone é aria-hidden e redundante com este texto, só herda a cor por
        // currentColor). text-destructive contra o bg-card deste <div> dava 3,78:1 no claro e
        // 3,48:1 no escuro (reprova AA) — mesmo achado do KpiCard. gp-text-danger
        // (--gp-danger-on) dá 11,09:1 no claro e 7,15:1 no escuro. Ver contrasteDestructive.test.tsx.
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
