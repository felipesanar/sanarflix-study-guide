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
import type { Aviso } from '@/features/gestor/api/types';

/** Máximo de avisos na home (handoff docs/04-componentes.md §6). */
export const AVISOS_VISIVEIS = 3;

export interface AvisosSanarProps {
  iesId: string;
}

function Moldura({ children }: { children: React.ReactNode }) {
  return (
    <Card data-testid="avisos">
      <CardHeader>
        <CardTitle className="text-base">Avisos da Sanar</CardTitle>
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
        <EstadoErro titulo="Não foi possível carregar os avisos." onRetry={refetch} />
      </Moldura>
    );
  }

  const avisos = data ?? [];

  if (avisos.length === 0) {
    return (
      <Moldura>
        <EstadoVazio titulo="Nenhum aviso da Sanar por aqui." />
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
      <ul className="space-y-1">
        {visiveis.map((aviso) => (
          <li key={aviso.id}>
            <button
              type="button"
              data-testid={`aviso-${aviso.id}`}
              data-lido={aviso.lido ? 'true' : 'false'}
              aria-expanded={abertoId === aviso.id}
              onClick={() => abrir(aviso)}
              className={cn(
                'w-full rounded-md px-3 py-2 text-left transition-colors hover:bg-accent',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                !aviso.lido && 'bg-primary/5',
              )}
            >
              <span className="flex items-center gap-2">
                {!aviso.lido && (
                  <span
                    data-testid={`aviso-ponto-${aviso.id}`}
                    aria-hidden="true"
                    className="h-2 w-2 shrink-0 rounded-full bg-primary"
                  />
                )}
                <span className="truncate text-sm font-medium text-foreground">
                  {aviso.titulo}
                </span>
                {!aviso.lido && <span className="sr-only">não lido</span>}
              </span>
              <span className="mt-1 block text-xs text-muted-foreground">
                {formatData(aviso.data)}
              </span>
              {abertoId === aviso.id && (
                <span className="mt-2 block text-sm text-muted-foreground">{aviso.resumo}</span>
              )}
            </button>
          </li>
        ))}
      </ul>

      {avisos.length > AVISOS_VISIVEIS && (
        <Button
          variant="link"
          size="sm"
          className="mt-2 px-0"
          onClick={() => setExpandido((atual) => !atual)}
        >
          {expandido ? 'Ver menos' : 'Ver todos'}
        </Button>
      )}
    </Moldura>
  );
}
