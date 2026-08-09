import * as React from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Check, ChevronsUpDown } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { useAuth } from '@/contexts/AuthContext';
import { getExperienceOptions, resolveCurrentExperience } from '@/experiences/shared/globalNav';
import { cn } from '@/lib/utils';

export interface ExperienceSwitcherProps {
  /**
   * - `full`: gatilho com ícone, rótulo e chevron (sidebar do aluno, sheet mobile).
   * - `icon`: só o ícone da experiência atual, com tooltip (sidebar colapsada).
   * - `compact`: gatilho baixo, para o rodapé das sidebars de Admin/CX e Gestor.
   */
  variant?: 'full' | 'icon' | 'compact';
  className?: string;
  /** Chamado após navegar (ex.: fechar o sheet do menu mobile). */
  onNavigate?: () => void;
}

/**
 * Alternador de experiência (portal).
 *
 * Portais não são itens de navegação: aluno, gestão, admin e atendimento são
 * EXPERIÊNCIAS distintas, cada uma com a própria sidebar. Este controle é o
 * único lugar onde se troca de uma para outra — presente no topo da sidebar do
 * aluno e no rodapé das sidebars dos portais dedicados.
 *
 * Quem só tem a experiência de aluno não vê nada (nada a alternar).
 */
export const ExperienceSwitcher: React.FC<ExperienceSwitcherProps> = ({
  variant = 'full',
  className,
  onNavigate,
}) => {
  const { access } = useAuth();
  const navigate = useNavigate();
  const { pathname } = useLocation();

  const options = React.useMemo(() => getExperienceOptions(access), [access]);
  if (options.length < 2) return null;

  const currentId = resolveCurrentExperience(pathname);
  const current = options.find((o) => o.id === currentId) ?? options[0];
  const CurrentIcon = current.icon;

  const trocar = (url: string) => {
    navigate(url);
    onNavigate?.();
  };

  const trigger =
    variant === 'icon' ? (
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            type="button"
            aria-label={`Experiência atual: ${current.label}. Trocar de experiência`}
            className="flex h-9 w-9 items-center justify-center rounded-lg border border-border/60 bg-card text-foreground transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50"
          >
            <CurrentIcon className="h-4 w-4" aria-hidden="true" />
          </button>
        </TooltipTrigger>
        <TooltipContent side="right">Trocar de experiência</TooltipContent>
      </Tooltip>
    ) : (
      <button
        type="button"
        aria-label={`Experiência atual: ${current.label}. Trocar de experiência`}
        className={cn(
          'group flex w-full items-center gap-2.5 rounded-xl border border-border/60 bg-card text-left transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50',
          variant === 'compact' ? 'px-2.5 py-1.5' : 'px-3 py-2.5',
        )}
      >
        <span
          className={cn(
            'flex shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary',
            variant === 'compact' ? 'h-6 w-6' : 'h-7 w-7',
          )}
        >
          <CurrentIcon className={variant === 'compact' ? 'h-3.5 w-3.5' : 'h-4 w-4'} aria-hidden="true" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-[10px] uppercase tracking-widest text-muted-foreground">
            Experiência
          </span>
          <span className="block truncate text-sm font-semibold text-foreground">{current.label}</span>
        </span>
        <ChevronsUpDown className="h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-hidden="true" />
      </button>
    );

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild className={className}>
        {trigger}
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="start"
        side={variant === 'icon' ? 'right' : 'bottom'}
        sideOffset={8}
        className="w-[264px] p-1.5"
      >
        <DropdownMenuLabel className="px-2 text-[10px] uppercase tracking-widest text-muted-foreground">
          Trocar de experiência
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        {options.map((option) => {
          const OptionIcon = option.icon;
          const atual = option.id === current.id;
          return (
            <DropdownMenuItem
              key={option.id}
              onSelect={() => trocar(option.url)}
              aria-current={atual ? 'page' : undefined}
              className="items-start gap-2.5 rounded-lg px-2 py-2"
            >
              <span
                className={cn(
                  'mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg',
                  atual ? 'bg-primary/10 text-primary' : 'bg-muted text-muted-foreground',
                )}
              >
                <OptionIcon className="h-4 w-4" aria-hidden="true" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-medium text-foreground">{option.label}</span>
                <span className="block text-xs leading-snug text-muted-foreground">
                  {option.description}
                </span>
              </span>
              {atual && <Check className="mt-1.5 h-4 w-4 shrink-0 text-primary" aria-hidden="true" />}
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
};
