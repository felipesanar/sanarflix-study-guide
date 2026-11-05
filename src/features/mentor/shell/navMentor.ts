import type { DendeIconName } from '@/features/gestor/components/icon-names';
import type { ContagensNav } from '@/features/mentor/api/queries';

export interface ItemNavMentor {
  to: string;
  rotulo: string;
  icone: DendeIconName;
  badge?: keyof ContagensNav;
}

const inicio: ItemNavMentor = { to: '/mentor', rotulo: 'Início', icone: 'home' };
const detalhamento: ItemNavMentor = {
  to: '/mentor/detalhamento', rotulo: 'Detalhamento por Simulados', icone: 'equalizer',
};
const sessoes: ItemNavMentor = { to: '/mentor/sessoes', rotulo: 'Sessões', icone: 'calendar_month' };
const intervencoes: ItemNavMentor = {
  to: '/mentor/intervencoes', rotulo: 'Intervenções', icone: 'format-list-bullet', badge: 'intervencoesAFazer',
};

export const navMentor: Record<'b2c' | 'b2b', readonly ItemNavMentor[]> = {
  b2c: [
    inicio,
    { to: '/mentor/turma', rotulo: 'Minha Turma', icone: 'groups' },
    detalhamento,
    { to: '/mentor/mural', rotulo: 'Mural', icone: 'campaign' },
    sessoes,
    intervencoes,
  ],
  b2b: [
    inicio,
    { to: '/mentor/visao-geral', rotulo: 'Visão Geral', icone: 'equalizer' },
    { ...detalhamento, icone: 'documents' },
    sessoes,
    { to: '/mentor/canais', rotulo: 'Canais', icone: 'email', badge: 'canaisPendentes' },
    intervencoes,
  ],
};
