import * as React from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { queryParaAba, type AbaEngajamento } from '@/features/gestor/hooks/useFiltrosEngajamento';

const BASE = '/gestor/engajamento';

const ABAS: { rotulo: string; aba: AbaEngajamento; pathname: string; exata?: boolean }[] = [
  { rotulo: 'Visão geral', aba: 'visao-geral', pathname: BASE, exata: true },
  { rotulo: 'Questões', aba: 'questoes', pathname: `${BASE}/questoes` },
  { rotulo: 'Conteúdos', aba: 'conteudos', pathname: `${BASE}/conteudos` },
];

/**
 * Barra de abas do Engajamento (spec §12.1): Visão geral, Questões e Conteúdos.
 *
 * Cada link carrega a query string atual, filtrada por `queryParaAba` (regra 5
 * da §9.6): Questões e Conteúdos removem o aluno, que só existe na Visão geral;
 * a Visão geral remove o tipo de conteúdo. Período, semestre e IES sobrevivem à
 * troca de aba.
 */
export function AbasEngajamento() {
  const { search } = useLocation();

  return (
    <nav
      aria-label="Seções de engajamento"
      className="flex gap-1"
      style={{ borderBottom: '1px solid var(--gp-border-strong)' }}
    >
      {ABAS.map(({ rotulo, aba, pathname, exata }) => (
        <NavLink
          key={aba}
          to={{ pathname, search: queryParaAba(search, aba) }}
          end={exata}
          // Texto de marca sobre fundo escuro usa `--gp-brand-on-dark` (regra do tema): por isso a cor
          // vai em classe, com a variante `dark:`, e não em `style` (mesmo padrão do SidebarNav).
          className={({ isActive }) =>
            cn(
              'relative -mb-px',
              isActive ? 'text-[color:var(--gp-brand-strong)] dark:text-[color:var(--gp-brand-on-dark)]' : 'text-[color:var(--gp-text-2)]',
            )
          }
          style={({ isActive }) => ({
            padding: '10px 14px',
            fontSize: 'var(--gp-font-size-body)',
            fontWeight: isActive ? 600 : 500,
            borderBottom: `2px solid ${isActive ? 'var(--gp-brand)' : 'transparent'}`,
          })}
        >
          {rotulo}
        </NavLink>
      ))}
    </nav>
  );
}
