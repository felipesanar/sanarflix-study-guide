import { UserCog, School, Headset, GraduationCap, Users } from 'lucide-react';
import type { ElementType } from 'react';
import { hasExperience, type Access, type ExperienceId } from '@/experiences/access';

export interface ExperienceOption {
  id: ExperienceId;
  /** Nome curto da experiência, como aparece no gatilho e no menu. */
  label: string;
  /** Uma linha explicando o que a pessoa encontra ali. */
  description: string;
  /** Entrypoint da experiência (ver EXPERIENCE_ENTRYPOINTS). */
  url: string;
  icon: ElementType;
}

/**
 * Experiências (portais) disponíveis para o usuário, em ordem fixa.
 *
 * Portais NÃO são itens de navegação: são trocas de experiência. A sidebar de
 * cada portal lista somente as telas daquele portal, e a alternância entre
 * eles acontece no `ExperienceSwitcher`, que consome esta lista.
 *
 * `aluno` entra para todos, exceto mentor que não é staff (seletor só para staff).
 */
export const getExperienceOptions = (access: Access | null | undefined): ExperienceOption[] => {
  // Handoff da Página do Mentor (tela 00): o seletor é só para staff. Quem é
  // mentor e não é admin/atendimento não vê "Aluno" — e, sendo só mentor,
  // fica com uma opção e o ExperienceSwitcher se esconde (options.length < 2).
  // A ROTA de aluno continua montada para todos (buildAppRoutes); só o seletor muda.
  const ehStaff = hasExperience(access, 'admin') || hasExperience(access, 'atendimento');
  const escondeAluno = hasExperience(access, 'mentor') && !ehStaff;

  const options: ExperienceOption[] = escondeAluno
    ? []
    : [
        {
          id: 'aluno',
          label: 'Aluno',
          description: 'Estudos, simulados e progresso',
          url: '/',
          icon: GraduationCap,
        },
      ];

  if (hasExperience(access, 'admin')) {
    options.push({
      id: 'admin',
      label: 'Admin',
      description: 'Administração da plataforma',
      url: '/admin',
      icon: UserCog,
    });
  }
  if (hasExperience(access, 'gestao')) {
    options.push({
      id: 'gestao',
      label: 'Gestor',
      description: 'Desempenho institucional da sua IES',
      url: '/gestor',
      icon: School,
    });
  }
  if (hasExperience(access, 'atendimento')) {
    options.push({
      id: 'atendimento',
      label: 'Atendimento',
      description: 'Suporte a usuários',
      url: '/atendimento/usuarios',
      icon: Headset,
    });
  }
  if (hasExperience(access, 'mentor')) {
    options.push({
      id: 'mentor',
      label: 'Mentor',
      description: 'Sua turma, mural, sessões e intervenções',
      url: '/mentor',
      icon: Users,
    });
  }

  return options;
};

/** Qual experiência a rota atual pertence (fallback: aluno, a base de todos). */
export const resolveCurrentExperience = (pathname: string): ExperienceId => {
  if (pathname.startsWith('/admin')) return 'admin';
  if (pathname.startsWith('/gestor')) return 'gestao';
  if (pathname.startsWith('/atendimento')) return 'atendimento';
  if (pathname.startsWith('/mentor')) return 'mentor';
  return 'aluno';
};
