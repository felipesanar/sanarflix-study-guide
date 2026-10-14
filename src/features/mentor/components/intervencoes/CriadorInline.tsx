import * as React from 'react';
import { X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { AlvoIntervencao, CriarIntervencaoInput, TipoIntervencao } from '@/services/mentor/intervencoes';
import type { AlunoTurma } from '@/services/mentor/turma';
import { TIPOS, rotuloTipo } from './util';

interface Props {
  turma: AlunoTurma[];
  /** E-mails pré-preenchidos (`?aluno=` / `?alunos=`): 1 → "Um aluno"; 2+ → "Alunos selecionados" (grupo). */
  alunosIniciais?: string[];
  enviando?: boolean;
  onCriar: (input: CriarIntervencaoInput) => void;
  onCancelar: () => void;
}

const SEM_ALUNOS: string[] = [];

function alvoInicial(n: number): AlvoIntervencao | '' {
  if (n > 1) return 'grupo';
  return n === 1 ? 'aluno' : '';
}

/** Criação inline no topo da coluna: tipo + aluno(s)/turma obrigatórios, descrição opcional. */
export const CriadorInline: React.FC<Props> = ({
  turma,
  alunosIniciais = SEM_ALUNOS,
  enviando,
  onCriar,
  onCancelar,
}) => {
  const [tipo, setTipo] = React.useState<TipoIntervencao | ''>('');
  const [alvo, setAlvo] = React.useState<AlvoIntervencao | ''>(() => alvoInicial(alunosIniciais.length));
  const [aluno, setAluno] = React.useState(alunosIniciais.length === 1 ? alunosIniciais[0] : '');
  const [grupo, setGrupo] = React.useState<string[]>(alunosIniciais.length > 1 ? alunosIniciais : []);
  const [descricao, setDescricao] = React.useState('');
  const [erro, setErro] = React.useState<string | null>(null);
  const temGrupoInicial = alunosIniciais.length > 1;

  const opcoes = React.useMemo(() => {
    const lista = [...turma].sort((a, b) => (a.nome ?? a.email).localeCompare(b.nome ?? b.email, 'pt-BR'));
    // E-mail vindo da URL fora da turma carregada: mantém como opção, só com o e-mail.
    for (const email of alunosIniciais) {
      if (!lista.some((a) => a.email === email)) lista.unshift({ email, nome: null } as AlunoTurma);
    }
    return lista;
  }, [turma, alunosIniciais]);

  const nomeDe = (email: string) => opcoes.find((a) => a.email === email)?.nome || email;

  const enviar = (e: React.FormEvent) => {
    e.preventDefault();
    if (!tipo) return setErro('Escolha o tipo da intervenção.');
    if (!alvo) return setErro('Escolha para quem é: aluno ou turma toda.');
    if (alvo === 'aluno' && !aluno) return setErro('Escolha o aluno.');
    if (alvo === 'grupo' && grupo.length === 0) return setErro('Selecione ao menos um aluno.');
    setErro(null);
    const alunos = alvo === 'aluno' ? [aluno] : alvo === 'grupo' ? grupo : [];
    let quem: string;
    if (alvo === 'turma') quem = 'Turma toda';
    else if (alvo === 'grupo') quem = grupo.length === 1 ? nomeDe(grupo[0]) : `${grupo.length} alunos`;
    else quem = nomeDe(aluno);
    onCriar({
      tipo,
      alvo,
      alunos,
      titulo: `${rotuloTipo(tipo)} — ${quem}`,
      nota: descricao.trim() || null,
    });
  };

  return (
    <form onSubmit={enviar} className="space-y-2 rounded-lg border bg-card p-3 text-sm" aria-label="Nova intervenção">
      <label className="block space-y-1">
        <span className="text-xs font-medium">Tipo</span>
        <select
          aria-label="Tipo"
          value={tipo}
          onChange={(e) => setTipo(e.target.value as TipoIntervencao | '')}
          className="h-8 w-full rounded border bg-background px-2"
        >
          <option value="">Escolha o tipo</option>
          {TIPOS.map((t) => (
            <option key={t.valor} value={t.valor}>
              {t.rotulo}
            </option>
          ))}
        </select>
      </label>
      <label className="block space-y-1">
        <span className="text-xs font-medium">Para quem</span>
        <select
          aria-label="Para quem"
          value={alvo}
          onChange={(e) => setAlvo(e.target.value as AlvoIntervencao | '')}
          className="h-8 w-full rounded border bg-background px-2"
        >
          <option value="">Aluno ou turma</option>
          <option value="aluno">Um aluno</option>
          {temGrupoInicial ? <option value="grupo">Alunos selecionados</option> : null}
          <option value="turma">Turma toda</option>
        </select>
      </label>
      {alvo === 'aluno' ? (
        <label className="block space-y-1">
          <span className="text-xs font-medium">Aluno</span>
          <select
            aria-label="Aluno"
            value={aluno}
            onChange={(e) => setAluno(e.target.value)}
            className="h-8 w-full rounded border bg-background px-2"
          >
            <option value="">Escolha o aluno</option>
            {opcoes.map((a) => (
              <option key={a.email} value={a.email}>
                {a.nome ? `${a.nome} (${a.email})` : a.email}
              </option>
            ))}
          </select>
        </label>
      ) : null}
      {alvo === 'grupo' ? (
        <div className="space-y-1">
          <span className="text-xs font-medium">Alunos selecionados ({grupo.length})</span>
          {grupo.length === 0 ? (
            <p className="text-xs text-muted-foreground">Nenhum aluno selecionado.</p>
          ) : (
            <ul className="flex flex-wrap gap-2" aria-label="Alunos selecionados">
              {grupo.map((email) => (
                <li key={email} className="flex items-center gap-1 rounded-full bg-muted py-1 pl-3 pr-1 text-xs">
                  <span>{nomeDe(email)}</span>
                  <button
                    type="button"
                    aria-label={`Remover ${nomeDe(email)}`}
                    className="rounded-full p-1 hover:bg-background"
                    onClick={() => setGrupo((g) => g.filter((x) => x !== email))}
                  >
                    <X className="h-3 w-3" />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      ) : null}
      <label className="block space-y-1">
        <span className="text-xs font-medium">Descrição (opcional)</span>
        <textarea
          aria-label="Descrição"
          value={descricao}
          onChange={(e) => setDescricao(e.target.value)}
          rows={2}
          className="w-full rounded border bg-background px-2 py-1"
        />
      </label>
      {erro ? (
        <p role="alert" className="text-xs text-destructive">
          {erro}
        </p>
      ) : null}
      <div className="flex gap-2">
        <Button type="submit" size="sm" disabled={enviando}>
          Criar
        </Button>
        <Button type="button" size="sm" variant="ghost" onClick={onCancelar}>
          Cancelar
        </Button>
      </div>
    </form>
  );
};
