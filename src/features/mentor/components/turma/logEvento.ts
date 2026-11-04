const TIPO_INTERVENCAO: Record<string, string> = {
  reuniao_individual: 'Reunião individual',
  reuniao_coletiva: 'Reunião coletiva',
  mensagem_mural: 'Mensagem no mural',
  whatsapp: 'WhatsApp',
  outro: 'Outro',
};

const STATUS_INTERVENCAO: Record<string, string> = {
  a_fazer: 'A fazer',
  em_andamento: 'Em andamento',
  feito: 'Feito',
};

const TIPO_SESSAO: Record<string, string> = { coletiva: 'Coletiva', individual: 'Individual' };

function texto(valor: unknown): string | null {
  return typeof valor === 'string' && valor.trim() ? valor.trim() : null;
}

function juntar(...partes: (string | null)[]): string {
  return partes.filter(Boolean).join(' · ');
}

/**
 * Linha em pt-BR para um evento de `mentoria_eventos`, a partir das chaves que
 * as RPCs gravam no payload (mural_publicado {post_id, tag}, intervencao_criada
 * {tipo, alvo}, intervencao_status {de, para}, sessao_criada {sessao_id, tipo,
 * inicio}, …).
 */
export function descreverEvento(tipo: string, payload: Record<string, unknown> | null | undefined): string {
  const p = payload ?? {};
  switch (tipo) {
    case 'mural_publicado':
      return juntar('Mural', texto(p.tag));
    case 'intervencao_criada': {
      const t = texto(p.tipo);
      return juntar('Intervenção criada', t ? (TIPO_INTERVENCAO[t] ?? null) : null);
    }
    case 'intervencao_status': {
      const de = texto(p.de);
      const para = texto(p.para);
      if (!de || !para) return 'Status da intervenção atualizado';
      return `Status: ${STATUS_INTERVENCAO[de] ?? de} → ${STATUS_INTERVENCAO[para] ?? para}`;
    }
    case 'intervencao_comentario':
      return 'Comentário em intervenção';
    case 'sessao_criada': {
      const t = texto(p.tipo);
      return juntar('Sessão agendada', t ? (TIPO_SESSAO[t] ?? null) : null);
    }
    case 'sessao_realizada':
      return 'Sessão realizada';
    case 'agenda_liberada':
      return 'Agenda individual liberada';
    case 'agenda_desligada':
      return 'Agenda individual desligada';
    default:
      return 'Interação';
  }
}
