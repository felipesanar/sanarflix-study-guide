import * as React from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { ThemeToggle } from '@/components/ThemeToggle';
import { useAuth } from '@/contexts/AuthContext';
import { ExperienceSwitcher } from '@/experiences/shared/ExperienceSwitcher';
import { useGestorContexto } from '@/features/gestor/api/queries';
import type { ContextoGestor } from '@/features/gestor/api/types';
import { Icon } from '@/features/gestor/components/Icon';
import { SidebarIes } from '@/features/gestor/shell/SidebarIes';
import { OVERLINE_SIDEBAR, SidebarNav } from '@/features/gestor/shell/SidebarNav';

/**
 * Conteúdo da sidebar do Portal do Gestor — lockup · instituição · navegação ·
 * rodapé (perfil, troca de experiência, sair, tema).
 *
 * Extraído do `GestorShell` na auditoria de 09/08 (item B7, "shell
 * responsivo"): abaixo de `lg` a coluna fixa de 240px não cabe, e o mesmo
 * conteúdo passa a ser servido dentro de um drawer. Um único componente para
 * os dois casos porque duplicar a sidebar era garantir que ela divergisse — a
 * nav de tablet ficaria uma versão velha da de desktop na primeira mudança.
 */
export interface ConteudoSidebarProps {
  /**
   * Chamado quando a pessoa aciona algo que troca de tela. No drawer é o que
   * o fecha (sem isso, quem navega no tablet fica olhando o menu por cima da
   * tela que acabou de pedir); na sidebar fixa não é passado, porque não há
   * nada para fechar.
   */
  aoNavegar?: () => void;
}

/** Iniciais do nome (até 2), para o avatar do rodapé. */
const iniciaisDe = (nome: string | undefined): string =>
  (nome ?? '')
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((parte) => parte[0]?.toUpperCase() ?? '')
    .join('');

/**
 * Segunda linha do rodapé: o PAPEL da pessoa, como na referência ("Gestora
 * acadêmica"), não o e-mail. Rótulos sem marca de gênero — a mesma conta serve
 * a qualquer pessoa. O e-mail continua alcançável, no `title` do bloco.
 */
const ROTULO_PAPEL: Record<ContextoGestor['usuario']['papel'], string> = {
  admin: 'Administração',
  gestor_grupo: 'Gestão do grupo',
  gestor: 'Gestão acadêmica',
};

/** Divisor entre os blocos da sidebar (lockup · IES · nav · rodapé). */
const DIVISOR = '1px solid var(--gp-border-subtle)';

