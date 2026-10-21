/**
 * Sub-aba "Cartões-resposta": emite os cartões em PDF de um simulado para uma IES (PRD, seção 1.1).
 *
 * O time escolhe simulado, IES e alunos; o PDF é gerado aqui, no navegador, a partir dos templates de
 * `services/cartao-omr/templates`. Nenhum dado de aluno sai do Academy. Cada cartão traz o nome e a matrícula do
 * aluno impressos (a matrícula também no QR): o leitor devolve as respostas pela matrícula, a mesma da importação.
 * Aluno sem matrícula utilizável (vazia, fora do formato ou repetida) não recebe cartão: fica numa lista à parte.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Download, Loader2, Printer, Search, TriangleAlert } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import { supabase } from '@/integrations/supabase/client';
import { AdminEmpty, AdminError, AdminLoading } from '@/experiences/admin/ui';
import { Logger } from '@/utils/logger';
import {
  listarAlunosDaIes,
  listarIes,
  listarSimulados,
  type AlunoOpt,
  type IesOpt,
  type SimuladoCartao,
} from '@/features/cartoes/api';
import {
  ROTULO_EXCLUSAO,
  EmissaoCancelada,
  classificarAlunos,
  csvDaEmissao,
  csvDosExcluidos,
  formatarDataBR,
  montarSpecs,
  nomeDoArquivo,
  type MotivoExclusao,
  type ProgressoEmissao,
} from '@/features/cartoes/emitir';
import { gerarPdfSegundoPlano } from '@/features/cartoes/gerar';
import {
  chaveSemestre,
  filtrarPorSemestre,
  semestresDisponiveis,
  sufixoDeSemestres,
} from '@/features/cartoes/semestre';
import { ehIesUniatenas } from '@/features/cartoes/templates';
import type { LayoutCartao } from '@/features/cartoes/types';

const SELECT_CLASS =
  'flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background ' +
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50';

function mensagemDeErro(err: unknown): string {
  if (err instanceof Error) return err.message;
  const e = err as { message?: string; code?: string } | null;
  return e?.message ? `${e.message}${e.code ? ` (${e.code})` : ''}` : String(err);
}

function normalizar(s: string): string {
  return s.normalize('NFKD').replace(/[̀-ͯ]/g, '').toLowerCase();
}

interface AlunoExcluido {
  aluno: AlunoOpt;
  motivo: MotivoExclusao;
}

interface Resultado {
  url: string;
  arquivo: string;
  paginas: number;
  /** CSV (matrícula;nome) do que foi emitido; só no cartão pessoal. É a `--lista` do script de leitura. */
  lista: string | null;
}

