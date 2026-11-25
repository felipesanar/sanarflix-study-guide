/**
 * Revisão de uma leitura de cartões: resolve as pendências página a página (cada ação grava na hora) e importa
 * pelo mesmo dry-run e importação da aba Importar respostas (edge `admin-import-simulado-responses`).
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ArrowLeft, Eye } from 'lucide-react';
import { toast } from 'sonner';
import * as XLSX from 'xlsx';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { AdminError, AdminLoading, StatCard, StatusPill } from '@/experiences/admin/ui';
import { cn } from '@/lib/utils';
import { brazilISOToDatetimeLocal, datetimeLocalToBrazilISO } from '@/utils/timezone';
import { listarPaginas, marcarImportada, obterLeitura, revisarPagina, urlsAssinadas } from '@/features/cartoes/leitura/api';
import { montarLinhas, situacoes, type Situacao } from '@/features/cartoes/leitura/linhas';
import type { Leitura, PaginaLeitura, RevisaoPatch } from '@/features/cartoes/leitura/types';
import { executarImportacao, previewImportacao, rotuloDoLote, type ChunkInfo } from './importar-respostas-api';
import {
  buildNaoEncontrados,
  normRa,
  REASON_LABEL,
  type FinalReport,
  type PreviewResult,
  type PreviewSummary,
} from './importar-respostas-types';
import { ImportarDryRunStep } from './ImportarDryRunStep';
import { ImportarConcluidoStep } from './ImportarConcluidoStep';
import { PaginaRevisao } from './PaginaRevisao';
import { STATUS } from './leitura-status';

type Filtro = 'resolver' | 'prontas' | 'fora' | 'todas';
const FILTROS: Array<{ id: Filtro; rotulo: string; situacoes: Situacao[] }> = [
  { id: 'resolver', rotulo: 'Para resolver', situacoes: ['nao_identificada', 'duplicada', 'com_duvida'] },
  { id: 'prontas', rotulo: 'Prontas', situacoes: ['pronta'] },
  { id: 'fora', rotulo: 'Ignoradas e descartadas', situacoes: ['ignorada', 'descartada'] },
  { id: 'todas', rotulo: 'Todas', situacoes: ['pronta', 'com_duvida', 'nao_identificada', 'duplicada', 'ignorada', 'descartada'] },
];

export interface RevisaoLeituraProps {
  leituraId: string;
  simuladoNome: (simuladoId: string) => string;
  onVoltar: () => void;
}

export function RevisaoLeitura({ leituraId, simuladoNome, onVoltar }: RevisaoLeituraProps) {
  const [leitura, setLeitura] = useState<Leitura | null>(null);
  const [paginas, setPaginas] = useState<PaginaLeitura[] | null>(null);
  const [urls, setUrls] = useState<Record<string, string>>({});
  const [erro, setErro] = useState<string | null>(null);
  const [filtro, setFiltro] = useState<Filtro>('resolver');

  const [sourceLabel, setSourceLabel] = useState('');
  const [defaultDate, setDefaultDate] = useState('');
  const [conflictMode, setConflictMode] = useState<'skip' | 'replace'>('skip');
  const [previewing, setPreviewing] = useState(false);
  const [preview, setPreview] = useState<{ results: PreviewResult[]; summary: PreviewSummary } | null>(null);
  const [importing, setImporting] = useState(false);
  const [progress, setProgress] = useState(0);
  const [chunkInfo, setChunkInfo] = useState<ChunkInfo | null>(null);
  const [finalReport, setFinalReport] = useState<FinalReport | null>(null);
  const [cancelled, setCancelled] = useState(false);
  const cancelRef = useRef(false);

  const carregar = useCallback(async () => {
    try {
      const [l, pgs] = await Promise.all([obterLeitura(leituraId), listarPaginas(leituraId)]);
      setLeitura(l);
      setPaginas(pgs);
      setSourceLabel((s) => s || `Leitura de cartões: ${l.arquivo_nome}`);
      const caminhos = pgs.flatMap((p) => [p.imagem, ...p.pendencias.map((x) => x.recorte)]).filter((c): c is string => Boolean(c));
      setUrls(await urlsAssinadas(caminhos));
      setErro(null);
    } catch (e) {
      setErro(e instanceof Error ? e.message : String(e));
    }
  }, [leituraId]);

  useEffect(() => {
    void carregar();
  }, [carregar]);

  const sit = useMemo(() => situacoes(paginas ?? []), [paginas]);
  const montagem = useMemo(
    () => (paginas && leitura ? montarLinhas(paginas, leitura.total_questoes) : null),
    [paginas, leitura],
  );
  const somenteLeitura = leitura?.status === 'importado' || importing || Boolean(finalReport);

  const salvar = useCallback(async (pg: PaginaLeitura, patch: RevisaoPatch) => {
    try {
      await revisarPagina(pg.id, patch);
      setPaginas((atual) => atual?.map((p) => (p.id === pg.id ? { ...p, ...patch } : p)) ?? null);
      setPreview(null); // a revisão mudou: o dry-run anterior não vale mais
    } catch (e) {
      toast.error('Não consegui salvar', { description: e instanceof Error ? e.message : String(e) });
    }
  }, []);

  const rodarPreview = async () => {
    if (!leitura || !montagem || montagem.bloqueada || montagem.linhas.length === 0) return;
    setPreviewing(true);
    try {
      const r = await previewImportacao({
        simuladoId: leitura.simulado_id,
        conflictMode,
        sourceLabel: rotuloDoLote(sourceLabel),
        rows: montagem.linhas,
      });
      setPreview(r);
    } catch (e) {
      toast.error('Erro na pré-visualização', { description: e instanceof Error ? e.message : String(e) });
    } finally {
      setPreviewing(false);
    }
  };

  const importar = async () => {
    if (!leitura || !montagem || !preview || importing) return;
    setImporting(true);
    setProgress(0);
    cancelRef.current = false;
    const validas = new Set(
      preview.results.filter((r) => r.status === 'preview_ok' || r.status === 'preview_warning').map((r) => normRa(r.matricula_ra)),
    );
    try {
      const { report, cancelled: c } = await executarImportacao({
        simuladoId: leitura.simulado_id,
        conflictMode,
        sourceLabel: rotuloDoLote(sourceLabel),
        defaultDate,
        rows: montagem.linhas.filter((l) => validas.has(normRa(l.matricula_ra))),
        onChunk: setChunkInfo,
        onProgress: setProgress,
        deveCancelar: () => cancelRef.current,
      });
      setFinalReport(report);
      setCancelled(c);
      if (!c) {
        await marcarImportada(leitura.id, report.batch_id);
        setLeitura({ ...leitura, status: 'importado', import_batch_id: report.batch_id });
      }
      const s = report.summary;
      toast.success(c ? 'Importação interrompida' : 'Importação concluída', {
        description: `${s.imported} importados · ${s.replaced} substituídos · ${s.skipped} pulados · ${s.failed} falhas`,
      });
    } catch (e) {
      toast.error('Erro na importação', { description: e instanceof Error ? e.message : String(e) });
    } finally {
      setImporting(false);
      setChunkInfo(null);
    }
  };

  const baixarRelatorio = () => {
    if (!finalReport) return;
    const ws = XLSX.utils.json_to_sheet(
      finalReport.results.map((r) => ({
        matricula_ra_ou_email: r.matricula_ra,
        nome: r.nome ?? '',
        status: r.status,
        motivo: r.reason ? REASON_LABEL[r.reason] || r.reason : '',
      })),
    );
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Relatório');
    XLSX.writeFile(wb, `import-report-${finalReport.batch_id}.xlsx`);
  };

  if (erro) return <AdminError title="Falha ao abrir a leitura" message={erro} onRetry={carregar} />;
  if (!leitura || !paginas || !montagem) return <AdminLoading rows={6} />;

  const visiveis = paginas.filter((p) => FILTROS.find((f) => f.id === filtro)!.situacoes.includes(sit.get(p.id)!));
  const c = montagem.contagem;
  const naoEncontrados = preview
    ? buildNaoEncontrados(preview.results, montagem.linhas.map((l) => ({ rowIndex: l.pagina, matricula_ra: l.matricula_ra, answers: l.answers })))
    : [];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-3">
        <Button variant="ghost" size="sm" onClick={onVoltar}>
          <ArrowLeft className="mr-1 h-4 w-4" /> Leituras
        </Button>
        <h2 className="text-lg font-semibold">{leitura.arquivo_nome}</h2>
        <span className="text-sm text-muted-foreground">{simuladoNome(leitura.simulado_id)}</span>
        <StatusPill variant={STATUS[leitura.status].variant}>{STATUS[leitura.status].rotulo}</StatusPill>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
        <StatCard label="Prontas" value={c.pronta} accent="emerald" />
        <StatCard label="Com dúvida" value={c.com_duvida} accent="amber" />
        <StatCard label="Não identificadas" value={c.nao_identificada} accent="red" />
        <StatCard label="Alunos repetidos" value={c.duplicada} accent="red" />
        <StatCard label="Ignoradas/descartadas" value={c.ignorada + c.descartada} />
      </div>

      <div className="flex flex-wrap gap-1" role="tablist" aria-label="Filtro de páginas">
        {FILTROS.map((f) => (
          <Button
            key={f.id}
            role="tab"
            aria-selected={filtro === f.id}
            size="sm"
            variant={filtro === f.id ? 'default' : 'outline'}
            onClick={() => setFiltro(f.id)}
          >
            {f.rotulo}
          </Button>
        ))}
      </div>

      <div className="space-y-3">
        {visiveis.length === 0 && <p className="text-sm text-muted-foreground">Nenhuma página neste filtro.</p>}
        {visiveis.map((pg) => (
          <PaginaRevisao
            key={pg.id}
            pg={pg}
            situacao={sit.get(pg.id)!}
            urls={urls}
            somenteLeitura={somenteLeitura}
            onSalvar={(patch) => salvar(pg, patch)}
          />
        ))}
      </div>

      {leitura.status === 'importado' && !finalReport ? (
        <p className="rounded-xl border bg-card p-4 text-sm">
          Leitura já importada (lote <span className="font-mono">{leitura.import_batch_id}</span>). Para refazer, use a aba
          Importar respostas.
        </p>
      ) : finalReport ? (
        <ImportarConcluidoStep finalReport={finalReport} cancelled={cancelled} onDownloadReport={baixarRelatorio} onReset={onVoltar} />
      ) : preview ? (
        <ImportarDryRunStep
          simuladoNome={simuladoNome(leitura.simulado_id)}
          previewSummary={preview.summary}
          linhas={preview.summary.total}
          casados={preview.summary.ok + preview.summary.warning}
          conflitos={preview.summary.already_finalized}
          naoEncontrados={preview.summary.error}
          naoEncontradosLista={naoEncontrados}
          conflictMode={conflictMode}
          onConflictModeChange={setConflictMode}
          importing={importing}
          progress={progress}
          chunkInfo={chunkInfo}
          onStartImport={() => void importar()}
          onCancelImport={() => {
            cancelRef.current = true;
          }}
          onVoltar={() => setPreview(null)}
        />
      ) : (
        <div className="space-y-4 rounded-xl border bg-card p-4">
          <h3 className="font-medium">Importar respostas</h3>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div className="space-y-1">
              <Label htmlFor="leitura-rotulo">Rótulo da importação</Label>
              <Input id="leitura-rotulo" value={sourceLabel} onChange={(e) => setSourceLabel(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label htmlFor="leitura-data">Data de finalização (opcional; padrão: agora)</Label>
              <Input
                id="leitura-data"
                type="datetime-local"
                value={defaultDate ? brazilISOToDatetimeLocal(defaultDate) : ''}
                onChange={(e) => setDefaultDate(e.target.value ? datetimeLocalToBrazilISO(e.target.value) : '')}
                className="max-w-xs"
              />
            </div>
          </div>
          {montagem.bloqueada && (
            <p className="text-sm text-red-600 dark:text-red-400">
              Resolva antes as páginas não identificadas e os alunos repetidos (confirme a matrícula ou descarte a página).
            </p>
          )}
          <p className={cn('text-xs text-muted-foreground')}>
            Questões com dúvida sem decisão entram em branco. A página do número da linha nos não encontrados é a página do PDF.
          </p>
          <Button onClick={() => void rodarPreview()} disabled={montagem.bloqueada || montagem.linhas.length === 0 || previewing}>
            <Eye className="mr-2 h-4 w-4" />
            {previewing ? 'Pré-visualizando…' : `Pré-visualizar importação (${montagem.linhas.length} aluno${montagem.linhas.length === 1 ? '' : 's'})`}
          </Button>
        </div>
      )}
    </div>
  );
}
