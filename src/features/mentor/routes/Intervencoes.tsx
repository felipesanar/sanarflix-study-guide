import * as React from 'react';
import { useSearchParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import {
  atualizarIntervencao,
  criarIntervencao,
  listarIntervencoes,
  type CardIntervencao,
  type CriarIntervencaoInput,
  type StatusIntervencao,
  type TipoIntervencao,
} from '@/services/mentor/intervencoes';
import { fetchTurma } from '@/services/mentor/turma';
import { parseEmailsParam } from '@/features/mentor/lib/emailsParam';
import { DrawerIntervencao } from '@/features/mentor/components/DrawerIntervencao';
import { CardIntervencaoKanban } from '@/features/mentor/components/intervencoes/CardIntervencaoKanban';
import { CriadorInline } from '@/features/mentor/components/intervencoes/CriadorInline';
import {
  PERIODOS,
  STATUS,
  TIPOS,
  hojeSP,
  intervaloPeriodo,
  mapaAlunos,
  nomeAluno,
  type PeriodoId,
} from '@/features/mentor/components/intervencoes/util';

/** Intervenções — kanban A fazer / Em andamento / Feito (tela 07). */
const Intervencoes: React.FC = () => {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [params, setParams] = useSearchParams();

  const hoje = React.useMemo(() => hojeSP(), []);
  const [periodo, setPeriodo] = React.useState<PeriodoId>('quinzena');
  const [custom, setCustom] = React.useState({ de: '', ate: '' });
  const [busca, setBusca] = React.useState('');
  const [tipo, setTipo] = React.useState<TipoIntervencao | ''>('');
  // `?aluno=` (um) e `?alunos=` (lista separada por vírgula) pré-preenchem o criador.
  const [alunosIniciais] = React.useState(() => parseEmailsParam(params.get('aluno'), params.get('alunos')));
  const [criando, setCriando] = React.useState(params.get('novo') === '1' || params.has('alunos'));
  const [abertoId, setAbertoId] = React.useState<string | null>(null);

  const { de, ate } = intervaloPeriodo(periodo, hoje, custom);

  const lista = useQuery({
    queryKey: ['mentor', 'intervencoes', de, ate],
    queryFn: () => listarIntervencoes(de, ate),
  });
  const turmaQ = useQuery({ queryKey: ['mentor', 'turma'], queryFn: fetchTurma });
  const alunos = React.useMemo(() => mapaAlunos(turmaQ.data), [turmaQ.data]);

  const falha = (e: unknown) =>
    toast({
      title: 'Não foi possível salvar',
      description: e instanceof Error ? e.message : undefined,
      variant: 'destructive',
    });
  const invalidar = () => qc.invalidateQueries({ queryKey: ['mentor', 'intervencoes'] });

  const criar = useMutation({
    mutationFn: (input: CriarIntervencaoInput) => criarIntervencao(input),
    onSuccess: () => {
      setCriando(false);
      if (params.has('novo') || params.has('aluno') || params.has('alunos')) {
        const p = new URLSearchParams(params);
        p.delete('novo');
        p.delete('aluno');
        p.delete('alunos');
        setParams(p, { replace: true });
      }
      invalidar();
    },
    onError: falha,
  });
  const mudarStatus = useMutation({
    mutationFn: (v: { id: string; status: StatusIntervencao }) => atualizarIntervencao(v),
    onSuccess: invalidar,
    onError: falha,
  });

  const cardsFiltrados = React.useMemo(() => {
    const q = busca.trim().toLowerCase();
    return (lista.data?.cards ?? []).filter((c) => {
      if (tipo && c.tipo !== tipo) return false;
      if (!q) return true;
      const texto = [c.titulo, c.nota ?? '', ...c.alunos, ...c.alunos.map((e) => nomeAluno(e, alunos))]
        .join(' ')
        .toLowerCase();
      return texto.includes(q);
    });
  }, [lista.data, busca, tipo, alunos]);

  const aberto: CardIntervencao | null = (lista.data?.cards ?? []).find((c) => c.id === abertoId) ?? null;

  return (
    <div className="space-y-5">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold">Intervenções</h1>
          {lista.data ? (
            <p className="text-sm text-muted-foreground" data-testid="medidor">
              {lista.data.realizadas} de {lista.data.planejadas} intervenções planejadas realizadas no período
            </p>
          ) : null}
        </div>
        <Button size="sm" onClick={() => setCriando(true)}>
          Nova intervenção
        </Button>
      </header>

      <div className="flex flex-wrap items-end gap-3 text-sm">
        <label className="space-y-1">
          <span className="block text-xs font-medium">Período</span>
          <select
            aria-label="Período"
            value={periodo}
            onChange={(e) => setPeriodo(e.target.value as PeriodoId)}
            className="h-9 rounded border bg-background px-2"
          >
            {PERIODOS.map((p) => (
              <option key={p.valor} value={p.valor}>
                {p.rotulo}
              </option>
            ))}
          </select>
        </label>
        {periodo === 'custom' ? (
          <>
            <label className="space-y-1">
              <span className="block text-xs font-medium">De</span>
              <input
                type="date"
                aria-label="De"
                value={custom.de}
                max={custom.ate || undefined}
                onChange={(e) => setCustom((c) => ({ ...c, de: e.target.value }))}
                className="h-9 rounded border bg-background px-2"
              />
            </label>
            <label className="space-y-1">
              <span className="block text-xs font-medium">Até</span>
              <input
                type="date"
                aria-label="Até"
                value={custom.ate}
                min={custom.de || undefined}
                onChange={(e) => setCustom((c) => ({ ...c, ate: e.target.value }))}
                className="h-9 rounded border bg-background px-2"
              />
            </label>
          </>
        ) : null}
        <label className="space-y-1">
          <span className="block text-xs font-medium">Tipo</span>
          <select
            aria-label="Filtrar por tipo"
            value={tipo}
            onChange={(e) => setTipo(e.target.value as TipoIntervencao | '')}
            className="h-9 rounded border bg-background px-2"
          >
            <option value="">Todos os tipos</option>
            {TIPOS.map((t) => (
              <option key={t.valor} value={t.valor}>
                {t.rotulo}
              </option>
            ))}
          </select>
        </label>
        <label className="min-w-[200px] flex-1 space-y-1">
          <span className="block text-xs font-medium">Busca</span>
          <input
            type="search"
            aria-label="Buscar intervenção"
            placeholder="Buscar por título, nota ou aluno"
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            className="h-9 w-full rounded border bg-background px-2"
          />
        </label>
      </div>

      {lista.isLoading ? (
        <p role="status" className="text-sm text-muted-foreground">
          Carregando intervenções…
        </p>
      ) : lista.isError ? (
        <div role="alert" className="space-y-2 rounded border border-destructive/40 p-4 text-sm">
          <p>Não foi possível carregar as intervenções.</p>
          <Button size="sm" variant="outline" onClick={() => lista.refetch()}>
            Tentar de novo
          </Button>
        </div>
      ) : (
        <>
          {(lista.data?.cards.length ?? 0) === 0 && !criando ? (
            <p className="text-sm text-muted-foreground">
              Nenhuma intervenção neste período. Crie a primeira em “Nova intervenção”.
            </p>
          ) : null}
          <div className="grid gap-4 md:grid-cols-3">
            {STATUS.map((col) => {
              const cards = cardsFiltrados.filter((c) => c.status === col.valor);
              return (
                <section key={col.valor} aria-label={col.rotulo} className="space-y-3 rounded-lg bg-muted/40 p-3">
                  <h2 className="flex items-center justify-between text-sm font-semibold">
                    <span>{col.rotulo}</span>
                    <span className="rounded bg-background px-2 py-0.5 text-xs" data-testid={`contagem-${col.valor}`}>
                      {cards.length}
                    </span>
                  </h2>
                  {col.valor === 'a_fazer' && criando ? (
                    <CriadorInline
                      turma={turmaQ.data ?? []}
                      alunosIniciais={alunosIniciais}
                      enviando={criar.isPending}
                      onCriar={(input) => criar.mutate(input)}
                      onCancelar={() => setCriando(false)}
                    />
                  ) : null}
                  <ul className="space-y-2">
                    {cards.map((c) => (
                      <CardIntervencaoKanban
                        key={c.id}
                        card={c}
                        alunos={alunos}
                        onAbrir={(card) => setAbertoId(card.id)}
                        onMudarStatus={(card, status) => mudarStatus.mutate({ id: card.id, status })}
                        desabilitado={mudarStatus.isPending}
                      />
                    ))}
                  </ul>
                  {cards.length === 0 ? <p className="text-xs text-muted-foreground">Nada por aqui.</p> : null}
                </section>
              );
            })}
          </div>
        </>
      )}

      <DrawerIntervencao card={aberto} onFechar={() => setAbertoId(null)} />
    </div>
  );
};

export default Intervencoes;
