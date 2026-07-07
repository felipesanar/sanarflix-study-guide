import * as React from 'react';
import { ChevronsUpDown, Building2 } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { toast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import type { AccessibleIes } from '@/types';

const iesInitials = (nome: string): string =>
  nome
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0])
    .join('')
    .toUpperCase();

/** Avatar quadrado com iniciais da IES — mesmo vocabulário do avatar do usuário, cor secundária. */
const IesAvatar: React.FC<{ nome: string; className?: string }> = ({ nome, className }) => (
  <div
    className={cn(
      'flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-secondary to-secondary/60 text-secondary-foreground shadow-sm',
      className,
    )}
  >
    {nome ? (
      <span className="text-[11px] font-semibold">{iesInitials(nome)}</span>
    ) : (
      <Building2 className="h-4 w-4" />
    )}
  </div>
);

interface SidebarIesContextProps {
  /** IES ativa (nome resolvido para exibição). */
  activeIesNome: string | undefined;
  /** IES acessíveis (para multi-IES); vazio/1 item = mono-IES (bloco estático). */
  accessibleIes: AccessibleIes[];
  /** True quando o usuário pode ver a opção "Todas as IES" (admin com ies.manage). */
  canSeeAllIes?: boolean;
  /** IES atualmente selecionada nos filtros (para destacar no dropdown). */
  activeIesId: string;
  onSelectIes: (iesId: string, iesNome: string) => void;
}

/**
 * Bloco de contexto global de IES — topo da sidebar (logo abaixo do header do
 * logo, acima do cartão de usuário). Para multi-IES é clicável (DropdownMenu
 * com as IES acessíveis); para mono-IES é um bloco estático. No modo
 * colapsado da sidebar, vira só o avatar.
 */
export const SidebarIesContext: React.FC<SidebarIesContextProps> = ({
  activeIesNome,
  accessibleIes,
  canSeeAllIes,
  activeIesId,
  onSelectIes,
}) => {
  const isMultiIes = accessibleIes.length > 1 || canSeeAllIes;
  const nome = activeIesNome ?? '';

  const handleSelect = (iesId: string, iesNome: string) => {
    onSelectIes(iesId, iesNome);
    toast({ description: `IES ativa: ${iesNome}`, duration: 2500 });
  };

  if (!isMultiIes) {
    return (
      <div
        className={cn(
          'flex items-center gap-3 rounded-xl p-3 border border-border/40 bg-gradient-to-br from-card via-card to-secondary/10',
          'group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:p-2 group-data-[collapsible=icon]:border-transparent group-data-[collapsible=icon]:bg-transparent',
        )}
      >
        <IesAvatar nome={nome} />
        <div className="min-w-0 flex-1 group-data-[collapsible=icon]:hidden">
          <p className="text-[10px] font-medium tracking-widest text-muted-foreground uppercase leading-none">
            Instituição
          </p>
          <p className="text-sm font-semibold text-sidebar-foreground truncate leading-tight mt-1">
            {nome || 'Instituição'}
          </p>
        </div>
      </div>
    );
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className={cn(
            'group/ies flex w-full items-center gap-3 rounded-xl p-3 border border-border/40 bg-gradient-to-br from-card via-card to-secondary/10',
            'shadow-sm hover:shadow-md hover:border-primary/20 transition-all duration-200 text-left',
            'group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:p-2 group-data-[collapsible=icon]:border-transparent group-data-[collapsible=icon]:bg-transparent group-data-[collapsible=icon]:shadow-none',
          )}
        >
          <IesAvatar nome={nome} />
          <div className="min-w-0 flex-1 group-data-[collapsible=icon]:hidden">
            <p className="text-[10px] font-medium tracking-widest text-muted-foreground uppercase leading-none">
              Instituição
            </p>
            <p className="text-sm font-semibold text-sidebar-foreground truncate leading-tight mt-1">
              {nome || 'Todas as IES'}
            </p>
          </div>
          <ChevronsUpDown className="h-3.5 w-3.5 text-muted-foreground shrink-0 group-data-[collapsible=icon]:hidden" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-64">
        <DropdownMenuLabel className="text-[10px] uppercase tracking-widest text-muted-foreground">
          Trocar instituição
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        {canSeeAllIes && (
          <DropdownMenuItem
            onClick={() => handleSelect('', 'Todas as IES')}
            className={cn('gap-2.5', activeIesId === '' && 'bg-accent/60')}
          >
            <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
              <Building2 className="h-3.5 w-3.5" />
            </div>
            <span className="truncate font-medium">Todas as IES</span>
          </DropdownMenuItem>
        )}
        {accessibleIes.map((ies) => (
          <DropdownMenuItem
            key={ies.id}
            onClick={() => handleSelect(ies.id, ies.nome)}
            className={cn('gap-2.5', activeIesId === ies.id && 'bg-accent/60')}
          >
            <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary text-[10px] font-semibold">
              {iesInitials(ies.nome)}
            </div>
            <span className="truncate">{ies.nome}</span>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
};
