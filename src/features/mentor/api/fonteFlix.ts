/**
 * fonteFlix (`VITE_FLIX_MENTORIA=on`): alunos, mural, sessões, convites e canais pela API de Mentoria do
 * Flix (contrato v2.1) via Edge `flix-mentoria-proxy`. Desempenho e kanban continuam no Academy.
 *
 * `eventosNoServidor = false`: o Flix não conhece o kanban; as mutations compostas de `queries.ts`
 * chamam `registrar_evento_mentor` depois do sucesso no Flix.
 */
import type { ConviteFlix, FonteMentoria, NovaPublicacao, Pagina } from './fonte';
import type { components } from './contrato/tipos.gerado';
import { alunoDaApi, canalDaApi, meDaApi, mentorDaApi, tipoCanalParaApi } from './adaptadoresFlix';
import { criarClienteFlix, query, type InvocarProxy } from './flixClient';
import type { Publicacao, Sessao } from './types';

export type { InvocarProxy } from './flixClient';

/** A turma cabe na memória (B2C ~90, B2B até ~1.500): percorre todas as páginas. */
const LIMITE_PAGINA = 200;

/** Remove o que é só do Academy antes de mandar ao Flix. */
function corpoPublicacao(p: Partial<NovaPublicacao>) {
  const resto = { ...p };
  delete resto.registrarIntervencao;
  return resto;
}

export function criarFonteFlix(invocar?: InvocarProxy): FonteMentoria {
  const { chamar } = criarClienteFlix(invocar);

  async function todasPaginas<T>(caminho: (cursor: string | null) => string): Promise<T[]> {
    const itens: T[] = [];
    let cursor: string | null = null;
    do {
      const pg: Pagina<T> = await chamar<Pagina<T>>('GET', caminho(cursor));
      itens.push(...(pg?.data ?? []));
      cursor = pg?.nextCursor ?? null;
    } while (cursor);
    return itens;
  }

  return {
    nome: 'flix',
    eventosNoServidor: false,

    me: async () => meDaApi(await chamar<components['schemas']['Me']>('GET', '/me')),
    atualizarPerfil: async ({ fotoUrl, bio, mote, googleEmail }) => {
      const corpo: components['schemas']['AtualizarMe'] = {
        ...(fotoUrl === undefined ? {} : { fotoUrl }),
        ...(bio === undefined ? {} : { bio }),
        ...(mote === undefined ? {} : { mote }),
        ...(googleEmail === undefined ? {} : { googleEmail }),
      };
      return mentorDaApi(await chamar<components['schemas']['Mentor']>('PATCH', '/me', corpo));
    },

    alunos: async (triboId, busca) =>
      (await todasPaginas<components['schemas']['Aluno']>((cursor) => `/tribos/${triboId}/alunos${query({ limit: LIMITE_PAGINA, busca, cursor })}`)).map(alunoDaApi),
    aluno: async (triboId, alunoId) => alunoDaApi(await chamar<components['schemas']['Aluno']>('GET', `/tribos/${triboId}/alunos/${encodeURIComponent(alunoId)}`)),

    canais: async (triboId) => (await chamar<components['schemas']['ListaCanais']>('GET', `/tribos/${triboId}/canais`)).map(canalDaApi),
    salvarGrupoTribo: async (triboId, url) => canalDaApi(await chamar<components['schemas']['Canal']>('PUT', `/tribos/${triboId}/canais/${tipoCanalParaApi('grupo_turma')}`, { url })),

    publicacoes: (triboId, filtro) =>
      chamar<Pagina<Publicacao>>('GET', `/tribos/${triboId}/publicacoes${query({ status: filtro?.status, tag: filtro?.tag })}`),
    criarPublicacao: (triboId, p) => chamar<Publicacao>('POST', `/tribos/${triboId}/publicacoes`, corpoPublicacao(p)),
    editarPublicacao: (id, p) => chamar<Publicacao>('PATCH', `/publicacoes/${id}`, corpoPublicacao(p)),
    excluirPublicacao: async (id) => { await chamar<void>('DELETE', `/publicacoes/${id}`); },
    pedirUpload: (arquivo) => chamar<{ uploadUrl: string; fileUrl: string }>('POST', '/uploads', arquivo),

    sessoes: (triboId, filtro) =>
      chamar<Pagina<Sessao>>('GET', `/tribos/${triboId}/sessoes${query({ de: filtro?.de, ate: filtro?.ate, status: filtro?.status, tipo: filtro?.tipo })}`),
    criarSessao: (triboId, s) => chamar<Sessao & { warnings: string[] }>('POST', `/tribos/${triboId}/sessoes`, s),
    editarSessao: (id, s) => chamar<Sessao>('PATCH', `/sessoes/${id}`, s),
    excluirSessao: async (id) => { await chamar<void>('DELETE', `/sessoes/${id}`); },
    vincularGravacao: (id, g) => chamar<Sessao>('POST', `/sessoes/${id}/gravacao`, { ...g, origem: 'manual' }),

    convites: (triboId) => chamar<ConviteFlix[]>('GET', `/tribos/${triboId}/convites`),
    liberarAgenda: (triboId, alunoId, mensagem) => chamar<ConviteFlix>('POST', `/tribos/${triboId}/convites`, { alunoId, mensagem }),
    desligarAgenda: async (conviteId) => { await chamar<void>('DELETE', `/convites/${conviteId}`); },
  };
}
