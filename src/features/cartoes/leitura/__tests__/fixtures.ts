import type { PaginaLeitura } from '../types';

/** Página fictícia de leitura; cada chamada ganha id e número novos. */
let seq = 0;
export function pagina(extra: Partial<PaginaLeitura> = {}): PaginaLeitura {
  seq++;
  return {
    id: `p${seq}`,
    leitura_id: 'L',
    pagina: seq,
    destino: 'respostas',
    status: 'ok',
    layout: 'sfa',
    identificacao: `2023${String(seq).padStart(3, '0')}`,
    via: 'matricula',
    motivo: '',
    respostas: { '1': 'A', '2': 'B', '3': null },
    duvidas: {},
    pendencias: [],
    imagem: null,
    identificacao_manual: null,
    respostas_manual: {},
    descartada: false,
    revisado_por: null,
    revisado_em: null,
    ...extra,
  };
}

