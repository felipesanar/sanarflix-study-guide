/** Efeitos declarativos de docs/06. Quem persiste atribui IDs e timestamps.
 * Ações compostas só emitem o evento após o sucesso no Flix (inclusive a
 * mensagem individual obrigatória antes de agenda_liberada).
 */
import type { Intervencao, PerfilB2B, Publicacao, Sessao } from '../api/types';

export type EventoMentor =
  | { tipo: 'mural_publicado'; publicacao: Publicacao; registrarIntervencao: boolean; descricaoDestino: string }
  | { tipo: 'agenda_liberada'; alunoId: string; alunoNome: string }
  | { tipo: 'sessao_criada'; sessao: Sessao; alunoNome?: string }
  | { tipo: 'sessao_realizada'; sessao: Sessao; alunoNome?: string }
  | { tipo: 'intervencao_tema'; temaId: string; tema: string; acertoPct: number | null; origem: 'tema_critico' | 'questao' }
  | { tipo: 'intervencao_aluno'; alunoId: string; alunoNome: string; perfil: PerfilB2B | null }
  | { tipo: 'whatsapp_aberto'; alunoId: string }
  | { tipo: 'status_alterado'; intervencaoId: string; status: Intervencao['status'] };

export type NovaIntervencao = Omit<Intervencao, 'id' | 'criadaEm' | 'historico'>;
export interface EfeitoEventoMentor {
  criar?: NovaIntervencao;
  mover?: { id: string; status: Intervencao['status'] }[];
  log?: { alunoId: string; texto: string }[];
  historico?: { intervencaoId: string; texto: string }[];
}

export function efeitoDoEvento(e: EventoMentor, cards: readonly Intervencao[]): EfeitoEventoMentor {
  switch (e.tipo) {
    case 'mural_publicado':
      if (!e.registrarIntervencao) return {};
      return { criar: {
        tipo: 'mensagem', titulo: `Mural: ${e.publicacao.titulo}`, nota: null,
        destino: e.publicacao.destino.tipo === 'turma' ? { turmaToda: true } : { alunoIds: [...e.publicacao.destino.alunoIds] },
        perfil: null, status: 'feito', origem: 'mural', referenciaId: e.publicacao.id,
      } };
    case 'agenda_liberada':
      return {
        criar: {
          tipo: 'individual', titulo: `Reunião individual com ${e.alunoNome.trim().split(/\s+/)[0]}`, nota: null,
          destino: { alunoIds: [e.alunoId] }, perfil: null, status: 'afazer', origem: 'agenda_liberada', referenciaId: e.alunoId,
        },
        log: [{ alunoId: e.alunoId, texto: 'Agendamento individual liberado' }],
      };
    case 'sessao_criada':
    case 'sessao_realizada': {
      if (e.tipo === 'sessao_realizada') {
        const ligados = cards.filter(c => c.origem === 'sessao_criada' && c.referenciaId === e.sessao.id);
        if (ligados.length > 0) return { mover: ligados.filter(c => c.status !== 'feito').map(c => ({ id: c.id, status: 'feito' })) };
      }
      const individual = e.sessao.tipo === 'individual';
      return { criar: {
        tipo: individual ? 'individual' : 'coletiva',
        titulo: individual ? `Reunião individual: ${e.sessao.tema ?? e.alunoNome ?? ''}` : `Sessão: ${e.sessao.tema ?? 'tema a definir'}`,
        nota: null, destino: individual ? { alunoIds: e.sessao.alunoId ? [e.sessao.alunoId] : [] } : { turmaToda: true },
        perfil: null, status: e.tipo === 'sessao_realizada' ? 'feito' : 'afazer', origem: 'sessao_criada', referenciaId: e.sessao.id,
      } };
    }
    case 'intervencao_tema':
      return { criar: {
        tipo: 'coletiva', titulo: `${e.tema}: ${e.acertoPct === null ? '—' : `${e.acertoPct}%`} de acerto da turma`,
        nota: null, destino: { turmaToda: true }, perfil: null, status: 'afazer', origem: e.origem, referenciaId: e.temaId,
      } };
    case 'intervencao_aluno':
      return { criar: {
        tipo: 'individual', titulo: `Acompanhar ${e.alunoNome.trim().split(/\s+/)[0]}`, nota: null,
        destino: { alunoIds: [e.alunoId] }, perfil: e.perfil, status: 'afazer', origem: 'manual', referenciaId: e.alunoId,
      } };
    case 'whatsapp_aberto':
      return { log: [{ alunoId: e.alunoId, texto: 'WhatsApp aberto pelo Academy' }] };
    case 'status_alterado': {
      const rotulos = { afazer: 'A fazer', andamento: 'Em andamento', feito: 'Feito' };
      return {
        mover: [{ id: e.intervencaoId, status: e.status }],
        historico: [{ intervencaoId: e.intervencaoId, texto: `Status alterado para ${rotulos[e.status]}` }],
      };
    }
  }
}
