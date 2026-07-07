import * as React from 'react';
import { ConsoleShell } from '@/experiences/admin/AdminLayout';

/**
 * Layout da experiência Atendimento / CX (`/atendimento/*`).
 *
 * Wrapper fino do MESMO shell do Portal do Admin ({@link ConsoleShell},
 * `portal="cx"`) — sidebar, marca, portal switch e rodapé compartilhados; só
 * a navegação (grupo "Atendimento": Usuários + Feedbacks, via `CX_NAV_GROUPS`
 * em `AdminNav.ts`) e as capabilities mudam. Elimina a duplicação de shell
 * que existia entre `AdminLayout`/`AtendimentoLayout` antes desta reescrita.
 */
export const AtendimentoLayout: React.FC = () => <ConsoleShell portal="cx" />;
