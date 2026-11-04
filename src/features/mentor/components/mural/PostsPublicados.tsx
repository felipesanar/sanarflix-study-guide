import * as React from 'react';
import { useQuery } from '@tanstack/react-query';
import { Paperclip } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { listarPosts, listarTags, type PostMural } from '@/services/mentor/mural';
import type { AlunoTurma } from '@/services/mentor/turma';
import { pluralAlunos } from './muralUtils';

interface Props {
  turma: AlunoTurma[];
  onEditar: (post: PostMural) => void;
}

const SELECT_CLASSE =
  'h-9 rounded-md border border-input bg-background px-3 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring';

function formatarData(iso: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? '' : d.toLocaleDateString('pt-BR');
}

/** Lista de posts do mentor com filtro por aluno e por tag. */
export const PostsPublicados: React.FC<Props> = ({ turma, onEditar }) => {
  const [alunoEmail, setAlunoEmail] = React.useState('');
  const [tag, setTag] = React.useState('');

  const { data: tags = [] } = useQuery({ queryKey: ['mentor', 'mural', 'tags'], queryFn: listarTags });
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['mentor', 'mural', 'posts', alunoEmail, tag],
    queryFn: () => listarPosts({ alunoEmail: alunoEmail || null, tag: tag || null }),
  });

  const nomes = React.useMemo(() => new Map(turma.map((a) => [a.email, a.nome?.trim() || a.email])), [turma]);
  const posts = data ?? [];
  const publicados = posts.filter((p) => p.status === 'publicado');
  const rascunhos = posts.filter((p) => p.status === 'rascunho');
  const filtrando = Boolean(alunoEmail || tag);

  const cartao = (p: PostMural) => (
    <li key={p.id} className="space-y-2 rounded-lg border bg-card p-4">
      <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
        <span className="rounded-full bg-muted px-2 py-0.5 text-foreground">{p.tag}</span>
        <span>
          {p.publico === 'turma'
            ? 'Toda a turma'
            : `Selecionados · ${pluralAlunos(p.destinatarios.length)}`}
        </span>
        {p.publicado_em && <span>{formatarData(p.publicado_em)}</span>}
      </div>
      <h3 className="font-semibold">{p.titulo}</h3>
      <p className="line-clamp-3 whitespace-pre-wrap text-sm text-muted-foreground">{p.mensagem}</p>
      {p.publico === 'selecionados' && p.destinatarios.length > 0 && (
        <p className="text-xs text-muted-foreground">
          {p.destinatarios
            .slice(0, 5)
            .map((e) => nomes.get(e) ?? e)
            .join(', ')}
          {p.destinatarios.length > 5 ? ` e mais ${p.destinatarios.length - 5}` : ''}
        </p>
      )}
      {p.anexo_nome && (
        <p className="flex items-center gap-1 text-xs text-muted-foreground">
          <Paperclip className="h-3 w-3" />
          {p.anexo_nome}
        </p>
      )}
      {p.origem === 'mentor' && (
        <Button type="button" size="sm" variant="outline" onClick={() => onEditar(p)}>
          Editar
        </Button>
      )}
    </li>
  );

  return (
    <section aria-label="Publicações" className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <h2 className="text-lg font-semibold">Publicadas</h2>
        <div className="flex flex-wrap gap-3">
          <label className="flex flex-col gap-1 text-xs text-muted-foreground">
            Filtrar por aluno
            <select className={SELECT_CLASSE} value={alunoEmail} onChange={(e) => setAlunoEmail(e.target.value)}>
              <option value="">Todos os alunos</option>
              {turma.map((a) => (
                <option key={a.email} value={a.email}>
                  {a.nome?.trim() || a.email}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1 text-xs text-muted-foreground">
            Filtrar por tag
            <select className={SELECT_CLASSE} value={tag} onChange={(e) => setTag(e.target.value)}>
              <option value="">Todas as tags</option>
              {tags.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </label>
        </div>
      </div>

      {isLoading && <p className="text-sm text-muted-foreground">Carregando publicações…</p>}
      {isError && (
        <div className="space-y-2">
          <p className="text-sm text-destructive">
            Não foi possível carregar as publicações. Tente de novo em instantes.
          </p>
          <Button type="button" size="sm" variant="outline" onClick={() => void refetch()}>
            Tentar de novo
          </Button>
        </div>
      )}
      {!isLoading && !isError && posts.length === 0 && (
        <p className="text-sm text-muted-foreground">
          {filtrando
            ? 'Nenhuma publicação para esse filtro.'
            : 'Você ainda não publicou nada no mural. Use o formulário acima para começar.'}
        </p>
      )}
      {publicados.length > 0 && <ul className="space-y-3">{publicados.map(cartao)}</ul>}
      {rascunhos.length > 0 && (
        <div className="space-y-3">
          <h3 className="text-sm font-semibold text-muted-foreground">Rascunhos</h3>
          <ul className="space-y-3">{rascunhos.map(cartao)}</ul>
        </div>
      )}
    </section>
  );
};
