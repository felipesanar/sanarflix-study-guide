import * as React from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { salvarSessao, type Sessao, type TipoSessao } from '@/services/mentor/sessoes';
import type { AlunoTurma } from '@/services/mentor/turma';
import { campoParaIso, ehLinkHttps, isoParaCampo } from './dataHora';

interface Props {
  alunos: AlunoTurma[];
  /** Quando presente, edita esta sessão; senão cria uma nova. */
  sessao?: Sessao;
  onFechar?: () => void;
}

const selectCls =
  'h-10 w-full rounded-md border border-input bg-background px-3 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring';

/** Linha de cadastro/edição de sessão. */
export const SessaoForm: React.FC<Props> = ({ alunos, sessao, onFechar }) => {
  const qc = useQueryClient();
  const [tipo, setTipo] = React.useState<TipoSessao>(sessao?.tipo ?? 'coletiva');
  const [tema, setTema] = React.useState(sessao?.tema ?? sessao?.titulo ?? '');
  const [inicio, setInicio] = React.useState(sessao ? isoParaCampo(sessao.inicio) : '');
  const [link, setLink] = React.useState(sessao?.meet_link ?? '');
  const [aluno, setAluno] = React.useState(sessao?.aluno_email ?? '');
  const [erro, setErro] = React.useState<string | null>(null);

  const salvar = useMutation({
    mutationFn: () =>
      salvarSessao({
        id: sessao?.id ?? null,
        tipo,
        titulo: tema.trim(),
        tema: tema.trim(),
        inicio: campoParaIso(inicio),
        meetLink: link.trim() || null,
        alunoEmail: tipo === 'individual' ? aluno : null,
      }),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ['mentor', 'sessoes'] });
      await qc.invalidateQueries({ queryKey: ['mentor', 'intervencoes'] });
      if (!sessao) {
        setTema('');
        setInicio('');
        setLink('');
        setAluno('');
      }
      setErro(null);
      onFechar?.();
    },
    onError: (e: Error) => setErro(e.message),
  });

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!tema.trim()) return setErro('Dê um tema para a sessão.');
    if (!inicio) return setErro('Escolha data e horário.');
    if (tipo === 'individual' && !aluno) return setErro('Escolha o aluno da sessão individual.');
    if (link.trim() && !ehLinkHttps(link)) return setErro('O link precisa começar com https://.');
    setErro(null);
    salvar.mutate();
  };

  return (
    <form
      onSubmit={submit}
      aria-label={sessao ? 'Editar sessão' : 'Nova sessão'}
      className="rounded-lg border bg-muted/30 p-4 space-y-3"
    >
      <h2 className="text-base font-semibold">{sessao ? 'Editar sessão' : 'Nova sessão'}</h2>
      <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-5">
        <label className="space-y-1 text-sm">
          <span>Tipo</span>
          <select
            aria-label="Tipo da sessão"
            className={selectCls}
            value={tipo}
            disabled={!!sessao}
            onChange={(e) => setTipo(e.target.value as TipoSessao)}
          >
            <option value="coletiva">Coletiva</option>
            <option value="individual">Individual</option>
          </select>
        </label>
        <label className="space-y-1 text-sm">
          <span>Data e horário</span>
          <Input type="datetime-local" aria-label="Data e horário" value={inicio} onChange={(e) => setInicio(e.target.value)} />
        </label>
        <label className="space-y-1 text-sm">
          <span>Tema</span>
          <Input aria-label="Tema" value={tema} onChange={(e) => setTema(e.target.value)} />
        </label>
        {tipo === 'individual' && (
          <label className="space-y-1 text-sm">
            <span>Aluno</span>
            <select
              aria-label="Aluno"
              className={selectCls}
              value={aluno}
              disabled={!!sessao}
              onChange={(e) => setAluno(e.target.value)}
            >
              <option value="">Escolha um aluno</option>
              {alunos.map((a) => (
                <option key={a.email} value={a.email}>
                  {a.nome ?? a.email}
                </option>
              ))}
            </select>
          </label>
        )}
        <label className="space-y-1 text-sm">
          <span>Link da sessão (Meet)</span>
          <Input
            type="url"
            aria-label="Link da sessão"
            placeholder="https://meet.google.com/..."
            value={link}
            onChange={(e) => setLink(e.target.value)}
          />
        </label>
      </div>
      {erro && (
        <p role="alert" className="text-sm text-destructive">
          {erro}
        </p>
      )}
      <div className="flex gap-2">
        <Button type="submit" disabled={salvar.isPending}>
          {salvar.isPending ? 'Salvando...' : sessao ? 'Salvar alterações' : 'Criar sessão'}
        </Button>
        {sessao && (
          <Button type="button" variant="ghost" onClick={onFechar}>
            Cancelar
          </Button>
        )}
      </div>
    </form>
  );
};