export const ConteudoSidebar: React.FC<ConteudoSidebarProps> = ({ aoNavegar }) => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const { data: contexto } = useGestorContexto();
  const papel = contexto?.usuario.papel;

  return (
    <>
      <div
        className="flex flex-col"
        style={{ padding: '22px 20px 18px', gap: 14, borderBottom: DIVISOR }}
      >
        <div className="flex items-center">
          {/* Marca: duas `<img>` (clara/branca) alternadas por `dark:` —
              nunca `filter: invert()`, nunca redesenho. */}
          <img
            src="/sanarflix-academy-lockup.svg"
            alt="SanarFlix Academy"
            width={533}
            height={138}
            loading="eager"
            decoding="sync"
            fetchPriority="high"
            className="h-12 w-auto dark:hidden"
          />
          <img
            src="/sanarflix-academy-lockup-white.svg"
            alt=""
            aria-hidden="true"
            width={533}
            height={138}
            loading="eager"
            decoding="sync"
            fetchPriority="high"
            className="hidden h-12 w-auto dark:block"
          />
        </div>
        <span style={OVERLINE_SIDEBAR}>Portal do Gestor</span>
      </div>

      <div style={{ padding: '14px 16px', borderBottom: DIVISOR }}>
        <SidebarIes />
      </div>

      <SidebarNav onNavegar={aoNavegar} />

      <div
        className="mt-auto flex flex-col"
        style={{ borderTop: DIVISOR, padding: '12px 12px 12px', gap: 12 }}
      >
        {/* Ações primeiro (acima do perfil): o seletor de experiência ocupa a
            largura sobrando; tema e sair são ícones (rótulo só no a11y). */}
        <div className="flex items-center" style={{ gap: 6 }}>
          <ExperienceSwitcher variant="compact" className="min-w-0 flex-1" />
          {/* ThemeToggle é compartilhado (h-10 por padrão); aqui ele desce a
              32px para casar com a altura da faixa sem virar outro botão. */}
          <div className="shrink-0 [&>button]:h-8 [&>button]:w-8">
            <ThemeToggle />
          </div>
          <Button
            variant="ghost"
            size="icon"
            aria-label="Sair da conta"
            title="Sair"
            className="h-8 w-8 shrink-0 text-[color:var(--gp-text-3)]"
            onClick={() => logout()}
          >
            <Icon name="logout" size={16} />
          </Button>
        </div>

        {/* Identidade: avatar + nome/papel + avisos, tudo numa linha só. */}

        <div className="flex items-center" style={{ gap: 8 }}>
          <span
            aria-hidden="true"
            className="flex shrink-0 items-center justify-center rounded-full"
            style={{
              width: 30,
              height: 30,
              fontSize: 11,
              fontWeight: 700,
              // `lineHeight: 1` — ver TileIes em SidebarIes.tsx: com o
              // `normal` (≈1.21em na Inter) a caixa de linha não é
              // simétrica em torno das maiúsculas e a sigla assenta fora
              // do centro vertical do tile.
              lineHeight: 1,
              background: 'var(--gp-brand-surface)',
              // No claro este token É a marca; no escuro ele vira o tom
              // clareado que passa AA sobre superfície escura — nunca a
              // marca crua como cor de texto ali.
              color: 'var(--gp-brand-on-dark)',
            }}
          >
            {iniciaisDe(user?.nome)}
          </span>
          <div className="min-w-0 flex-1" title={user?.email ?? undefined}>
            <p
              className="truncate"
              style={{ fontSize: 12.5, fontWeight: 600, lineHeight: '15px', color: 'var(--gp-text-1)' }}
            >
              {user?.nome ?? '—'}
            </p>
            {/* `minHeight` reserva a linha antes de o papel chegar do
                servidor — senão o rodapé cresce 13px no meio do carregamento. */}
            <p
              className="truncate"
              style={{ fontSize: 10.5, lineHeight: '13px', minHeight: 13, color: 'var(--gp-text-3)' }}
            >
              {papel ? ROTULO_PAPEL[papel] : ''}
            </p>
          </div>
          <button
            type="button"
            aria-label="Avisos da Sanar"
            onClick={() => {
              navigate('/gestor');
              aoNavegar?.();
            }}
            className="gp-hover-surface flex shrink-0 items-center justify-center"
            style={{
              width: 28,
              height: 28,
              borderRadius: 'var(--gp-radius-sm)',
              color: 'var(--gp-text-2)',
            }}
          >
            <Icon name="notifications" size={16} />
          </button>
        </div>

        {/* Ações: uma única faixa horizontal. O seletor de experiência ocupa
            a largura sobrando; tema e sair são ícones (rótulo só no a11y —
            "Tema" escrito ao lado do botão era texto sem função). */}
        <div className="flex items-center" style={{ gap: 6 }}>
          <ExperienceSwitcher variant="compact" className="min-w-0 flex-1" />
          {/* ThemeToggle é compartilhado (h-10 por padrão); aqui ele desce a
              32px para casar com a altura da faixa sem virar outro botão. */}
          <div className="shrink-0 [&>button]:h-8 [&>button]:w-8">
            <ThemeToggle />
          </div>
          <Button
            variant="ghost"
            size="icon"
            aria-label="Sair da conta"
            title="Sair"
            className="h-8 w-8 shrink-0 text-[color:var(--gp-text-3)]"
            onClick={() => logout()}
          >
            <Icon name="logout" size={16} />
          </Button>
        </div>
      </div>
    </>
  );
};
