/**
 * Admin → Simulados → Leitura de cartões: envia o PDF escaneado, acompanha a leitura (worker no GitHub Actions)
 * e abre a revisão, de onde as respostas são importadas pelo caminho de sempre.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ExternalLink, FileUp, Loader2, RotateCcw, ScanLine, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { AdminEmpty, AdminError, AdminLoading, AdminSectionHeader, StatusPill } from '@/experiences/admin/ui';
import {
  apagarArquivos,
  enviarLeitura,
  excluirLeitura,
  iniciarLeitura,
  listarLeituras,
  listarSimulados,
  TAMANHO_MAXIMO,
  type SimuladoLeitura,
} from '@/features/cartoes/leitura/api';
import type { Leitura } from '@/features/cartoes/leitura/types';
import { STATUS } from './leitura-status';
import { RevisaoLeitura } from './RevisaoLeitura';

const POLLING_MS = 10_000;

type Confirmacao = { leitura: Leitura; tipo: 'excluir' | 'arquivos' };

const dataHora = (iso: string) => new Date(iso).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' });
const mb = (b: number | null) => (b == null ? '' : `${(b / 1024 / 1024).toFixed(1)} MB`);

export default function LeituraCartoesTab() {
  const [simulados, setSimulados] = useState<SimuladoLeitura[]>([]);
  const [leituras, setLeituras] = useState<Leitura[] | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [simuladoId, setSimuladoId] = useState('');
  const [arquivo, setArquivo] = useState<File | null>(null);
  const [enviando, setEnviando] = useState(false);
  const [aberta, setAberta] = useState<string | null>(null);
  const [confirmacao, setConfirmacao] = useState<Confirmacao | null>(null);
  const [apagando, setApagando] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const nomeSimulado = useMemo(() => new Map(simulados.map((s) => [s.id, s.nome])), [simulados]);
  const simulado = simulados.find((s) => s.id === simuladoId);

  const recarregar = useCallback(async () => {
    try {
      setLeituras(await listarLeituras());
      setErro(null);
    } catch (e) {
      setErro(e instanceof Error ? e.message : String(e));
    }
  }, []);

  useEffect(() => {
    listarSimulados().then(setSimulados).catch((e) => setErro(e instanceof Error ? e.message : String(e)));
    void recarregar();
  }, [recarregar]);

  // enquanto alguma leitura está sendo lida, atualiza a lista
  const lendo = leituras?.some((l) => l.status === 'processando') ?? false;
  useEffect(() => {
    if (!lendo) return;
    const t = setInterval(() => void recarregar(), POLLING_MS);
    return () => clearInterval(t);
  }, [lendo, recarregar]);

  const escolherArquivo = (f: File | undefined) => {
    if (!f) return;
    if (f.type !== 'application/pdf' && !f.name.toLowerCase().endsWith('.pdf')) {
      toast.error('Envie o PDF escaneado dos cartões');
      return;
    }
    if (f.size > TAMANHO_MAXIMO) {
      toast.error('PDF grande demais', { description: 'O limite é 200 MB. Divida o escaneamento em mais de um arquivo.' });
      return;
    }
    setArquivo(f);
  };

  const enviar = async () => {
    if (!simulado || !arquivo) return;
    if (simulado.total_questoes === 0) {
      toast.error('Simulado sem questões', { description: 'Cadastre as questões antes de ler os cartões.' });
      return;
    }
    setEnviando(true);
    try {
      let id: string;
      try {
        id = await enviarLeitura({ simuladoId: simulado.id, totalQuestoes: Math.min(simulado.total_questoes, 100), arquivo });
      } catch (e) {
        toast.error('Não consegui enviar o PDF', { description: e instanceof Error ? e.message : String(e) });
        return;
      }
      setArquivo(null);
      if (inputRef.current) inputRef.current.value = '';
      try {
        await iniciarLeitura(id);
        toast.success('PDF enviado', { description: 'A leitura leva alguns minutos. Esta lista se atualiza sozinha.' });
      } catch (e) {
        toast.error('PDF enviado, mas a leitura não começou', {
          description: `${e instanceof Error ? e.message : String(e)}. Tente "Ler de novo" na lista.`,
        });
      }
    } finally {
      setEnviando(false);
      void recarregar();
    }
  };

  const reprocessar = async (id: string) => {
    try {
      await iniciarLeitura(id);
      toast.success('Leitura disparada de novo');
    } catch (e) {
      toast.error('Não consegui disparar', { description: e instanceof Error ? e.message : String(e) });
    } finally {
      void recarregar();
    }
  };

  const confirmarApagar = async () => {
    if (!confirmacao) return;
    const { leitura, tipo } = confirmacao;
    setApagando(true);
    try {
      if (tipo === 'excluir') {
        await excluirLeitura(leitura.id);
        toast.success('Leitura excluída', { description: `${leitura.arquivo_nome} e as imagens foram apagados.` });
      } else {
        const n = await apagarArquivos(leitura.id);
        toast.success('Arquivos apagados', { description: `${n} arquivo(s). O resultado da leitura continua na lista.` });
      }
    } catch (e) {
      toast.error('Não consegui apagar', { description: e instanceof Error ? e.message : String(e) });
    } finally {
      setApagando(false);
      setConfirmacao(null);
      void recarregar();
    }
  };

  if (aberta) {
    return (
      <RevisaoLeitura
        leituraId={aberta}
        simuladoNome={(id) => nomeSimulado.get(id) ?? ''}
        onVoltar={() => {
          setAberta(null);
          void recarregar();
        }}
      />
    );
  }

  return (
    <div className="space-y-6">
      <AdminSectionHeader
        title="Leitura de cartões"
        subtitle="Envie o PDF escaneado dos cartões-resposta preenchidos. A leitura roda sozinha; depois, revise as pendências e importe as respostas."
      />

      <div className="space-y-4 rounded-xl border bg-card p-4">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="leitura-simulado">Simulado</Label>
            <Select value={simuladoId} onValueChange={setSimuladoId}>
              <SelectTrigger id="leitura-simulado" aria-label="Simulado">
                <SelectValue placeholder="Escolha o simulado dos cartões" />
              </SelectTrigger>
              <SelectContent>
                {simulados.map((s) => (
                  <SelectItem key={s.id} value={s.id}>
                    {s.nome} ({s.total_questoes} questões)
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="leitura-pdf">PDF escaneado</Label>
            <input
              id="leitura-pdf"
              ref={inputRef}
              type="file"
              accept="application/pdf,.pdf"
              onChange={(e) => escolherArquivo(e.target.files?.[0])}
              className="block w-full text-sm file:mr-3 file:rounded-md file:border-0 file:bg-muted file:px-3 file:py-2 file:text-sm"
            />
            {arquivo && <p className="text-xs text-muted-foreground">{arquivo.name} · {mb(arquivo.size)}</p>}
          </div>
        </div>
        <p className="text-xs text-muted-foreground">
          Um PDF por simulado. Pode misturar cartões pessoais, genéricos e UniAtenas. Páginas em branco são ignoradas.
        </p>
        <Button onClick={enviar} disabled={!simulado || !arquivo || enviando}>
          {enviando ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <FileUp className="mr-2 h-4 w-4" />}
          Enviar e ler
        </Button>
      </div>

      {erro && <AdminError title="Falha ao carregar as leituras" message={erro} onRetry={recarregar} />}
      {!erro && leituras === null && <AdminLoading rows={4} />}
      {!erro && leituras?.length === 0 && (
        <AdminEmpty icon={<ScanLine className="h-6 w-6" />} title="Nenhuma leitura ainda" description="Os PDFs enviados aparecem aqui." />
      )}
      {!erro && leituras && leituras.length > 0 && (
        <div className="rounded-xl border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Enviado em</TableHead>
                <TableHead>Simulado</TableHead>
                <TableHead>Arquivo</TableHead>
                <TableHead>Situação</TableHead>
                <TableHead>Resultado</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {leituras.map((l) => (
                <TableRow key={l.id}>
                  <TableCell className="whitespace-nowrap">{dataHora(l.created_at)}</TableCell>
                  <TableCell>{nomeSimulado.get(l.simulado_id) ?? '—'}</TableCell>
                  <TableCell className="max-w-[16rem] truncate" title={l.arquivo_nome}>{l.arquivo_nome}</TableCell>
                  <TableCell>
                    <StatusPill variant={STATUS[l.status].variant} dot={l.status === 'processando'}>
                      {STATUS[l.status].rotulo}
                    </StatusPill>
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {l.resumo
                      ? `${l.resumo.paginas} pág. · ${l.resumo.identificadas} identificadas · ${l.resumo.nao_identificadas} não identificadas${
                          l.arquivos_apagados_em ? ' · arquivos apagados' : ` · ${mb(l.arquivo_bytes)}`
                        }`
                      : l.status === 'falhou'
                        ? <span className="text-red-600 dark:text-red-400" title={l.erro ?? ''}>{(l.erro ?? '').slice(0, 120)}</span>
                        : '—'}
                  </TableCell>
                  <TableCell className="space-x-1 whitespace-nowrap text-right">
                    {l.github_run_url && (
                      <Button asChild variant="ghost" size="sm" aria-label="Ver execução no GitHub">
                        <a href={l.github_run_url} target="_blank" rel="noreferrer"><ExternalLink className="h-4 w-4" /></a>
                      </Button>
                    )}
                    {(l.status === 'falhou' || l.status === 'enviado') && (
                      <Button variant="outline" size="sm" onClick={() => void reprocessar(l.id)}>
                        <RotateCcw className="mr-1 h-4 w-4" /> Ler de novo
                      </Button>
                    )}
                    {(l.status === 'concluido' || l.status === 'importado') && (
                      <Button size="sm" variant={l.status === 'importado' ? 'outline' : 'default'} onClick={() => setAberta(l.id)}>
                        {l.status === 'importado' ? 'Ver' : 'Revisar'}
                      </Button>
                    )}
                    {l.status === 'importado' && !l.arquivos_apagados_em && (
                      <Button variant="ghost" size="sm" onClick={() => setConfirmacao({ leitura: l, tipo: 'arquivos' })}>
                        <Trash2 className="mr-1 h-4 w-4" /> Apagar arquivos
                      </Button>
                    )}
                    {l.status !== 'processando' && l.status !== 'importado' && (
                      <Button
                        variant="ghost"
                        size="sm"
                        aria-label={`Excluir a leitura ${l.arquivo_nome}`}
                        onClick={() => setConfirmacao({ leitura: l, tipo: 'excluir' })}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <AlertDialog open={confirmacao !== null} onOpenChange={(aberto) => !aberto && !apagando && setConfirmacao(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {confirmacao?.tipo === 'excluir' ? 'Excluir esta leitura?' : 'Apagar o PDF e as imagens?'}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {confirmacao?.tipo === 'excluir'
                ? `${confirmacao.leitura.arquivo_nome}: o PDF, as imagens e a revisão feita até aqui serão apagados. Nenhuma resposta foi importada desta leitura. Não dá para desfazer.`
                : `${confirmacao?.leitura.arquivo_nome}: as respostas já foram importadas e o resultado da leitura continua na lista, mas o PDF e as imagens da revisão somem. Não dá para desfazer.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={apagando}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              disabled={apagando}
              onClick={(e) => {
                e.preventDefault();
                void confirmarApagar();
              }}
            >
              {apagando ? 'Apagando…' : confirmacao?.tipo === 'excluir' ? 'Excluir' : 'Apagar arquivos'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
