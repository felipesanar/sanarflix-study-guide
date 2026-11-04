/** Peças visuais compartilhadas pelos blocos do Início (anatomia dos protótipos, tokens do Gestor). */
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Icon } from '@/features/gestor/components/Icon';
import { cn } from '@/lib/utils';

/** Anel de foco do portal: 2px da marca, offset 2 (docs/01 § Acessibilidade). */
export const FOCO = 'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#941F1F]';
/** Foco de linha inteira (botão de largura total): o anel fica para dentro para não ser cortado pelo bloco. */
export const FOCO_LINHA = 'focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-[#941F1F]';
/** Linha-botão com hover do Gestor. */
export const LINHA = cn('w-full border-0 border-t border-[var(--gp-border-subtle)] bg-[var(--gp-surface-1)] text-left text-[var(--gp-text-1)] hover:bg-[var(--gp-surface-2)] motion-safe:transition-colors', FOCO_LINHA);
/** Alvo de toque: 32px no desktop, 44px abaixo de 980px. */
const ALVO = 'min-h-8 max-[979.98px]:min-h-11';

/** Link de ação do cabeçalho de bloco ("Ver agenda", "Abrir kanban"…): marca, 12.5px/600. */
export function LinkAcao({ children, onClick, chevron = false }: { children: ReactNode; onClick: () => void; chevron?: boolean }) {
  return (
    <button
      type="button" onClick={onClick}
      className={cn('inline-flex items-center gap-0.5 whitespace-nowrap rounded-md border-0 bg-transparent p-0 text-[12.5px] font-semibold text-[var(--gp-brand)] hover:text-[var(--gp-brand-strong)]', ALVO, FOCO)}
    >
      {children}{chevron ? <Icon name="chevron_right" size={14} /> : null}
    </button>
  );
}

/** Botão secundário pequeno (28px) usado dentro do destaque de sessão. */
export function BotaoPequeno({ children, onClick }: { children: ReactNode; onClick: () => void }) {
  return (
    <button
      type="button" onClick={onClick}
      className={cn('inline-flex h-7 items-center whitespace-nowrap rounded-md border border-[var(--gp-border-strong)] bg-[var(--gp-surface-1)] px-2.5 text-[12.5px] font-semibold text-[var(--gp-text-1)] hover:border-[var(--gp-border-input)] max-[979.98px]:h-11', FOCO)}
    >
      {children}
    </button>
  );
}

/** Bloco branco com H2 15/650 e ações à direita (Próximas sessões, A fazer, Grupo da semana). */
export function BlocoInicio({ id, titulo, contagem, acao, children }: { id: string; titulo: string; contagem?: ReactNode; acao?: ReactNode; children: ReactNode }) {
  return (
    <section aria-labelledby={id} className="overflow-hidden rounded-xl border border-[var(--gp-border-strong)] bg-[var(--gp-surface-1)]">
      <div className="flex items-center gap-2 px-5 pb-2.5 pt-3.5">
        <h2 id={id} className="m-0 text-[15px] font-[650] text-[var(--gp-text-1)]">{titulo}</h2>
        {contagem !== undefined ? <span className="text-[12.5px] tabular-nums text-[var(--gp-text-3)]">{contagem}</span> : null}
        {acao ? <span className="ml-auto">{acao}</span> : null}
      </div>
      {children}
    </section>
  );
}

/** Texto curto de vazio dentro de um bloco ("Nada pendente."). */
export function VazioBloco({ children }: { children: ReactNode }) {
  return <p className="m-0 border-t border-[var(--gp-border-subtle)] px-5 pb-4 pt-3 text-[13px] text-[var(--gp-text-2)]">{children}</p>;
}

/** Marcador compacto de projeção (quadrado tracejado de 9px, `title="Projetado"`). */
export function MarcadorProjetado({ decorativo = false }: { decorativo?: boolean }) {
  const classe = 'inline-block h-[9px] w-[9px] flex-none rounded-[2px] border-[1.5px] border-dashed border-[var(--gp-text-3)]';
  return decorativo
    ? <span aria-hidden="true" className={classe} />
    : <span role="img" aria-label="projetado" title="Projetado" className={classe} />;
}

/** Toast do portal: embaixo no centro, `role="status"`, some em 3,2 s (docs/01 § Padrões). */
export function useToast(): { mostrar: (texto: string) => void; toast: ReactNode } {
  const [texto, setTexto] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout>>();
  useEffect(() => () => clearTimeout(timer.current), []);
  const mostrar = (t: string) => {
    clearTimeout(timer.current);
    setTexto(t);
    timer.current = setTimeout(() => setTexto(null), 3200);
  };
  const toast = (
    <div role="status" aria-live="polite" className="pointer-events-none fixed inset-x-4 bottom-6 z-50 flex justify-center">
      {texto ? (
        <span className="inline-flex max-w-full items-center gap-2 rounded-[10px] bg-[#111212] px-4 py-2.5 text-[13.5px] text-white shadow-[0_12px_32px_-12px_rgba(0,0,0,0.4)]">
          <Icon name="check" size={15} />{texto}
        </span>
      ) : null}
    </div>
  );
  return { mostrar, toast };
}
