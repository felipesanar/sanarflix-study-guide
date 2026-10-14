import * as React from 'react';
import { Button } from '@/components/ui/button';
import type { AlvoIntervencao, CriarIntervencaoInput, TipoIntervencao } from '@/services/mentor/intervencoes';
import type { AlunoTurma } from '@/services/mentor/turma';
import { TIPOS, rotuloTipo } from './util';

interface Props {
  turma: AlunoTurma[];
  alunoInicial?: string | null;
  enviando?: boolean;
  onCriar: (input: CriarIntervencaoInput) => void;
  onCancelar: () => void;
}

/** Criação inline no topo da coluna: tipo + aluno/turma obrigatórios, descrição opcional. */
export const CriadorInline: React.FC<Props> = ({ turma, alunoInicial, enviando, onCriar, onCancelar }) => {
  const [tipo, setTipo] = React.useState<TipoIntervencao | ''>('');
  const [alvo, setAlvo] = React.useState<AlvoIntervencao | ''>(alunoInicial ? 'aluno' : '');
  const [aluno, setAluno] = React.useState(alunoInicial ?? '');
  const [descricao, setDescricao] = React.useState('');
  const [erro, setErro] = React.useState<string | null>(null);

  const opcoes = React.useMemo(() => {
    const lista = [...turma].sort((a, b) => (a.nome ?? a.email).localeCompare(b.nome ?? b.email, 'pt-BR'));
    if (alunoInicial && !lista.some((a) => a.email === alunoInicial)) {
      lista.unshift({ email: alunoInicial, nome: null } as AlunoTurma);
    }
    return lista;
  }, [turma, alunoInicial]);

  const enviar = (e: React.FormEvent) => {
    e.preventDefault();
    if (!tipo) return setErro('Escolha o tipo da intervenção.');
    if (!alvo) return setErro('Escolha para quem é: aluno ou turma toda.');
    if (alvo === 'aluno' && !aluno) return setErro('Escolha o aluno.');
    setErro(null);
    const quem = alvo === 'turma' ? 'Turma toda' : (opcoes.find((a) => a.email === aluno)?.nome ?? aluno);
    onCriar({
      tipo,
      alvo,
      alunos: alvo === 'aluno' ? [aluno] : [],
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
