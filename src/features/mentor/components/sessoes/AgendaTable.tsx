import * as React from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { invalidarMentor } from '@/services/mentor/invalidar';
import { marcarSessaoFeita, type Sessao } from '@/services/mentor/sessoes';
import type { AlunoTurma } from '@/services/mentor/turma';
import { ehLinkHttps, ehLinkSeguro, formatarDataHora } from './dataHora';
import { SessaoForm } from './SessaoForm';

/** Já passou do horário de término e ainda não foi marcada como feita. */
function sessaoEncerrada(s: Sessao): boolean {
  return new Date(s.inicio).getTime() + (s.duracao_min ?? 0) * 60_000 < Date.now();
}

interface Props {
  sessoes: Sessao[];
  alunos: AlunoTurma[];
}

const LinhaSessao: React.FC<{ sessao: Sessao; alunos: AlunoTurma[]; quem: string }> = ({ sessao, alunos, quem }) => {
  const pendente = sessao.status === 'agendada' && sessaoEncerrada(sessao);
  const qc = useQueryClient();
  const [gravacao, setGravacao] = React.useState('');
  const [erro, setErro] = React.useState<string | null>(null);
  const [editando, setEditando] = React.useState(false);
  const arquivo = sessao.origem === 'arquivo_2025';
  const feita = sessao.status === 'realizada';

  const marcar = useMutation({
    mutationFn: () => marcarSessaoFeita(sessao.id, gravacao.trim() || null),
    onSuccess: async () => {
      setErro(null);
      await invalidarMentor(qc);
    },
    onError: (e: Error) => setErro(e.message),
  });

  const confirmar = () => {
    if (gravacao.trim() && !ehLinkHttps(gravacao)) {
      setErro('O link da gravação precisa começar com https://.');
      return;
    }
    setErro(null);
    marcar.mutate();
  };

  return (
    <>
      <tr className="border-b align-top">
        <td className="p-2 whitespace-nowrap">{formatarDataHora(sessao.inicio)}</td>
        <td className="p-2">
          <Badge variant="secondary">{sessao.tipo === 'coletiva' ? 'Coletiva' : 'Individual'}</Badge>
          {arquivo && (
            <Badge variant="outline" className="ml-1">
              Arquivo 2025
            </Badge>
          )}
        </td>
        <td className="p-2">{quem}</td>
        <td className="p-2">{sessao.tema ?? sessao.titulo}</td>
        <td className="p-2">
          {sessao.meet_link ? (
            ehLinkSeguro(sessao.meet_link) ? (
              <a href={sessao.meet_link.trim()} target="_blank" rel="noopener noreferrer" className="text-primary underline">
                Abrir link
              </a>
            ) : (
              <span className="text-destructive">link inválido</span>
            )
          ) : sessao.tipo === 'coletiva' && !feita ? (
            <span className="text-amber-700 font-medium">Falta link</span>
          ) : (
            <span className="text-muted-foreground">—</span>
          )}
        </td>
        <td className="p-2">
          {feita || arquivo ? (
            sessao.gravacao_url ? (
              ehLinkSeguro(sessao.gravacao_url) ? (
                <a href={sessao.gravacao_url.trim()} target="_blank" rel="noopener noreferrer" className="text-primary underline">
                  Ver gravação
                </a>
              ) : (
                <span className="text-destructive">link inválido</span>
              )
            ) : (
              <span className="text-muted-foreground">Sem gravação</span>
            )
          ) : sessao.status === 'agendada' ? (
            <div className="flex flex-col gap-1 min-w-[12rem]">
              {pendente && <span className="text-xs font-medium text-amber-700">Pendente · marque como feita</span>}
              <Input
                type="url"
                aria-label={`Link da gravação de ${sessao.tema ?? sessao.titulo}`}
                placeholder="Link da gravação (opcional)"
                value={gravacao}
                onChange={(e) => setGravacao(e.target.value)}
              />
              <Button size="sm" variant="outline" onClick={confirmar} disabled={marcar.isPending}>
                {marcar.isPending ? 'Salvando...' : 'Marcar feita'}
              </Button>
              {erro && (
                <p role="alert" className="text-xs text-destructive">
                  {erro}
                </p>
              )}
            </div>
          ) : (
            <span className="text-muted-foreground">Cancelada</span>
          )}
        </td>
        <td className="p-2">
          {!arquivo && !feita && (
            <Button size="sm" variant="ghost" onClick={() => setEditando((v) => !v)}>
              Editar
            </Button>
          )}
        </td>
      </tr>
      {editando && (
        <tr>
          <td colSpan={7} className="p-2">
            <SessaoForm alunos={alunos} sessao={sessao} onFechar={() => setEditando(false)} />
          </td>
        </tr>
      )}
    </>
  );
};

/** Tabela da agenda: data, tipo, com quem, tema, link, após a sessão, editar. */
export const AgendaTable: React.FC<Props> = ({ sessoes, alunos }) => {
  const nomePorEmail = React.useMemo(() => {
    const m = new Map<string, string>();
    alunos.forEach((a) => m.set(a.email, a.nome ?? a.email));
    return m;
  }, [alunos]);

  return (
    <div className="overflow-x-auto rounded-lg border">
      <table className="w-full text-sm">
        <thead className="bg-muted/50 text-left">
          <tr>
            <th className="p-2 font-medium">Data</th>
            <th className="p-2 font-medium">Tipo</th>
            <th className="p-2 font-medium">Com quem</th>
            <th className="p-2 font-medium">Tema</th>
            <th className="p-2 font-medium">Link</th>
            <th className="p-2 font-medium">Após a sessão</th>
            <th className="p-2 font-medium">
              <span className="sr-only">Editar</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {sessoes.map((s) => (
            <LinhaSessao
              key={s.id}
              sessao={s}
              alunos={alunos}
              quem={
                s.tipo === 'coletiva'
                  ? 'Toda a turma'
                  : s.aluno_email
                    ? (nomePorEmail.get(s.aluno_email) ?? s.aluno_email)
                    : '—'
              }
            />
          ))}
        </tbody>
      </table>
    </div>
  );
};
