import { UserCog, School, Headset, GraduationCap } from 'lucide-react';
import { hasExperience, type Access, type ExperienceId } from '@/experiences/access';

export interface ExperienceOption {
  id: ExperienceId;
  /** Nome curto da experiência, como aparece no gatilho e no menu. */
  label: string;
  /** Uma linha explicando o que a pessoa encontra ali. */
  description: string;
  /** Entrypoint da experiência (ver EXPERIENCE_ENTRYPOINTS). */
  url: string;
  icon: React.ElementType;
}

/**
 * Experiências (portais) disponíveis para o usuário, em ordem fixa.
 *
 * Portais NÃO são itens de navegação: são trocas de experiência. A sidebar de
 * cada portal lista somente as telas daquele portal, e a alternância entre
 * eles acontece no `ExperienceSwitcher`, que consome esta lista.
 *
 * `aluno` é a base de todo usuário autenticado, por isso entra sempre.
 */
export const getExperienceOptions = (access: Access | null | undefined): ExperienceOption[] => {
  const options: ExperienceOption[] = [
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
      label: 'Gestão',
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

  return options;
};

/** Qual experiência a rota atual pertence (fallback: aluno, a base de todos). */
export const resolveCurrentExperience = (pathname: string): ExperienceId => {
  if (pathname.startsWith('/admin')) return 'admin';
  if (pathname.startsWith('/gestor')) return 'gestao';
  if (pathname.startsWith('/atendimento')) return 'atendimento';
  return 'aluno';
};
