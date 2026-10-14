import * as React from 'react';
import { useQuery } from '@tanstack/react-query';
import { useSearchParams } from 'react-router-dom';
import { NovaPublicacao } from '@/features/mentor/components/mural/NovaPublicacao';
import { PostsPublicados } from '@/features/mentor/components/mural/PostsPublicados';
import { fetchMentorContexto } from '@/services/mentor/contexto';
import type { PostMural } from '@/services/mentor/mural';
import { fetchTurma } from '@/services/mentor/turma';

/** Mural (tela 05): nova publicação, preview "Como o aluno vê" e lista de publicações. */
const Mural: React.FC = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const paraEmail = searchParams.get('para')?.trim().toLowerCase() || null;
  const [editando, setEditando] = React.useState<PostMural | null>(null);
  // Muda a cada save/edição para remontar o formulário com estado limpo.
  const [versaoForm, setVersaoForm] = React.useState(0);

  const turmaQuery = useQuery({ queryKey: ['mentor', 'turma'], queryFn: fetchTurma });
  const { data: contexto } = useQuery({ queryKey: ['mentor', 'contexto'], queryFn: fetchMentorContexto });

  const limparPara = () => {
    if (!searchParams.has('para')) return;
    const proximo = new URLSearchParams(searchParams);
    proximo.delete('para');
    setSearchParams(proximo, { replace: true });
  };

  const concluir = () => {
    setEditando(null);
    setVersaoForm((v) => v + 1);
    limparPara();
  };

  return (
    <div className="space-y-8">
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold">Mural</h1>
        <p className="text-sm text-muted-foreground">
          Publique recados para a turma toda ou para alunos específicos.
        </p>
      </div>

      {turmaQuery.isLoading && <p className="text-sm text-muted-foreground">Carregando sua turma…</p>}
      {turmaQuery.isError && (
        <p className="text-sm text-destructive">
          Não foi possível carregar sua turma. Tente de novo em instantes.
        </p>
      )}
      {turmaQuery.data && (
        <>
          <NovaPublicacao
            key={`${editando?.id ?? 'novo'}-${versaoForm}`}
            turma={turmaQuery.data}
            mentorId={contexto?.mentor?.user_id ?? null}
            post={editando}
            destinatariosIniciais={!editando && paraEmail ? [paraEmail] : []}
            onConcluido={concluir}
            onCancelarEdicao={() => {
              setEditando(null);
              setVersaoForm((v) => v + 1);
            }}
          />
          <PostsPublicados
            turma={turmaQuery.data}
            onEditar={(p) => {
              setEditando(p);
              window.scrollTo?.({ top: 0, behavior: 'smooth' });
            }}
          />
        </>
      )}
    </div>
  );
};

export default Mural;
