import * as React from 'react';
import { cn } from '@/lib/utils';
import { Icon } from '@/features/gestor/components/Icon';
import type { DendeIconName } from '@/features/gestor/components/icon-names';
import type { TipoConteudo } from '@/features/gestor/lib/engajamento';
import { ESTILO_ROTULO_FILTRO } from '@/features/gestor/components/engajamento/FiltroPeriodo';

const OPCOES: { valor: TipoConteudo; rotulo: string; icone?: DendeIconName }[] = [
  { valor: 'todos', rotulo: 'Todos' },
  { valor: 'video', rotulo: 'Vídeo', icone: 'play_circle' },
  { valor: 'document', rotulo: 'Documento', icone: 'documents' },
];

/**
 * Filtro "Tipo de conteúdo" da aba Conteúdos (spec §12.4): Todos, Vídeo e
 * Documento, com `aria-pressed` e o ícone do tipo. O valor é o do banco
 * (`todos` | `video` | `document`), o mesmo que a RPC recebe em `p_tipo`.
 */
export function FiltroTipoConteudo({
  tipo,
  setTipo,
}: {
  tipo: TipoConteudo;
  setTipo: (t: TipoConteudo) => void;
}) {
  const idRotulo = React.useId();

  return (
    <div className="flex flex-wrap items-center gap-2">
      <span id={idRotulo} style={ESTILO_ROTULO_FILTRO}>
        Tipo de conteúdo
      </span>
      <div role="group" aria-labelledby={idRotulo} className="flex flex-wrap gap-1.5">
        {OPCOES.map(({ valor, rotulo, icone }) => {
          const ativo = tipo === valor;
          return (
            <button
              key={valor}
              type="button"
              aria-pressed={ativo}
              onClick={() => setTipo(valor)}
              // Texto de marca sobre fundo escuro: `--gp-brand-on-dark` (regra do tema), por classe com `dark:`.
              className={cn(
                'inline-flex items-center gap-1.5',
                ativo ? 'text-[color:var(--gp-brand-strong)] dark:text-[color:var(--gp-brand-on-dark)]' : 'text-[color:var(--gp-text-2)]',
              )}
              style={{
                height: 32,
                padding: '0 12px',
                borderRadius: 'var(--gp-radius-pill)',
                fontSize: 'var(--gp-font-size-body)',
                fontWeight: ativo ? 600 : 500,
                border: `1px solid ${ativo ? 'var(--gp-brand-border)' : 'var(--gp-border-input)'}`,
                background: ativo ? 'var(--gp-brand-surface)' : 'var(--gp-surface-1)',
              }}
            >
              {icone ? <Icon name={icone} variant={ativo ? 'filled' : 'outlined'} size={16} /> : null}
              {rotulo}
            </button>
          );
        })}
      </div>
    </div>
  );
}
