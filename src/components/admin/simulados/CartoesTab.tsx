/**
 * Sub-aba "Cartões-resposta": emite os cartões em PDF de um simulado para uma IES (PRD, seção 1.1).
 *
 * O time escolhe simulado, IES e alunos; o PDF é gerado aqui, no navegador, a partir dos templates de
 * `services/cartao-omr/templates`. Nenhum dado de aluno sai do Academy. O leitor (script local) devolve as
 * respostas pelo ID do aluno que vai no QR do cartão.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Download, Loader2, Printer, Search } from 'lucide-react';
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
  EmissaoCancelada,
  formatarDataBR,
  montarSpecs,
  nomeDoArquivo,
  type ProgressoEmissao,
} from '@/features/cartoes/emitir';
import { gerarPdfSegundoPlano } from '@/features/cartoes/gerar';
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

interface Resultado {
  url: string;
  arquivo: string;
  paginas: number;
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
  const [carregandoAlunos, setCarregandoAlunos] = useState(false);
  const [erroAlunos, setErroAlunos] = useState<string | null>(null);
  const [selecionados, setSelecionados] = useState<Set<string>>(new Set());
  const [busca, setBusca] = useState('');

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
      const lista = await listarAlunosDaIes(supabase, id);
      setAlunos(lista);
      setSelecionados(new Set(lista.map((a) => a.userId))); // padrão: a turma inteira
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
    setSelecionados(new Set());
    if (!ies) return;
    const grupo = ehIesUniatenas(ies.nome);
    setLayout(grupo ? 'uniatenas' : 'sfa');
    if (!grupo) void carregarAlunos(ies.id);
  }, [ies, carregarAlunos]);

  const aoTrocarLayout = (novo: LayoutCartao) => {
    setLayout(novo);
    setResultado(null);
    if (novo === 'sfa' && ies && !alunos.length && !carregandoAlunos) void carregarAlunos(ies.id);
  };

  // ---------------------------------------------------------------- lista de alunos
  const visiveis = useMemo(() => {
    const q = normalizar(busca.trim());
    if (!q) return alunos;
    return alunos.filter((a) => normalizar(a.nome).includes(q) || (a.matricula ?? '').toLowerCase().includes(q));
  }, [alunos, busca]);

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
  const total = layout === 'sfa' ? selecionados.size : copias;
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
          ? { alunos: alunos.filter((a) => selecionados.has(a.userId)).map((a) => ({ userId: a.userId, nome: a.nome })) }
          : { copias }),
      });
      const pdf = await gerarPdfSegundoPlano(
        layout,
        specs,
        { onProgress: setProgresso, signal: controle.signal },
        `Cartões — ${simulado.nome}`,
      );
      const url = URL.createObjectURL(new Blob([pdf], { type: 'application/pdf' }));
      const arquivo = nomeDoArquivo(ies.nome, simulado.nome);
      setResultado({ url, arquivo, paginas: specs.length });
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

  // ---------------------------------------------------------------- tela
  if (erroSimulados) {
    return <AdminError message={erroSimulados} title="Falha ao carregar simulados" onRetry={carregarSimulados} />;
  }

  return (
    <div className="space-y-6">
      <div className="space-y-4 rounded-xl border bg-card p-4">
        <p className="text-sm text-muted-foreground">
          Gera os cartões-resposta em PDF para imprimir. Cada cartão traz o nome do aluno e um QR com o ID dele no
          Academy, para o script de leitura devolver as respostas já identificadas. O PDF é montado neste
          navegador: nenhum dado dos alunos é enviado para fora.
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
                Pessoal: um cartão por aluno, com nome e QR
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
          ) : !alunos.length ? (
            <AdminEmpty title="Nenhum aluno nesta IES" description="Só alunos (sem papel de equipe) aparecem aqui." />
          ) : (
            <div className="space-y-3 rounded-xl border bg-card p-4">
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
                  {`${selecionados.size} de ${alunos.length} selecionados`}
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
                      <span className="font-mono text-xs text-muted-foreground">{a.matricula ?? 'sem matrícula'}</span>
                    </label>
                  </li>
                ))}
                {!visiveis.length && <li className="px-3 py-6 text-center text-sm text-muted-foreground">Nenhum aluno encontrado.</li>}
              </ul>
            </div>
          )}
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
            cada cartão ao aluno cujo nome está impresso nele.
          </p>
        </div>
      )}
    </div>
  );
}

function baixar(url: string, arquivo: string): void {
  const a = document.createElement('a');
  a.href = url;
  a.download = arquivo;
  document.body.appendChild(a);
  a.click();
  a.remove();
}