export default function CartoesTab() {
  const [simulados, setSimulados] = useState<SimuladoCartao[]>([]);
  const [carregandoSimulados, setCarregandoSimulados] = useState(true);
  const [erroSimulados, setErroSimulados] = useState<string | null>(null);
  const [simuladoId, setSimuladoId] = useState('');

  const [iesLista, setIesLista] = useState<IesOpt[]>([]);
  const [iesId, setIesId] = useState('');
  const [layout, setLayout] = useState<LayoutCartao>('sfa');
  const [copias, setCopias] = useState(1);
  const [data, setData] = useState('');

  const [alunos, setAlunos] = useState<AlunoOpt[]>([]);
  const [excluidos, setExcluidos] = useState<AlunoExcluido[]>([]);
  const [carregandoAlunos, setCarregandoAlunos] = useState(false);
  const [erroAlunos, setErroAlunos] = useState<string | null>(null);
  const [selecionados, setSelecionados] = useState<Set<string>>(new Set());
  const [busca, setBusca] = useState('');
  const [semestres, setSemestres] = useState<Set<string>>(new Set()); // vazio = todos os semestres

  const [gerando, setGerando] = useState(false);
  const [progresso, setProgresso] = useState<ProgressoEmissao | null>(null);
  const [resultado, setResultado] = useState<Resultado | null>(null);
  const cancelarRef = useRef<AbortController | null>(null);

  const simulado = simulados.find((s) => s.id === simuladoId);
  const ies = iesLista.find((i) => i.id === iesId);

  // ---------------------------------------------------------------- carregamentos
  const carregarSimulados = useCallback(async () => {
    setCarregandoSimulados(true);
    setErroSimulados(null);
    try {
      setSimulados(await listarSimulados(supabase));
    } catch (err) {
      Logger.error('[Cartoes] listarSimulados:', err);
      setErroSimulados(mensagemDeErro(err));
    } finally {
      setCarregandoSimulados(false);
    }
  }, []);

  useEffect(() => {
    void carregarSimulados();
  }, [carregarSimulados]);

  useEffect(() => {
    setIesId('');
    setIesLista([]);
    setAlunos([]);
    setExcluidos([]);
    setSemestres(new Set());
    setSelecionados(new Set());
    setResultado(null);
    if (!simulado) return;
    setData(simulado.data);
    let ativo = true;
    listarIes(supabase, simulado.iesIds)
      .then((lista) => {
        if (!ativo) return;
        setIesLista(lista);
        if (lista.length === 1) setIesId(lista[0]!.id);
      })
      .catch((err) => {
        Logger.error('[Cartoes] listarIes:', err);
        if (ativo) toast.error('Erro ao carregar as IES do simulado', { description: mensagemDeErro(err) });
      });
    return () => {
      ativo = false;
    };
  }, [simulado]);

  const carregarAlunos = useCallback(async (id: string) => {
    setCarregandoAlunos(true);
    setErroAlunos(null);
    try {
      const { aptos, excluidos: fora } = classificarAlunos(await listarAlunosDaIes(supabase, id));
      setAlunos(aptos);
      setExcluidos(fora);
      setSelecionados(new Set(aptos.map((a) => a.userId))); // padrão: todos os que podem receber cartão
    } catch (err) {
      Logger.error('[Cartoes] listarAlunosDaIes:', err);
      setErroAlunos(mensagemDeErro(err));
    } finally {
      setCarregandoAlunos(false);
    }
  }, []);

  useEffect(() => {
    setResultado(null);
    setAlunos([]);
    setExcluidos([]);
    setSemestres(new Set());
    setSelecionados(new Set());
    if (!ies) return;
    const grupo = ehIesUniatenas(ies.nome);
    setLayout(grupo ? 'uniatenas' : 'sfa');
    if (!grupo) void carregarAlunos(ies.id);
  }, [ies, carregarAlunos]);

  const aoTrocarLayout = (novo: LayoutCartao) => {
    setLayout(novo);
    setResultado(null);
    if (novo === 'sfa' && ies && !alunos.length && !excluidos.length && !carregandoAlunos) void carregarAlunos(ies.id);
  };

  // ---------------------------------------------------------------- lista de alunos
  const opcoesSemestre = useMemo(
    () => semestresDisponiveis([...alunos, ...excluidos.map((e) => e.aluno)]),
    [alunos, excluidos],
  );
  const alunosNoSemestre = useMemo(() => filtrarPorSemestre(alunos, semestres), [alunos, semestres]);
  const excluidosNoSemestre = useMemo(
    () => excluidos.filter((e) => !semestres.size || semestres.has(chaveSemestre(e.aluno))),
    [excluidos, semestres],
  );
  // quem entra no PDF: marcado E dentro do filtro de semestre
  const aEmitir = useMemo(
    () => alunosNoSemestre.filter((a) => selecionados.has(a.userId)),
    [alunosNoSemestre, selecionados],
  );

  const visiveis = useMemo(() => {
    const q = normalizar(busca.trim());
    if (!q) return alunosNoSemestre;
    return alunosNoSemestre.filter((a) => normalizar(a.nome).includes(q) || (a.matricula ?? '').toLowerCase().includes(q));
  }, [alunosNoSemestre, busca]);

  /** Muda o filtro e remarca todos os alunos dos semestres escolhidos (as desmarcações manuais voltam ao padrão). */
  const alternarSemestre = (chave: string | null) => {
    const novo = new Set(chave === null ? [] : semestres);
    if (chave !== null) {
      if (novo.has(chave)) novo.delete(chave);
      else novo.add(chave);
    }
    setSemestres(novo);
    setSelecionados(new Set(filtrarPorSemestre(alunos, novo).map((a) => a.userId)));
    setResultado(null);
  };

  const todosVisiveisMarcados = visiveis.length > 0 && visiveis.every((a) => selecionados.has(a.userId));

  const alternar = (id: string) =>
    setSelecionados((atual) => {
      const novo = new Set(atual);
      if (novo.has(id)) novo.delete(id);
      else novo.add(id);
      return novo;
    });

  const marcarVisiveis = (marcar: boolean) =>
    setSelecionados((atual) => {
      const novo = new Set(atual);
      for (const a of visiveis) {
        if (marcar) novo.add(a.userId);
        else novo.delete(a.userId);
      }
      return novo;
    });

  // ---------------------------------------------------------------- geração
  const total = layout === 'sfa' ? aEmitir.length : copias;
  const podeGerar = !!simulado && !!ies && total > 0 && !gerando && (layout === 'uniatenas' || !carregandoAlunos);

  const gerar = async () => {
    if (!simulado || !ies) return;
    setGerando(true);
    setResultado(null);
    setProgresso(null);
    const controle = new AbortController();
    cancelarRef.current = controle;
    try {
      const specs = montarSpecs({
        layout,
        simuladoId: simulado.id,
        nomeSimulado: simulado.nome,
        ies: ies.nome,
        data: formatarDataBR(data),
        ...(layout === 'sfa'
          ? {
              alunos: aEmitir.map((a) => ({ matricula: a.matricula ?? '', nome: a.nome })),
            }
          : { copias }),
      });
      const pdf = await gerarPdfSegundoPlano(
        layout,
        specs,
        { onProgress: setProgresso, signal: controle.signal },
        `Cartões — ${simulado.nome}`,
      );
      const url = URL.createObjectURL(new Blob([pdf], { type: 'application/pdf' }));
      const arquivo = nomeDoArquivo(ies.nome, simulado.nome, layout === 'sfa' ? sufixoDeSemestres(semestres) : '');
      const lista =
        layout === 'sfa'
          ? csvDaEmissao(specs.map((s) => ({ nome: s.alunoNome ?? '', matricula: s.matricula ?? '' })))
          : null;
      setResultado({ url, arquivo, paginas: specs.length, lista });
      baixar(url, arquivo);
      toast.success('Cartões gerados', { description: `${specs.length} cartão(ões) em ${arquivo}` });
    } catch (err) {
      if (err instanceof EmissaoCancelada) {
        toast.info('Geração cancelada');
      } else {
        Logger.error('[Cartoes] gerar:', err);
        toast.error('Não foi possível gerar os cartões', { description: mensagemDeErro(err) });
      }
    } finally {
      cancelarRef.current = null;
      setGerando(false);
    }
  };

  useEffect(() => () => {
    if (resultado) URL.revokeObjectURL(resultado.url);
  }, [resultado]);

  const baixarCsvExcluidos = () => {
    const csv = csvDosExcluidos(excluidosNoSemestre.map((e) => ({ aluno: e.aluno, motivo: e.motivo })));
    baixarTexto(csv, nomeDoArquivo(ies?.nome ?? '', 'alunos sem cartao', sufixoDeSemestres(semestres)).replace(/^cartoes_/, '').replace(/\.pdf$/, '.csv'));
  };

  // ---------------------------------------------------------------- tela
  if (erroSimulados) {
    return <AdminError message={erroSimulados} title="Falha ao carregar simulados" onRetry={carregarSimulados} />;
  }

  return (
    <div className="space-y-6">
      <div className="space-y-4 rounded-xl border bg-card p-4">
        <p className="text-sm text-muted-foreground">
          Gera os cartões-resposta em PDF para imprimir. Cada cartão traz o nome e a matrícula do aluno (a matrícula
          também vai num QR), para o script de leitura devolver as respostas já identificadas e prontas para a
          importação. O PDF é montado neste navegador: nenhum dado dos alunos é enviado para fora.
        </p>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <div className="space-y-1.5">
            <Label htmlFor="cartoes-simulado">Simulado</Label>
            <select
              id="cartoes-simulado"
              className={SELECT_CLASS}
              value={simuladoId}
              disabled={carregandoSimulados || gerando}
              onChange={(e) => setSimuladoId(e.target.value)}
            >
              <option value="">{carregandoSimulados ? 'Carregando…' : 'Selecione um simulado'}</option>
              {simulados.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.nome}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="cartoes-ies">IES</Label>
            <select
              id="cartoes-ies"
              className={SELECT_CLASS}
              value={iesId}
              disabled={!simulado || gerando}
              onChange={(e) => setIesId(e.target.value)}
            >
              <option value="">
                {!simulado ? 'Escolha o simulado primeiro' : iesLista.length ? 'Selecione a IES' : 'Simulado sem IES'}
              </option>
              {iesLista.map((i) => (
                <option key={i.id} value={i.id}>
                  {i.nome}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="cartoes-data">Data da prova (no cabeçalho)</Label>
            <Input id="cartoes-data" type="date" value={data} disabled={gerando} onChange={(e) => setData(e.target.value)} />
          </div>
        </div>

        {ies && (
          <fieldset className="space-y-2" disabled={gerando}>
            <legend className="text-sm font-medium">Modelo de cartão</legend>
            <div className="flex flex-col gap-2 sm:flex-row sm:gap-6">
              <label className="flex items-center gap-2 text-sm">
                <input type="radio" name="cartoes-layout" checked={layout === 'sfa'} onChange={() => aoTrocarLayout('sfa')} />
                Pessoal: um cartão por aluno, com nome e matrícula impressos
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="radio"
                  name="cartoes-layout"
                  checked={layout === 'uniatenas'}
                  onChange={() => aoTrocarLayout('uniatenas')}
                />
                UniAtenas: cartão único, o aluno marca a matrícula
              </label>
            </div>
            {ehIesUniatenas(ies.nome) && (
              <p className="text-xs text-muted-foreground">
                Esta IES está na lista do grupo UniAtenas, então o modelo único foi pré-selecionado.
              </p>
            )}
          </fieldset>
        )}
      </div>

      {ies && layout === 'uniatenas' && (
        <div className="space-y-3 rounded-xl border bg-card p-4">
          <div className="max-w-xs space-y-1.5">
            <Label htmlFor="cartoes-copias">Quantidade de cartões no PDF</Label>
            <Input
              id="cartoes-copias"
              type="number"
              min={1}
              max={2000}
              value={copias}
              disabled={gerando}
              onChange={(e) => setCopias(Math.max(1, Math.min(2000, Number(e.target.value) || 1)))}
            />
          </div>
          <p className="text-xs text-muted-foreground">
            O cartão UniAtenas não tem nome nem número de série: a IES pode imprimir ou fotocopiar o mesmo PDF para
            todos os alunos.
          </p>
        </div>
      )}

      {ies && layout === 'sfa' && (
        <div className="space-y-3">
          {carregandoAlunos ? (
            <AdminLoading rows={6} />
          ) : erroAlunos ? (
            <AdminError message={erroAlunos} title="Falha ao carregar os alunos" onRetry={() => void carregarAlunos(ies.id)} />
          ) : !alunos.length && !excluidos.length ? (
            <AdminEmpty title="Nenhum aluno nesta IES" description="Só alunos (sem papel de equipe) aparecem aqui." />
          ) : !alunos.length ? (
            <AdminEmpty
              title="Nenhum aluno com matrícula utilizável nesta IES"
              description="Corrija o cadastro dos alunos listados abaixo para poder emitir os cartões."
            />
          ) : (
            <div className="space-y-3 rounded-xl border bg-card p-4">
              {opcoesSemestre.length > 1 && (
                <div className="space-y-1.5" role="group" aria-label="Filtrar por semestre">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-sm font-medium">Semestre</span>
                    {opcoesSemestre.map((o) => (
                      <Button
                        key={o.chave}
                        type="button"
                        size="sm"
                        variant={semestres.has(o.chave) ? 'default' : 'outline'}
                        aria-pressed={semestres.has(o.chave)}
                        disabled={gerando}
                        onClick={() => alternarSemestre(o.chave)}
                      >
                        {`${o.rotulo} (${o.qtd})`}
                      </Button>
                    ))}
                    {semestres.size > 0 && (
                      <Button type="button" size="sm" variant="ghost" disabled={gerando} onClick={() => alternarSemestre(null)}>
                        Limpar filtro
                      </Button>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {semestres.size
                      ? 'Só os semestres escolhidos entram na lista e no PDF. Trocar o filtro remarca todos eles.'
                      : 'Nenhum semestre escolhido: todos entram. Escolha um ou mais para emitir só para eles.'}
                  </p>
                </div>
              )}
              <div className="flex flex-wrap items-center gap-3">
                <div className="relative w-full sm:w-80">
                  <Search className="pointer-events-none absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    aria-label="Buscar aluno"
                    placeholder="Buscar por nome ou matrícula"
                    className="pl-8"
                    value={busca}
                    onChange={(e) => setBusca(e.target.value)}
                  />
                </div>
                <label className="flex items-center gap-2 text-sm">
                  <Checkbox
                    checked={todosVisiveisMarcados}
                    onCheckedChange={(v) => marcarVisiveis(v === true)}
                    aria-label="Marcar todos os alunos listados"
                    disabled={!visiveis.length || gerando}
                  />
                  {busca ? 'Marcar os listados' : 'Marcar todos'}
                </label>
                <span className="ml-auto text-sm text-muted-foreground" aria-live="polite">
                  {`${aEmitir.length} de ${alunosNoSemestre.length} selecionados`}
                </span>
              </div>
              <ul className="max-h-96 divide-y overflow-auto rounded-lg border" aria-label="Alunos da IES">
                {visiveis.map((a) => (
                  <li key={a.userId}>
                    <label className="flex cursor-pointer items-center gap-3 px-3 py-2 text-sm hover:bg-muted/50">
                      <Checkbox
                        checked={selecionados.has(a.userId)}
                        onCheckedChange={() => alternar(a.userId)}
                        disabled={gerando}
                        aria-label={`Cartão para ${a.nome}`}
                      />
                      <span className="flex-1 truncate">{a.nome}</span>
                      <span className="text-xs text-muted-foreground">{a.semestre == null ? '' : `${a.semestre}º sem.`}</span>
                      <span className="font-mono text-xs text-muted-foreground">{a.matricula}</span>
                    </label>
                  </li>
                ))}
                {!visiveis.length && <li className="px-3 py-6 text-center text-sm text-muted-foreground">Nenhum aluno encontrado.</li>}
              </ul>
            </div>
          )}
        </div>
      )}

      {ies && layout === 'sfa' && !carregandoAlunos && excluidosNoSemestre.length > 0 && (
        <div className="space-y-3 rounded-xl border border-amber-300 bg-amber-50 p-4 dark:border-amber-700 dark:bg-amber-950/30">
          <div className="flex flex-wrap items-center gap-3">
            <TriangleAlert className="h-4 w-4 text-amber-600" aria-hidden />
            <p className="text-sm font-medium" role="status">
              {`${excluidosNoSemestre.length} ${excluidosNoSemestre.length === 1 ? 'aluno fica' : 'alunos ficam'} fora do PDF`}
            </p>
            <Button variant="outline" size="sm" className="ml-auto" onClick={baixarCsvExcluidos}>
              <Download className="mr-2 h-4 w-4" />
              Baixar CSV
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            O cartão leva a matrícula do cadastro, e a importação casa as respostas por ela. Sem matrícula utilizável o
            aluno não recebe cartão: corrija o cadastro e gere de novo.
          </p>
          <ul className="max-h-60 divide-y overflow-auto rounded-lg border bg-background" aria-label="Alunos fora do PDF">
            {excluidosNoSemestre.map(({ aluno, motivo }) => (
              <li key={aluno.userId} className="flex items-center gap-3 px-3 py-2 text-sm">
                <span className="flex-1 truncate">{aluno.nome}</span>
                <span className="text-xs text-muted-foreground">{aluno.semestre == null ? '' : `${aluno.semestre}º sem.`}</span>
                <span className="font-mono text-xs text-muted-foreground">{aluno.matricula ?? '—'}</span>
                <span className="text-xs text-muted-foreground">{ROTULO_EXCLUSAO[motivo]}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {ies && (
        <div className="space-y-3 rounded-xl border bg-card p-4">
          <div className="flex flex-wrap items-center gap-3">
            <Button onClick={() => void gerar()} disabled={!podeGerar}>
              {gerando ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Printer className="mr-2 h-4 w-4" />}
              {`Gerar PDF (${total} ${total === 1 ? 'cartão' : 'cartões'})`}
            </Button>
            {gerando && (
              <Button variant="outline" onClick={() => cancelarRef.current?.abort()}>
                Cancelar
              </Button>
            )}
            {resultado && !gerando && (
              <Button variant="secondary" onClick={() => baixar(resultado.url, resultado.arquivo)}>
                <Download className="mr-2 h-4 w-4" />
                {`Baixar de novo (${resultado.paginas} cartões)`}
              </Button>
            )}
            {resultado && !gerando && resultado.lista && (
              <Button variant="outline" onClick={() => baixarTexto(resultado.lista!, resultado.arquivo.replace(/^cartoes_/, 'lista_').replace(/\.pdf$/, '.csv'))}>
                <Download className="mr-2 h-4 w-4" />
                Baixar lista da emissão (CSV)
              </Button>
            )}
          </div>
          {gerando && progresso && (
            <div className="space-y-1" role="status" aria-live="polite">
              <Progress value={(progresso.feitas / progresso.total) * 100} />
              <p className="text-xs text-muted-foreground">
                {progresso.feitas >= progresso.total
                  ? 'Finalizando o arquivo…'
                  : `${progresso.feitas} de ${progresso.total} cartões`}
              </p>
            </div>
          )}
          <p className="text-xs text-muted-foreground">
            Imprima só na frente, em A4, na escala 100% (sem “ajustar à página”), papel de 75 a 90 g/m². Entregue
            cada cartão ao aluno cujo nome e matrícula estão impressos nele.
          </p>
        </div>
      )}
    </div>
  );
}

function baixarTexto(csv: string, arquivo: string): void {
  const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
  baixar(url, arquivo);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function baixar(url: string, arquivo: string): void {
  const a = document.createElement('a');
  a.href = url;
  a.download = arquivo;
  document.body.appendChild(a);
  a.click();
  a.remove();
}
