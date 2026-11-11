import type { components } from './contrato/tipos.gerado';
import type { AlunoFlix, MeFlix } from './fonte';
import type { CanalTurma } from './types';

export function mentorDaApi(mentor: components['schemas']['Mentor']): MeFlix['mentor'] {
  return { ...mentor, agendaUrl: null };
}

export function meDaApi(resposta: components['schemas']['Me']): MeFlix {
  return {
    mentor: mentorDaApi(resposta.mentor),
    tribos: resposta.tribos.map((tribo) => ({ ...tribo })),
    // O acesso ao portal continua decidido pelo Academy, nao pelo Flix.
    portalMentor: true,
  };
}

export function alunoDaApi(aluno: components['schemas']['Aluno']): AlunoFlix {
  return { ...aluno };
}

export function canalDaApi(canal: components['schemas']['Canal']): CanalTurma {
  return {
    tipo: canal.tipo === 'grupo_tribo' ? 'grupo_turma' : canal.tipo,
    nome: canal.nome,
    url: canal.url ?? '',
    editavel: canal.editavel,
    configurado: !!canal.url,
  };
}

export function tipoCanalParaApi(tipo: CanalTurma['tipo']): components['schemas']['TipoCanal'] {
  return tipo === 'grupo_turma' ? 'grupo_tribo' : tipo;
}
