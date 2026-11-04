import type { QueryClient } from '@tanstack/react-query';

/**
 * Chave do contexto do mentor (`MentorLayout`, Início, Turma, Mural, Sessões).
 * É a única query `['mentor', …]` que nenhuma mutação altera, então fica de fora
 * da invalidação para não refazer `get_mentor_contexto` à toa.
 */
const CHAVE_CONTEXTO = 'contexto';

/**
 * Invalida todas as queries do portal do mentor (`['mentor', …]`), exceto o contexto.
 *
 * O `QueryClient` do app tem `staleTime` de 30 min e `refetchOnMount: false`; sem isso,
 * qualquer tela montada depois de uma mutação mostra o dado antigo até o F5. As mutações
 * do mentor se espalham (uma sessão coletiva cria post no mural, liberar agenda cria
 * intervenção e post, etc.), então invalidamos tudo em vez de manter uma matriz de
 * dependências. Só as queries ativas refazem a busca na hora; as demais ficam marcadas
 * como velhas e refazem ao montar.
 */
export function invalidarMentor(qc: QueryClient): Promise<void> {
  return qc.invalidateQueries({
    predicate: (query) => query.queryKey[0] === 'mentor' && query.queryKey[1] !== CHAVE_CONTEXTO,
  });
}
