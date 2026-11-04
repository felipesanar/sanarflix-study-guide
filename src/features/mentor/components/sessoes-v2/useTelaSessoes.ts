import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useAlunos, useConvites, useSessoes } from '../../api/queries';
import type { Sessao } from '../../api/types';
import { ordenarSessoes } from '../../lib/regrasMentor';
import type { AbaSessoes } from './FiltrosSessoes';
import { useToast } from './Toast';

/** Parâmetro da URL com a sessão aberta (docs/06 § Estado de UI: "Sessões → sessão aberta"). */
export const PARAM_SESSAO = 'sessao';
/** `?nova=<tipo>` abre o formulário (atalho vindo de outras telas). */
export const PARAM_NOVA = 'nova';

/**
 * Estado comum das duas modalidades: filtros e aba locais, sessão aberta na URL, toast e os nomes
 * dos alunos (lista da turma + convites). Lista final já em ordem cronológica (`ordenarSessoes`).
 */
export function useTelaSessoes<T extends string>(tipoPadrao: T, casaTipo: (s: Sessao, t: T) => boolean) {
  const [params, setParams] = useSearchParams();
  const sessoes = useSessoes();
  const alunos = useAlunos();
  const convites = useConvites();
  const toast = useToast();
  const [tipo, setTipo] = useState<T>(tipoPadrao);
  const [aba, setAba] = useState<AbaSessoes>('proximas');
  const [formAberto, setFormAberto] = useState(() => params.has(PARAM_NOVA));
  const nova = params.get(PARAM_NOVA);

  const todas = useMemo(() => sessoes.data?.data ?? [], [sessoes.data]);
  const lista = useMemo(() => ordenarSessoes(todas.filter((s) => casaTipo(s, tipo)), aba), [todas, casaTipo, tipo, aba]);
  /** `null` = parâmetro ausente; `''` = o mentor fechou todas. */
  const sessaoParam = params.get(PARAM_SESSAO);

  // Deep link para uma sessão realizada abre na aba certa (uma vez, quando a lista chega).
  const sincronizado = useRef(false);
  useEffect(() => {
    if (sincronizado.current || !sessaoParam || !sessoes.data) return;
    sincronizado.current = true;
    const alvo = todas.find((s) => s.id === sessaoParam);
    if (alvo) { setTipo(tipoPadrao); setAba(alvo.status === 'realizada' ? 'realizadas' : 'proximas'); }
  }, [sessaoParam, sessoes.data, todas, tipoPadrao]);

  const definirSessao = useCallback((id: string | null) => {
    setParams((atual) => {
      const p = new URLSearchParams(atual);
      p.set(PARAM_SESSAO, id ?? '');
      p.delete(PARAM_NOVA);
      return p;
    }, { replace: true });
  }, [setParams]);

  const nomes = useMemo(() => {
    const m = new Map<string, string>();
    for (const c of convites.data ?? []) if (c.alunoNome) m.set(c.alunoId, c.alunoNome);
    for (const a of alunos.data ?? []) m.set(a.alunoId, a.nome);
    return m;
  }, [alunos.data, convites.data]);
  const nomeDe = useCallback((id: string) => nomes.get(id) ?? null, [nomes]);
  const liberados = useMemo(() => new Set((convites.data ?? []).filter((c) => c.ativo).map((c) => c.alunoId)), [convites.data]);
  const agendaLiberada = useCallback((id: string) => liberados.has(id), [liberados]);

  return {
    sessoes, alunos, todas, lista, tipo, setTipo, aba, setAba, formAberto, setFormAberto, nova,
    sessaoParam, definirSessao, nomeDe, agendaLiberada, toast,
  };
}
