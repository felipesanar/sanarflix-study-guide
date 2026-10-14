import * as React from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Paperclip, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { listarTags, salvarPost, type PostMural } from '@/services/mentor/mural';
import type { AlunoTurma } from '@/services/mentor/turma';
import { PreviewAluno } from './PreviewAluno';
import { SeletorAlunos } from './SeletorAlunos';
import {
  LIMITE_ANEXO_BYTES,
  LIMITE_ANEXO_MENSAGEM,
  TAGS_SUGERIDAS,
  formularioDoPost,
  formularioVazio,
  nomeSeguro,
  pluralAlunos,
  validarFormulario,
  type FormularioMural,
} from './muralUtils';

interface Props {
  turma: AlunoTurma[];
  /** user_id do mentor — prefixo do path do anexo no Storage. */
  mentorId: string | null;
  /** Post em edição; nulo = nova publicação. */
  post?: PostMural | null;
  /** E-mails pré-selecionados (`?para=`) numa nova publicação. */
  destinatariosIniciais?: string[];
  onConcluido: () => void;
  onCancelarEdicao?: () => void;
}

function estadoInicial(post: PostMural | null | undefined, iniciais: string[]): FormularioMural {
  if (post) return formularioDoPost(post);
  if (iniciais.length > 0) return { ...formularioVazio(), publico: 'selecionados', destinatarios: iniciais };
  return formularioVazio();
}

