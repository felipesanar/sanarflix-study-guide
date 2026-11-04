import * as React from 'react';
import { X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import type { AlunoTurma } from '@/services/mentor/turma';

interface Props {
  turma: AlunoTurma[];
  selecionados: string[];
  onChange: (emails: string[]) => void;
}

const SEMESTRES_SEPARADOS = [9, 10, 11, 12];

function rotulo(a: AlunoTurma | undefined, email: string) {
  return a?.nome?.trim() || email;
}

/** Seleção de destinatários: atalhos por segmento e semestre, busca e chips removíveis. */
export const SeletorAlunos: React.FC<Props> = ({ turma, selecionados, onChange }) => {
  const [busca, setBusca] = React.useState('');
  const porEmail = React.useMemo(() => new Map(turma.map((a) => [a.email, a])), [turma]);

  const adicionar = (emails: string[]) => {
    const set = new Set(selecionados);
    emails.forEach((e) => set.add(e));
    onChange(Array.from(set));
  };
  const remover = (email: string) => onChange(selecionados.filter((e) => e !== email));

  const atalhos: { chave: string; texto: string; emails: string[] }[] = [
    { chave: 'sumido', texto: 'Sumidos', emails: turma.filter((a) => a.segmento === 'sumido').map((a) => a.email) },
    { chave: 'esfriando', texto: 'Esfriando', emails: turma.filter((a) => a.segmento === 'esfriando').map((a) => a.email) },
    {
      chave: 'sem-1-8',
      texto: '1º a 8º semestre',
      emails: turma.filter((a) => a.semestre != null && a.semestre >= 1 && a.semestre <= 8).map((a) => a.email),
    },
    ...SEMESTRES_SEPARADOS.map((s) => ({
      chave: `sem-${s}`,
      texto: `${s}º semestre`,
      emails: turma.filter((a) => a.semestre === s).map((a) => a.email),
    })),
  ];

  const termo = busca.trim().toLowerCase();
  const resultados = termo
    ? turma
        .filter((a) => !selecionados.includes(a.email))
        .filter((a) => `${a.nome ?? ''} ${a.email}`.toLowerCase().includes(termo))
        .slice(0, 8)
    : [];

  return (
    <div className="space-y-3 rounded-md border p-3">
      <div className="flex flex-wrap gap-2" role="group" aria-label="Atalhos de seleção">
        {atalhos.map((at) => (
          <Button
            key={at.chave}
            type="button"
            variant="outline"
            size="sm"
            disabled={at.emails.length === 0}
            onClick={() => adicionar(at.emails)}
          >
            {at.texto} ({at.emails.length})
          </Button>
        ))}
      </div>

      <div className="space-y-1">
        <Input
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
          placeholder="Buscar aluno por nome ou e-mail"
          aria-label="Buscar aluno"
        />
        {resultados.length > 0 && (
          <ul className="rounded-md border bg-card">
            {resultados.map((a) => (
              <li key={a.email}>
                <button
                  type="button"
                  className="flex w-full flex-col items-start px-3 py-2 text-left text-sm hover:bg-muted"
                  onClick={() => {
                    adicionar([a.email]);
                    setBusca('');
                  }}
                >
                  <span>{rotulo(a, a.email)}</span>
                  <span className="text-xs text-muted-foreground">{a.email}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
        {termo && resultados.length === 0 && (
          <p className="text-xs text-muted-foreground">Nenhum aluno encontrado.</p>
        )}
      </div>

      {selecionados.length === 0 ? (
        <p className="text-sm text-muted-foreground">Nenhum aluno selecionado.</p>
      ) : (
        <ul className="flex flex-wrap gap-2" aria-label="Alunos selecionados">
          {selecionados.map((email) => {
            const nome = rotulo(porEmail.get(email), email);
            return (
              <li key={email} className="flex items-center gap-1 rounded-full bg-muted py-1 pl-3 pr-1 text-sm">
                <span>{nome}</span>
                <button
                  type="button"
                  aria-label={`Remover ${nome}`}
                  className="rounded-full p-1 hover:bg-background"
                  onClick={() => remover(email)}
                >
                  <X className="h-3 w-3" />
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
};
