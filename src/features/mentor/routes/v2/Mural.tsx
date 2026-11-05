/**
 * Mural (B2C) · docs/02 § Tela 4 e docs/08 6.1–6.2 · capturas b2c/11, 11b, 12, 13.
 * Composer com prévia ao vivo, Publicadas (Editar/Excluir, "· editada") e Canais da tribo.
 * Deep link: `?para=` (e-mails) `&grupo=` `&titulo=` `&mensagem=` `&tag=` (ver `deepLinkMural.ts`).
 */
import { useCallback, useEffect, useMemo, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import { mensagemErro } from '@/features/mentor/api/erros';
import type { Publicacao } from '@/features/mentor/api/types';
import {
  useAlunos, useCanais, useDesempenhoTurma, useExcluirPublicacao, useMe, useMural, useSalvarGrupoTribo, useTurmaAcademy,
} from '@/features/mentor/api/queries';
import { gruposDeAlerta } from '@/features/mentor/components/mural-v2/alertasMural';
import { CanaisTribo } from '@/features/mentor/components/mural-v2/CanaisTribo';
import { ComposerMural, type RefsCampos } from '@/features/mentor/components/mural-v2/ComposerMural';
import { lerDeepLinkMural, PARAMS_DEEP_LINK_MURAL } from '@/features/mentor/components/mural-v2/deepLinkMural';
import { iconeDaTribo } from '@/features/mentor/components/mural-v2/iconeTribo';
import { PreviaAluno } from '@/features/mentor/components/mural-v2/PreviaAluno';
import { PublicadasMural } from '@/features/mentor/components/mural-v2/PublicadasMural';
import { TEXTOS_MURAL } from '@/features/mentor/components/mural-v2/rotulosMural';
import { ToastMural, useToastMural } from '@/features/mentor/components/mural-v2/ToastMural';
import { useComposerMural } from '@/features/mentor/components/mural-v2/useComposerMural';
import type { CampoMural } from '@/features/mentor/components/mural-v2/validacaoMural';
import '@/features/mentor/components/mural-v2/mural-v2.css';

export default function Mural() {
  const me = useMe();
  const alunos = useAlunos();
  const mural = useMural();
  const canais = useCanais();
  const turma = useTurmaAcademy();
  const desempenho = useDesempenhoTurma(null);
  const salvarGrupo = useSalvarGrupoTribo();
  const excluir = useExcluirPublicacao();
  const { toast, mostrar } = useToastMural();
  const [params, setParams] = useSearchParams();

  const tribos = me.data?.tribos.filter((t) => t.modalidade === 'b2c') ?? [];
  const tribo = tribos.find((t) => t.papel === 'titular') ?? tribos[0];
  const triboNome = tribo?.nome ?? '';
  const totalTurma = alunos.data?.length ?? tribo?.totalAlunos ?? null;

  const refs: RefsCampos = {
    titulo: useRef<HTMLInputElement>(null), mensagem: useRef<HTMLTextAreaElement>(null), selecao: useRef<HTMLDivElement>(null),
    linkUrl: useRef<HTMLInputElement>(null), linkTitulo: useRef<HTMLInputElement>(null), anexo: useRef<HTMLButtonElement>(null),
  };
  const refsEstaveis = useRef(refs);
  const focarCampo = useCallback((campo: CampoMural) => {
    // O painel do link pode estar abrindo neste mesmo render.
    setTimeout(() => refsEstaveis.current[campo]?.current?.focus(), 0);
  }, []);

  const composer = useComposerMural({ alunos: alunos.data, totalTurma, avisar: mostrar, focarCampo });

  const grupos = useMemo(() => {
    const porEmail = new Map((alunos.data ?? []).map((a) => [a.email.trim().toLowerCase(), a.alunoId]));
    return gruposDeAlerta(turma.data, desempenho.data)
      .map((g) => ({ ...g, alunoIds: g.emails.map((e) => porEmail.get(e.trim().toLowerCase())).filter((x): x is string => !!x) }))
      .filter((g) => g.alunoIds.length > 0);
  }, [alunos.data, turma.data, desempenho.data]);

  // Deep link: aplica uma vez (com e-mails, depois que a lista de alunos chegar) e limpa a URL.
  const deepLinkAplicado = useRef(false);
  const { aplicarDeepLink } = composer;
  useEffect(() => {
    if (deepLinkAplicado.current) return;
    const dl = lerDeepLinkMural(params);
    if (!dl) return;
    if (dl.emails.length > 0 && !alunos.isSuccess && !alunos.isError) return;
    deepLinkAplicado.current = true;
    aplicarDeepLink(dl);
    const prox = new URLSearchParams(params);
    for (const p of PARAMS_DEEP_LINK_MURAL) prox.delete(p);
    setParams(prox, { replace: true });
  }, [params, setParams, alunos.isSuccess, alunos.isError, aplicarDeepLink]);

  const nomeDe = useCallback((id: string) => alunos.data?.find((a) => a.alunoId === id)?.nome ?? null, [alunos.data]);

  function editar(p: Publicacao) {
    composer.carregar(p);
    window.scrollTo?.({ top: 0, behavior: 'smooth' });
    focarCampo('titulo');
  }

  async function excluirPublicacao(p: Publicacao) {
    try {
      await excluir.mutateAsync(p.id);
      if (composer.edicao?.id === p.id) composer.limpar();
      mostrar(TEXTOS_MURAL.toastExcluida);
    } catch (e) {
      mostrar(mensagemErro(e));
    }
  }

  return (
    <div className="mural-v2">
      <header>
        <h1 data-testid="mentor-mural">Mural</h1>
      </header>

      <div className="mural-grade">
        <ComposerMural
          composer={composer}
          alunos={alunos.data}
          grupos={grupos}
          totalTurma={totalTurma}
          refs={refs}
          onCancelarEdicao={() => { composer.limpar(); focarCampo('titulo'); }}
        />
        <PreviaAluno form={composer.form} triboNome={triboNome} mentorNome={me.data?.mentor.nome ?? ''} iconeUrl={iconeDaTribo(tribo)} />
      </div>

      <PublicadasMural
        itens={mural.data?.data}
        carregando={mural.isLoading}
        erro={mural.isError}
        tentandoNovamente={mural.isError && mural.isFetching}
        onTentarNovamente={() => void mural.refetch()}
        nomeDe={nomeDe}
        onEditar={editar}
        onExcluir={(p) => void excluirPublicacao(p)}
        excluindoId={excluir.isPending ? (excluir.variables ?? null) : null}
        editandoId={composer.edicao?.id ?? null}
      />

      <CanaisTribo
        canais={canais.data}
        carregando={canais.isLoading}
        erro={canais.isError}
        tentandoNovamente={canais.isError && canais.isFetching}
        onTentarNovamente={() => void canais.refetch()}
        triboNome={triboNome}
        onSalvar={(url) => salvarGrupo.mutateAsync(url)}
        avisar={mostrar}
      />

      <ToastMural toast={toast} />
    </div>
  );
}
