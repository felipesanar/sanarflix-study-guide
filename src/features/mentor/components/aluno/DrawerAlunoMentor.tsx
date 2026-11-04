/**
 * Drawer do aluno do Portal do Mentor (IMPLEMENTACAO.md § Reuso do Gestor: próprio do mentor, não estende o
 * `DrawerAluno` do Gestor). À direita, `min(560px,100%)` no B2C e `min(520px,100%)` no B2B; Radix Dialog dá
 * `aria-modal`, foco preso, Esc, scrim que fecha e retorno do foco ao gatilho.
 */
import * as React from 'react';
import { Sheet, SheetContent } from '@/components/ui/sheet';
import { Icon } from '@/features/gestor/components/Icon';
import { useGestorPortalContainer } from '@/features/gestor/shell/GestorShell';
import type { Modalidade } from '../../api/types';
import { ConteudoAlunoB2b } from './ConteudoAlunoB2b';
import { ConteudoAlunoB2c } from './ConteudoAlunoB2c';
import { SkeletonDrawer, ToastAluno, useToastAluno } from './partes';

export interface DrawerAlunoMentorProps {
  /** E-mail normalizado do aluno (id do aluno na fonte Academy). */
  email: string;
  /** `undefined` enquanto o contexto do mentor carrega. */
  modalidade: Modalidade | undefined;
  onFechar: () => void;
}

export function DrawerAlunoMentor({ email, modalidade, onFechar }: DrawerAlunoMentorProps) {
  const container = useGestorPortalContainer();
  const toast = useToastAluno();
  const b2b = modalidade === 'b2b';
  // Sem `Dialog.Trigger`, o Radix devolveria o foco a lugar nenhum: guardamos quem abriu (linha da tabela, card…).
  const gatilho = React.useRef<HTMLElement | null>(
    typeof document !== 'undefined' && document.activeElement instanceof HTMLElement && document.activeElement !== document.body ? document.activeElement : null,
  );
  const devolverFoco = (evento: Event) => {
    const alvo = gatilho.current;
    if (alvo && alvo.isConnected) { evento.preventDefault(); alvo.focus(); }
  };
  return (
    <Sheet open onOpenChange={(aberto) => { if (!aberto) onFechar(); }}>
      <SheetContent
        container={container}
        side="right"
        className={`flex w-full flex-col gap-0 overflow-hidden border-l-0 bg-[var(--gp-surface-1)] p-0 text-[color:var(--gp-text-1)] ${b2b ? 'sm:max-w-[520px]' : 'sm:max-w-[560px]'}`}
        style={{ width: b2b ? 'min(520px, 100%)' : 'min(560px, 100%)', boxShadow: '-28px 0 64px -30px rgba(0,0,0,0.42)' }}
        closeIcon={<Icon name="close" size={16} />}
        closeLabel="Fechar"
        closeClassName="right-6 top-5 inline-flex h-[34px] w-[34px] items-center justify-center rounded-[8px] border border-[color:var(--gp-border-strong)] bg-[var(--gp-surface-1)] text-[color:var(--gp-text-1)] opacity-100 max-[480px]:right-4 max-[640px]:h-11 max-[640px]:w-11"
        overlayClassName="bg-[var(--gp-scrim)]"
        data-testid="drawer-aluno"
        onCloseAutoFocus={devolverFoco}
      >
        {modalidade === undefined ? <SkeletonDrawer />
          : b2b ? <ConteudoAlunoB2b key={email} email={email} mostrarToast={toast.mostrar} />
            : <ConteudoAlunoB2c key={email} email={email} mostrarToast={toast.mostrar} />}
        <ToastAluno mensagem={toast.mensagem} />
      </SheetContent>
    </Sheet>
  );
}
