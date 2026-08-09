import * as React from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { useAvisos } from '@/features/gestor/api/queries';
import { useMarcarAvisoLido } from '@/features/gestor/hooks/useMarcarAvisoLido';
import { formatData } from '@/features/gestor/lib/formatters';
import { EstadoErro } from '@/features/gestor/components/EstadoErro';
import { EstadoVazio } from '@/features/gestor/components/EstadoVazio';
import { GestorSkeleton } from '@/features/gestor/components/GestorSkeleton';
import { Icon } from '@/features/gestor/components/Icon';
import type { Aviso } from '@/features/gestor/api/types';

/** Máximo de avisos na home (handoff docs/04-componentes.md §6). */
export const AVISOS_VISIVEIS = 3;

/**
 * Mesma altura do bloco vizinho e do fallback de `Inicio.tsx` — skeleton, vazio
 * e erro compartilham o número para que a coluna não encolha ao trocar de
 * estado (spec §8.4). Duplicado como literal de propósito: importar a constante
 * do `CronogramaSimulados` arrastaria o `useCronograma` dele para dentro de
 * qualquer teste que mocke `api/queries` só com `useAvisos`.
 */
const ALTURA_BLOCO = 288;

export interface AvisosSanarProps {
  iesId: string;
}

function Moldura({ children }: { children: React.ReactNode }) {
  return (
    <Card data-testid="avisos">
      <CardHeader>
        <div className="flex items-center gap-2">
          <span className="flex flex-none items-center" style={{ color: 'var(--gp-text-2)' }}>
            <Icon name="notifications" size={18} />
          </span>
          <CardTitle className="text-base">Avisos da Sanar</CardTitle>
        </div>
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  );
}

/** Segundo bloco da coluna direita — sem destaque, o Cronograma é a âncora. */
export function AvisosSanar({ iesId }: AvisosSanarProps) {
  const { data, isLoading, isError, refetch } = useAvisos(iesId);
  const marcarLido = useMarcarAvisoLido(iesId);
  const [expandido, setExpandido] = React.useState(false);
  const [abertoId, setAbertoId] = React.useState<string | null>(null);

  if (isLoading) {
    return (
      <Moldura>
        <div className="space-y-3">
          {[0, 1, 2].map((linha) => (
            <div key={linha} data-testid="avisos-skeleton">
              <GestorSkeleton altura={56} rotulo="Carregando avisos" />
            </div>
          ))}
        </div>
      </Moldura>
    );
  }

  if (isError) {
    return (
      <Moldura>
        <EstadoErro
          titulo="Não foi possível carregar os avisos."
          altura={ALTURA_BLOCO}
          onRetry={refetch}
        />
      </Moldura>
    );
  }

  const avisos = data ?? [];

  if (avisos.length === 0) {
    return (
      <Moldura>
        {/* Glifo do que está faltando, não um ícone genérico de vazio (§9). */}
        <EstadoVazio
          titulo="Nenhum aviso da Sanar por aqui."
          glifo="notifications"
          altura={ALTURA_BLOCO}
        />
      </Moldura>
    );
  }

  const visiveis = expandido ? avisos : avisos.slice(0, AVISOS_VISIVEIS);

  const abrir = (aviso: Aviso) => {
    setAbertoId((atual) => (atual === aviso.id ? null : aviso.id));
    if (!aviso.lido) {
      marcarLido.mutate(aviso.id);
    }
  };

  return (
    <Moldura>
      <ul className="flex flex-col gap-2">
        {visiveis.map((aviso) => {
          const aberto = abertoId === aviso.id;
          return (
            <li key={aviso.id}>
              <button
                type="button"
                data-testid={`aviso-${aviso.id}`}
                data-lido={aviso.lido ? 'true' : 'false'}
                aria-expanded={aberto}
                onClick={() => abrir(aviso)}
                className={cn(
                  // motion-3 (200ms): spec §20 — "fundo volta ao normal em
                  // 200ms" ao marcar como lido. O default do Tailwind (150ms)
                  // e o antigo 140ms (motion-2, reação tátil) estão fora da
                  // duração que essa mudança de estado pede.
                  'w-full px-3 py-2 text-left transition-colors [transition-duration:var(--gp-motion-3)]',
                  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                  // rounded-sm = --gp-radius-sm, o mesmo raio do não-lido
                  // abaixo. `rounded-md` resolvia para 10px, raio que a escala
                  // do handoff não tem.
                  aviso.lido && 'rounded-sm hover:bg-accent',
                  !aviso.lido && 'border',
                )}
                style={
                  aviso.lido
                    ? undefined
                    : {
                        // Não-lido: fundo tintado de marca + borda (§10.13) — o
                        // ponto sozinho é canal fraco demais numa lista densa.
                        borderRadius: 'var(--gp-radius-sm)',
                        background: 'var(--gp-brand-surface)',
                        borderColor: 'var(--gp-brand-border)',
                      }
                }
              >
                <span className="flex items-center gap-2">
                  {/*
                   * O ponto SEMPRE monta (spec §20) — desmontar na hora ("marcar
                   * como lido" otimista) era um corte seco. Some por
                   * opacidade/escala em motion-2 (140ms), a mesma duração do
                   * "ponto da marca desaparece com fade" da spec; quem controla
                   * é só `!aviso.lido`, então o `data-testid` continua existindo
                   * (em repouso, invisível) para o lido também.
                   */}
                  <span
                    data-testid={`aviso-ponto-${aviso.id}`}
                    aria-hidden="true"
                    className="shrink-0"
                    style={{
                      width: 7,
                      height: 7,
                      borderRadius: 'var(--gp-radius-pill)',
                      background: 'var(--gp-brand)',
                      opacity: aviso.lido ? 0 : 1,
                      transform: aviso.lido ? 'scale(0)' : 'scale(1)',
                      transitionProperty: 'opacity, transform',
                      transitionDuration: 'var(--gp-motion-2)',
                      transitionTimingFunction: 'var(--gp-ease)',
                    }}
                  />
                  <span className="truncate text-sm font-medium text-foreground">
                    {aviso.titulo}
                  </span>
                  <span className="ml-auto flex flex-none items-center text-muted-foreground">
                    <Icon name={aberto ? 'expand_less' : 'expand_more'} size={15} />
                  </span>
                </span>
                <span className="mt-1 block text-xs text-muted-foreground">
                  {formatData(aviso.data)}
                  {/* Estado de leitura em TEXTO, não só na cor do fundo (§11). */}
                  {!aviso.lido ? ' · não lido' : ''}
                </span>
                {aberto && (
                  <span className="mt-2 block text-sm text-muted-foreground">{aviso.resumo}</span>
                )}
              </button>
            </li>
          );
        })}
      </ul>

      {avisos.length > AVISOS_VISIVEIS && (
        <Button
          variant="link"
          size="sm"
          className="mt-2 gap-1 px-0"
          onClick={() => setExpandido((atual) => !atual)}
        >
          {expandido ? 'Ver menos' : 'Ver todos'}
          <Icon name={expandido ? 'chevron_left' : 'chevron_right'} size={14} />
        </Button>
      )}
    </Moldura>
  );
}
