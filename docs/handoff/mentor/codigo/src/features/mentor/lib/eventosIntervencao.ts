/**
 * Eventos de produto → efeito no kanban de Intervenções.
 *
 * O kanban se preenche sozinho a partir das ações do mentor (docs/06 §Eventos).
 * Implemente esta função no SERVIDOR (trigger/RPC) e use a mesma tabela aqui
 * no cliente só para atualização otimista — a fonte da verdade é o banco.
 */
import type { Intervencao, PerfilB2B, Publicacao, Sessao } from '../api/types';

export type EventoMentor =
  | { tipo: 'mural_publicado'; publicacao: Publicacao; registrarIntervencao: boolean; descricaoDestino: string }
  | { tipo: 'agenda_liberada'; alunoId: string; alunoNome: string }
  | { tipo: 'sessao_criada'; sessao: Sessao; alunoNome?: string }
  | { tipo: 'sessao_realizada'; sessaoId: string }
  | { tipo: 'intervencao_tema'; temaId: string; tema: string; acertoPct: number; origem: 'tema_critico' | 'questao' }
  | { tipo: 'intervencao_aluno'; alunoId: string; alunoNome: string; perfil: PerfilB2B | null }
  | { tipo: 'status_alterado'; intervencaoId: string; status: Intervencao['status'] };

type Novo = Omit<Intervencao, 'id' | 'criadaEm' | 'historico'>;

/** Devolve o card a criar (ou `null`) e/ou a mudança de status a aplicar. */
export function efeitoDoEvento(
  e: EventoMentor,
  cards: Intervencao[],
): { criar?: Novo; mover?: { id: string; status: Intervencao['status'] }[] } {
  switch (e.tipo) {
    case 'mural_publicado':
      if (!e.registrarIntervencao) return {};
      return {
        criar: {
          tipo: 'mensagem',
          titulo: `Mural: ${e.publicacao.titulo}`,
          nota: null,
          destino: e.publicacao.destino.tipo === 'turma' ? { turmaToda: true } : { alunoIds: e.publicacao.destino.alunoIds },
          perfil: null,
          status: 'feito',
          origem: 'mural',
          referenciaId: e.publicacao.id,
        },
      };
    case 'agenda_liberada':
      return {
        criar: {
          tipo: 'individual',
          titulo: `Reunião individual com ${e.alunoNome.split(' ')[0]}`,
          nota: null,
          destino: { alunoIds: [e.alunoId] },
          perfil: null,
          status: 'afazer',
          origem: 'agenda_liberada',
          referenciaId: e.alunoId,
        },
      };
    case 'sessao_criada': {
      const individual = e.sessao.tipo === 'individual';
      return {
        criar: {
          tipo: individual ? 'individual' : 'coletiva',
          titulo: individual ? `Reunião individual: ${e.sessao.tema ?? e.alunoNome ?? ''}` : `Sessão: ${e.sessao.tema ?? 'tema a definir'}`,
          nota: null,
          destino: individual && e.sessao.alunoId ? { alunoIds: [e.sessao.alunoId] } : { turmaToda: true },
          perfil: null,
          status: 'afazer',
          origem: 'sessao_criada',
          referenciaId: e.sessao.id,
        },
      };
    }
    case 'sessao_realizada':
      return {
        mover: cards.filter((c) => c.referenciaId === e.sessaoId && c.status !== 'feito').map((c) => ({ id: c.id, status: 'feito' as const })),
      };
    case 'intervencao_tema':
      return {
        criar: {
          tipo: 'coletiva',
          titulo: `${e.tema}: ${e.acertoPct}% de acerto da turma`,
          nota: null,
          destino: { turmaToda: true },
          perfil: null,
          status: 'afazer',
          origem: e.origem,
          referenciaId: e.temaId,
        },
      };
    case 'intervencao_aluno':
      return {
        criar: {
          tipo: 'individual',
          titulo: `Acompanhar ${e.alunoNome.split(' ')[0]}`,
          nota: null,
          destino: { alunoIds: [e.alunoId] },
          perfil: e.perfil,
          status: 'afazer',
          origem: 'manual',
          referenciaId: e.alunoId,
        },
      };
    case 'status_alterado':
      return { mover: [{ id: e.intervencaoId, status: e.status }] };
  }
}
