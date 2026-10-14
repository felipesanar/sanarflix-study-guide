import * as React from 'react';
import { useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { X } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { fetchMentorContexto } from '@/services/mentor/contexto';
import { fetchTurma, type AlunoTurma, type Segmento } from '@/services/mentor/turma';
import { DrawerAlunoMentor } from '@/features/mentor/components/DrawerAlunoMentor';
import { EstadoErro } from '@/features/mentor/components/turma/EstadoErro';
import {
  SEGMENTOS,
  SEGMENTO_CLASSE,
  SEGMENTO_ETIQUETA,
  SEGMENTO_PLURAL,
  ehSegmento,
  formatDataCalendario,
  formatSemestre,
  formatUltimoAcesso,
  nomeOuEmail,
} from '@/features/mentor/components/turma/util';

type FiltroSegmento = Segmento | 'todos';

function normalizar(texto: string): string {
  return texto.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
}

/** Mais tempo sem acesso primeiro; "sem dado" (nulo) depois, por nome. */
function comparar(a: AlunoTurma, b: AlunoTurma): number {
  const da = a.dias_sem_atividade ?? -1;
  const db = b.dias_sem_atividade ?? -1;
  if (da !== db) return db - da;
  return nomeOuEmail(a).localeCompare(nomeOuEmail(b), 'pt-BR');
}

const CardResumo: React.FC<{ titulo: string; children: React.ReactNode }> = ({ titulo, children }) => (
  <div className="space-y-1 rounded-xl border bg-card p-4">
    <p className="text-sm text-muted-foreground">{titulo}</p>
    {children}
  </div>
);

/** Minha Turma (b2c) / Visão Geral (b2b) — tela 02b. */
const MinhaTurma: React.FC = () => {
  const [params, setParams] = useSearchParams();
  const contexto = useQuery({ queryKey: ['mentor', 'contexto'], queryFn: fetchMentorContexto });
  const turma = useQuery({ queryKey: ['mentor', 'turma'], queryFn: fetchTurma });
  const titulo = contexto.data?.mentor?.tipo === 'b2b' ? 'Visão Geral' : 'Minha Turma';

  const filtroParam = params.get('filtro');
  const filtroDaHome: Segmento | null = ehSegmento(filtroParam) ? filtroParam : null;
  // Escolha feita nesta tela; enquanto indefinida vale o filtro que veio da home.
  const [escolhido, setEscolhido] = React.useState<FiltroSegmento | undefined>(undefined);
  const filtro: FiltroSegmento = escolhido ?? filtroDaHome ?? 'todos';
  const [busca, setBusca] = React.useState('');
  const emailAberto = params.get('aluno');

  const atualizarParams = (alterar: (p: URLSearchParams) => void) =>
    setParams(
      (atual) => {
        const proximo = new URLSearchParams(atual);
        alterar(proximo);
        return proximo;
      },
      { replace: true },
    );

  const escolherSegmento = (valor: FiltroSegmento) => {
    setEscolhido(valor);
    if (params.has('filtro')) atualizarParams((p) => p.delete('filtro'));
  };

  const removerChip = () => {
    setEscolhido('todos');
    atualizarParams((p) => p.delete('filtro'));
  };

  const abrirAluno = (email: string) => atualizarParams((p) => p.set('aluno', email));
  const fecharAluno = () => atualizarParams((p) => p.delete('aluno'));

  const alunos = React.useMemo(() => turma.data ?? [], [turma.data]);
  const contagem = React.useMemo(() => {
    const c: Record<Segmento, number> = { ativo: 0, esfriando: 0, sumido: 0, sem_dado: 0 };
    for (const a of alunos) c[a.segmento] += 1;
    return c;
  }, [alunos]);

  const visiveis = React.useMemo(() => {
    const termo = normalizar(busca);
    return alunos
      .filter((a) => filtro === 'todos' || a.segmento === filtro)
      .filter((a) => !termo || normalizar(`${a.nome ?? ''} ${a.email}`).includes(termo))
      .sort(comparar);
  }, [alunos, filtro, busca]);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">{titulo}</h1>

      <div className="space-y-1">
        <select
          disabled
          aria-label="Filtro de simulados"
          className="h-9 rounded-md border bg-muted px-3 text-sm text-muted-foreground"
          defaultValue=""
        >
          <option value="">Simulados: nenhum disponível</option>
        </select>
        <p className="text-sm text-muted-foreground">
          Os simulados ainda não chegam aqui. Enquanto isso, a turma mostra cadastro e engajamento.
        </p>
      </div>

      {turma.isLoading && <p className="text-sm text-muted-foreground">Carregando a turma…</p>}
      {turma.isError && (
        <EstadoErro mensagem="Não foi possível carregar a turma." onRetry={() => void turma.refetch()} />
      )}

      {turma.data && alunos.length === 0 && (
        <p className="text-muted-foreground">Sua turma ainda não tem alunos vinculados.</p>
      )}

      {turma.data && alunos.length > 0 && (
        <>
          <div className="grid gap-4 md:grid-cols-3">
            <CardResumo titulo="Ativos na semana">
              <p className="text-3xl font-semibold">{contagem.ativo}</p>
              <p className="text-xs text-muted-foreground">de {alunos.length}</p>
            </CardResumo>
            <CardResumo titulo="Sem acesso há 10+ dias">
              <p className="text-3xl font-semibold">{contagem.sumido}</p>
              <button
                type="button"
                className="text-sm text-primary underline-offset-2 hover:underline"
                onClick={() => escolherSegmento('sumido')}
              >
                Ver quem sumiu
              </button>
            </CardResumo>
            <CardResumo titulo="Possível aprovação">
              <p className="text-3xl font-semibold">—</p>
              <p className="text-xs text-muted-foreground">Precisa de simulados e de Metas.</p>
            </CardResumo>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {(['todos', ...SEGMENTOS] as FiltroSegmento[]).map((seg) => {
              const ativo = filtro === seg;
              const rotulo = seg === 'todos' ? 'Todos' : SEGMENTO_PLURAL[seg];
              const qtd = seg === 'todos' ? alunos.length : contagem[seg];
              return (
                <button
                  key={seg}
                  type="button"
                  aria-pressed={ativo}
                  onClick={() => escolherSegmento(seg)}
                  className={cn(
                    'rounded-full px-3 py-1 text-sm',
                    ativo ? 'bg-foreground text-background' : 'bg-muted text-muted-foreground hover:text-foreground',
                  )}
                >
                  {rotulo} <span className="opacity-70">{qtd}</span>
                </button>
              );
            })}
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <Input
              type="search"
              role="searchbox"
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              placeholder="Buscar por nome ou e-mail"
              aria-label="Buscar aluno"
              className="max-w-xs"
            />
            {filtroDaHome && escolhido === undefined && (
              <span className="inline-flex items-center gap-1 rounded-full bg-muted px-3 py-1 text-xs">
                Filtro: {SEGMENTO_PLURAL[filtroDaHome]} (vindo da home)
                <button
                  type="button"
                  onClick={removerChip}
                  aria-label={`Remover filtro ${SEGMENTO_PLURAL[filtroDaHome]}`}
                  className="rounded-full p-0.5 hover:bg-background"
                >
                  <X className="h-3 w-3" aria-hidden="true" />
                </button>
              </span>
            )}
          </div>

          {visiveis.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhum aluno encontrado com esses filtros.</p>
          ) : (
            <div className="overflow-x-auto rounded-xl border">
              <table className="w-full text-left text-sm">
                <thead className="border-b bg-muted/50 text-xs text-muted-foreground">
                  <tr>
                    <th className="px-3 py-2 font-medium">Aluno</th>
                    <th className="px-3 py-2 font-medium">Semestre · acesso até</th>
                    <th className="px-3 py-2 font-medium">Meta</th>
                    <th className="px-3 py-2 font-medium">Acerto</th>
                    <th className="px-3 py-2 font-medium">Último acesso</th>
                  </tr>
                </thead>
                <tbody>
                  {visiveis.map((a) => (
                    <tr
                      key={a.email}
                      onClick={() => abrirAluno(a.email)}
                      className="cursor-pointer border-b last:border-0 hover:bg-muted/40 focus-visible:bg-muted/40 focus-visible:outline-none"
                    >
                      <td className="px-3 py-2">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            abrirAluno(a.email);
                          }}
                          className="text-left font-medium hover:underline focus-visible:underline focus-visible:outline-none"
                        >
                          {nomeOuEmail(a)}
                        </button>
                        <span
                          className={cn(
                            'rounded-full px-2 py-0.5 text-[11px] font-medium',
                            SEGMENTO_CLASSE[a.segmento],
                          )}
                        >
                          {SEGMENTO_ETIQUETA[a.segmento]}
                        </span>
                      </td>
                      <td className="px-3 py-2 text-muted-foreground">
                        {formatSemestre(a.semestre)} · {formatDataCalendario(a.acesso_ate)}
                      </td>
                      <td className="px-3 py-2 text-muted-foreground">Aguardando Metas</td>
                      <td className="px-3 py-2 text-muted-foreground">Sem dado</td>
                      <td className="px-3 py-2">{formatUltimoAcesso(a.dias_sem_atividade)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}

      <DrawerAlunoMentor
        email={emailAberto}
        open={!!emailAberto}
        onOpenChange={(aberto) => {
          if (!aberto) fecharAluno();
        }}
      />
    </div>
  );
};

export default MinhaTurma;