export const NovaPublicacao: React.FC<Props> = ({
  turma,
  mentorId,
  post = null,
  destinatariosIniciais = [],
  onConcluido,
  onCancelarEdicao,
}) => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [form, setForm] = React.useState<FormularioMural>(() => estadoInicial(post, destinatariosIniciais));
  const [arquivo, setArquivo] = React.useState<File | null>(null);
  const [anexoExistente, setAnexoExistente] = React.useState<{ path: string; nome: string } | null>(
    post?.anexo_path ? { path: post.anexo_path, nome: post.anexo_nome ?? 'anexo' } : null,
  );
  const [erroAnexo, setErroAnexo] = React.useState<string | null>(null);
  const [registrar, setRegistrar] = React.useState(!(post && post.status === 'publicado'));
  const inputArquivo = React.useRef<HTMLInputElement>(null);

  const { data: tagsSalvas = [] } = useQuery({ queryKey: ['mentor', 'mural', 'tags'], queryFn: listarTags });
  const sugestoes = React.useMemo(
    () => Array.from(new Set([...TAGS_SUGERIDAS, ...tagsSalvas])),
    [tagsSalvas],
  );

  const set = <K extends keyof FormularioMural>(k: K, v: FormularioMural[K]) =>
    setForm((f) => ({ ...f, [k]: v }));

  const nAlunos = form.publico === 'turma' ? turma.length : form.destinatarios.length;
  const erros = validarFormulario(form);
  const anexoNome = arquivo?.name ?? anexoExistente?.nome ?? null;

  const escolherArquivo = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0] ?? null;
    if (!f) return;
    if (f.size > LIMITE_ANEXO_BYTES) {
      setErroAnexo(LIMITE_ANEXO_MENSAGEM);
      setArquivo(null);
      e.target.value = '';
      return;
    }
    setErroAnexo(null);
    setArquivo(f);
  };

  const removerAnexo = () => {
    setArquivo(null);
    setAnexoExistente(null);
    setErroAnexo(null);
    if (inputArquivo.current) inputArquivo.current.value = '';
  };

  const mutation = useMutation({
    mutationFn: async (publicar: boolean) => {
      let anexoPath: string | null = anexoExistente?.path ?? null;
      let nome: string | null = anexoExistente?.nome ?? null;
      if (arquivo) {
        if (!mentorId) throw new Error('Não foi possível identificar o mentor para enviar o anexo.');
        const path = `${mentorId}/${crypto.randomUUID()}-${nomeSeguro(arquivo.name)}`;
        const { error } = await supabase.storage.from('mural-anexos').upload(path, arquivo);
        if (error) throw new Error(error.message || 'Falha ao enviar o anexo.');
        anexoPath = path;
        nome = arquivo.name;
      }
      const resultado = await salvarPost({
        id: post?.id ?? null,
        tag: form.tag.trim(),
        titulo: form.titulo.trim(),
        mensagem: form.mensagem.trim(),
        linkTitulo: form.linkUrl.trim() ? form.linkTitulo.trim() : null,
        linkUrl: form.linkUrl.trim() || null,
        anexoPath,
        anexoNome: nome,
        publico: form.publico,
        destinatarios: form.publico === 'selecionados' ? form.destinatarios : [],
        publicar,
        registrarIntervencao: publicar && registrar,
      });
      return { resultado, publicar };
    },
    onSuccess: ({ publicar }) => {
      void queryClient.invalidateQueries({ queryKey: ['mentor', 'mural'] });
      void queryClient.invalidateQueries({ queryKey: ['mentor', 'intervencoes'] });
      toast({ title: publicar ? 'Publicação enviada.' : 'Rascunho salvo.' });
      onConcluido();
    },
    onError: (err: Error) => {
      toast({ title: 'Não foi possível salvar', description: err.message, variant: 'destructive' });
    },
  });

  const ocupado = mutation.isPending;
  const bloqueado = erros.length > 0 || ocupado;

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
      <form
        className="space-y-4"
        aria-label={post ? 'Editar publicação' : 'Nova publicação'}
        onSubmit={(e) => {
          e.preventDefault();
          if (!bloqueado) mutation.mutate(true);
        }}
      >
        <h2 className="text-lg font-semibold">{post ? 'Editar publicação' : 'Nova publicação'}</h2>

        <div className="space-y-2">
          <Label htmlFor="mural-tag">Tag</Label>
          <Input
            id="mural-tag"
            value={form.tag}
            onChange={(e) => set('tag', e.target.value)}
            placeholder="Escolha uma sugestão ou escreva a sua"
            maxLength={40}
          />
          <div className="flex flex-wrap gap-2" role="group" aria-label="Sugestões de tag">
            {sugestoes.map((t) => (
              <Button
                key={t}
                type="button"
                size="sm"
                variant={form.tag.trim() === t ? 'default' : 'outline'}
                onClick={() => set('tag', t)}
              >
                {t}
              </Button>
            ))}
          </div>
        </div>

        <fieldset className="space-y-2">
          <legend className="text-sm font-medium">Para quem</legend>
          <div className="flex gap-4">
            <label className="flex items-center gap-2 text-sm">
              <input
                type="radio"
                name="mural-publico"
                checked={form.publico === 'turma'}
                onChange={() => set('publico', 'turma')}
              />
              Toda a turma
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="radio"
                name="mural-publico"
                checked={form.publico === 'selecionados'}
                onChange={() => set('publico', 'selecionados')}
              />
              Selecionados
            </label>
          </div>
          {form.publico === 'selecionados' && (
            <SeletorAlunos
              turma={turma}
              selecionados={form.destinatarios}
              onChange={(emails) => set('destinatarios', emails)}
            />
          )}
        </fieldset>

        <div className="space-y-2">
          <Label htmlFor="mural-titulo">Título</Label>
          <Input id="mural-titulo" value={form.titulo} onChange={(e) => set('titulo', e.target.value)} />
        </div>

        <div className="space-y-2">
          <Label htmlFor="mural-mensagem">Mensagem</Label>
          <Textarea
            id="mural-mensagem"
            rows={5}
            value={form.mensagem}
            onChange={(e) => set('mensagem', e.target.value)}
          />
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="mural-link-url">Link (opcional)</Label>
            <Input
              id="mural-link-url"
              type="url"
              inputMode="url"
              placeholder="https://"
              value={form.linkUrl}
              onChange={(e) => set('linkUrl', e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="mural-link-titulo">Título do link</Label>
            <Input
              id="mural-link-titulo"
              value={form.linkTitulo}
              onChange={(e) => set('linkTitulo', e.target.value)}
              aria-required={form.linkUrl.trim() ? true : undefined}
            />
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="mural-anexo">Anexo (até 10 MB)</Label>
          <Input id="mural-anexo" type="file" ref={inputArquivo} onChange={escolherArquivo} />
          {anexoNome && (
            <p className="flex items-center gap-2 text-sm text-muted-foreground">
              <Paperclip className="h-4 w-4" />
              {anexoNome}
              <button type="button" aria-label="Remover anexo" onClick={removerAnexo}>
                <X className="h-4 w-4" />
              </button>
            </p>
          )}
          {erroAnexo && (
            <p role="alert" className="text-sm text-destructive">
              {erroAnexo}
            </p>
          )}
        </div>

        <div className="flex items-center gap-2">
          <Checkbox
            id="mural-registrar"
            checked={registrar}
            onCheckedChange={(v) => setRegistrar(v === true)}
          />
          <Label htmlFor="mural-registrar" className="font-normal">
            Registrar como intervenção (Mensagem · {pluralAlunos(nAlunos)})
          </Label>
        </div>

        {erros.length > 0 && (
          <ul className="list-disc space-y-0.5 pl-5 text-sm text-muted-foreground" aria-label="Pendências">
            {erros.map((e) => (
              <li key={e}>{e}</li>
            ))}
          </ul>
        )}

        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="outline" disabled={bloqueado} onClick={() => mutation.mutate(false)}>
            Salvar rascunho
          </Button>
          <Button type="submit" disabled={bloqueado}>
            Publicar para {pluralAlunos(nAlunos)}
          </Button>
          {post && onCancelarEdicao && (
            <Button type="button" variant="ghost" onClick={onCancelarEdicao}>
              Cancelar edição
            </Button>
          )}
        </div>
      </form>

      <PreviewAluno form={form} anexoNome={anexoNome} />
    </div>
  );
};
