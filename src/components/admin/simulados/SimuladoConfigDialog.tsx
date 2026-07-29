/**
 * Fatia C1 — diálogo de criação/edição de simulado. Reaproveita TODA a lógica
 * de `src/components/admin/SimuladosTab.tsx` (validações da planilha, extração
 * de imagens embutidas fail-loud, upload via edge function) num layout único
 * (dropzone + campos), em vez do fluxo antigo de dois modais sequenciais
 * (preview → configuração).
 */
import { useEffect, useState } from 'react';
import * as XLSX from 'xlsx';
import { AlertCircle, CheckCircle, Download, Loader2, Plus, Upload, X } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { Logger } from '@/utils/logger';
import { datetimeLocalToBrazilISO, brazilISOToDatetimeLocal } from '@/utils/timezone';
import {
  extractImagesFromXlsx,
  compressBase64Image,
  buildImageColCandidates,
  type ExtractedImagesResult,
} from '@/utils/xlsxImageExtractor';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Progress } from '@/components/ui/progress';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { MonoValue } from '@/experiences/admin/ui';
import { logAdminAction } from '@/services/admin/logAction';
import { updateSimulado } from '@/services/admin/simulados';
import { cn } from '@/lib/utils';
import type { IES, Simulado } from './ProvasTab';

const DURACAO_OPCOES = [
  { value: 120, label: '2h' },
  { value: 180, label: '3h' },
  { value: 240, label: '4h' },
  { value: 300, label: '5h' },
  { value: 360, label: '6h' },
];

/**
 * Status calculado a partir das datas para SALVAR — mesma regra de
 * `ProvasTab.calcularStatus` (usada para EXIBIR), incluindo `data_encerramento`
 * passada. Recebe o status BRUTO DO BANCO (`Simulado.statusDb`, não o
 * computado `Simulado.status`) e o PRESERVA quando for 'encerrado' — editar um
 * simulado encerrado MANUALMENTE nunca deve reativá-lo silenciosamente
 * (achado de auditoria P1). Quando o encerramento é apenas computado (banco
 * 'ativo', `data_encerramento` no passado), o cálculo roda normalmente: se o
 * admin estender a data para o futuro, a prova volta a 'ativo' (reabertura
 * intencional); se a data continuar no passado, o resultado permanece
 * 'encerrado' pelo próprio cálculo de data.
 */
function calcularStatusSalvar(
  dataLiberacaoISO: string | null,
  dataEncerramentoISO: string | null,
  statusBancoAtual: 'aguardando' | 'ativo' | 'encerrado' | null,
): 'aguardando' | 'ativo' | 'encerrado' {
  const agora = new Date();
  if (statusBancoAtual === 'encerrado') return 'encerrado';
  if (dataEncerramentoISO && new Date(dataEncerramentoISO) < agora) return 'encerrado';
  if (dataLiberacaoISO && new Date(dataLiberacaoISO) > agora) return 'aguardando';
  return 'ativo';
}

const colIdxToLetter = (idx: number): string => {
  if (idx < 0) return '?';
  let n = idx;
  let s = '';
  do {
    s = String.fromCharCode(65 + (n % 26)) + s;
    n = Math.floor(n / 26) - 1;
  } while (n >= 0);
  return s;
};

type ImageSlot = 'enunciado' | 'enunciado2' | 'comentario';
type ImageUploadInput = { ordem: number; slot: ImageSlot; data: string; mime: string };
type ImageUploadResult = {
  urlsByOrdem: Record<number, { enunciado?: string; enunciado2?: string; comentario?: string }>;
  partialErrors: Array<{ ordem: number; slot?: string; message: string }>;
  fatalError: string | null;
};

/** Sobe imagens de simulado via edge function `admin-upload-simulado-images` (best-effort). */
async function uploadSimuladoImages(simuladoId: string, images: ImageUploadInput[]): Promise<ImageUploadResult> {
  const urlsByOrdem: ImageUploadResult['urlsByOrdem'] = {};
  if (images.length === 0) return { urlsByOrdem, partialErrors: [], fatalError: null };

  const { data, error } = await supabase.functions.invoke('admin-upload-simulado-images', {
    body: { simulado_id: simuladoId, images },
  });

  if (error) {
    let detalhe = error.message ?? String(error);
    const ctx = (error as { context?: Response }).context;
    if (ctx && typeof ctx.text === 'function') {
      const status = ctx.status;
      const body = await ctx.text().catch(() => '');
      detalhe = `HTTP ${status} — ${body || error.message}`;
    }
    Logger.error('[SimuladoConfigDialog] admin-upload-simulado-images falhou:', detalhe);
    return { urlsByOrdem, partialErrors: [], fatalError: detalhe };
  }

  const returnedUrls = (data?.urls ?? []) as Array<{ ordem: number; slot: ImageSlot; url: string }>;
  for (const u of returnedUrls) {
    if (!urlsByOrdem[u.ordem]) urlsByOrdem[u.ordem] = {};
    urlsByOrdem[u.ordem][u.slot] = u.url;
  }
  const partialErrors = (data?.errors ?? []) as ImageUploadResult['partialErrors'];
  return { urlsByOrdem, partialErrors, fatalError: null };
}

interface EmbeddedImage {
  base64: string;
  mimeType: string;
}

interface Questao {
  ordem: number;
  numero_questao?: number;
  grande_area?: string;
  especialidade?: string;
  tema?: string;
  competencia?: string;
  enunciado: string;
  alternativa_a: string;
  alternativa_b: string;
  alternativa_c: string;
  alternativa_d: string;
  alternativa_e: string | null;
  correta: 'A' | 'B' | 'C' | 'D' | 'E';
  comentario: string | null;
  feedback_corretas: string | null;
  imagem: string | null;
  imagem_2?: string | null;
  imagem_comentario?: string | null;
  observacao: string | null;
  _embeddedEnunciado?: EmbeddedImage;
  _embeddedEnunciado2?: EmbeddedImage;
  _embeddedComentario?: EmbeddedImage;
}

interface ParsedFile {
  questoes: Questao[];
  imageStats: ExtractedImagesResult['stats'];
  imageColCandidates: { enunciado: number[]; comentario: number[] };
}

const FORM_INITIAL = {
  nome: '',
  descricao: '',
  dataLiberacao: '',
  liberarImediatamente: false,
  dataEncerramento: '',
  liberacaoDesempenho: 'imediato' as 'imediato' | 'agendado' | 'ao_encerrar',
  dataLiberacaoDesempenho: '',
};

export interface SimuladoConfigDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode: 'create' | 'edit';
  simulado: Simulado | null;
  iesList: IES[];
  /** Chamado após salvar com sucesso — o chamador fecha o diálogo e recarrega a lista. */
  onSaved: () => void;
}

export default function SimuladoConfigDialog({
  open,
  onOpenChange,
  mode,
  simulado,
  iesList,
  onSaved,
}: SimuladoConfigDialogProps) {
  const [form, setForm] = useState(FORM_INITIAL);
  const [selectedIES, setSelectedIES] = useState<string[]>([]);
  const [duracaoMinutos, setDuracaoMinutos] = useState(DURACAO_OPCOES[0].value);
  const [iesPopoverOpen, setIesPopoverOpen] = useState(false);

  const [parsedFile, setParsedFile] = useState<ParsedFile | null>(null);
  const [parsing, setParsing] = useState(false);
  const [parseProgress, setParseProgress] = useState(0);
  const [ignoreImageWarning, setIgnoreImageWarning] = useState(false);
  const [saving, setSaving] = useState(false);

  // Valor original de `data_liberacao` (ISO) no momento em que o diálogo abriu em modo
  // edição, e se o admin alterou o agendamento NESTA sessão de edição. Usados no save
  // para não reescrever `data_liberacao` para "agora" só porque o simulado já estava
  // liberado (achado de auditoria P2) — só sobrescrevemos se o usuário de fato mexeu.
  const [dataLiberacaoOriginalISO, setDataLiberacaoOriginalISO] = useState<string | null>(null);
  const [scheduleChanged, setScheduleChanged] = useState(false);

  // Reseta/preenche o formulário sempre que o diálogo abre.
  useEffect(() => {
    if (!open) return;
    if (mode === 'edit' && simulado) {
      const agora = new Date();
      const dataLib = simulado.data_liberacao ? new Date(simulado.data_liberacao) : null;
      setForm({
        nome: simulado.nome,
        descricao: simulado.descricao ?? '',
        dataLiberacao: simulado.data_liberacao ? brazilISOToDatetimeLocal(simulado.data_liberacao) : '',
        liberarImediatamente: dataLib ? dataLib <= agora : false,
        dataEncerramento: simulado.data_encerramento ? brazilISOToDatetimeLocal(simulado.data_encerramento) : '',
        liberacaoDesempenho: simulado.liberacao_desempenho,
        dataLiberacaoDesempenho: simulado.data_liberacao_desempenho
          ? brazilISOToDatetimeLocal(simulado.data_liberacao_desempenho)
          : '',
      });
      setSelectedIES(simulado.ies_ids);
      setDuracaoMinutos(simulado.duracao_minutos);
      setDataLiberacaoOriginalISO(simulado.data_liberacao);
      setScheduleChanged(false);
    } else {
      setForm(FORM_INITIAL);
      setSelectedIES([]);
      setDuracaoMinutos(DURACAO_OPCOES[0].value);
      setDataLiberacaoOriginalISO(null);
      setScheduleChanged(false);
    }
    setParsedFile(null);
    setIgnoreImageWarning(false);
  }, [open, mode, simulado]);

  // Trava de encerramento (alerta + preservação no save) considera o status DO
  // BANCO (`statusDb`), não o computado (`status`) — este último também vira
  // 'encerrado' quando `data_encerramento` já passou mesmo com o banco em
  // 'ativo', e nesse caso estender a data para o futuro deve reabrir a prova
  // normalmente em vez de ficar preso no encerramento manual.
  const simuladoEncerrado = mode === 'edit' && simulado?.statusDb === 'encerrado';

  const toggleIES = (id: string, checked: boolean) => {
    setSelectedIES((prev) => (checked ? [...prev, id] : prev.filter((x) => x !== id)));
  };

  const removeIES = (id: string) => setSelectedIES((prev) => prev.filter((x) => x !== id));

  const handleDownloadTemplate = () => {
    const templateData = [
      {
        numero: 1,
        'Grande Área': 'Clínica Médica',
        Especialidade: 'Cardiologia',
        Tema: 'Insuficiência Cardíaca',
        Enunciado: 'Paciente de 65 anos apresenta dispneia progressiva há 3 meses. Qual o exame inicial mais indicado?',
        'Imagem do Enunciado': '',
        'Imagem 2 do Enunciado': '',
        'Alternativa A': 'Radiografia de tórax',
        'Alternativa B': 'Ecocardiograma',
        'Alternativa C': 'Cateterismo cardíaco',
        'Alternativa D': 'Ressonância magnética cardíaca',
        Gabarito: 'A',
        Comentário: 'A radiografia de tórax é o exame inicial de escolha para avaliar dispneia.',
        'Imagem do Comentário': '',
      },
    ];
    const worksheet = XLSX.utils.json_to_sheet(templateData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Simulado');
    XLSX.writeFile(workbook, 'modelo_simulado.xlsx');
    toast.success('Modelo baixado', {
      description: 'Cole imagens diretamente nas colunas "Imagem do Enunciado" e "Imagem do Comentário".',
    });
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;

    setParsing(true);
    setParseProgress(10);
    setIgnoreImageWarning(false);
    try {
      const arrayBuffer = await file.arrayBuffer();
      const workbook = XLSX.read(arrayBuffer, { type: 'array' });
      const sheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[sheetName];
      const jsonData = XLSX.utils.sheet_to_json(worksheet) as Record<string, unknown>[];
      setParseProgress(30);

      const requiredColumns = [
        'numero',
        'grande área',
        'especialidade',
        'tema',
        'enunciado',
        'alternativa a',
        'alternativa b',
        'alternativa c',
        'alternativa d',
        'gabarito',
        'comentário',
      ];
      const firstRow = jsonData[0] ?? {};
      const originalKeys = Object.keys(firstRow);
      const norm = (k: string) => {
        const lower = k.toLowerCase().trim();
        return lower === 'número' ? 'numero' : lower;
      };
      const columns = originalKeys.map(norm);
      const missingColumns = requiredColumns.filter((col) => !columns.includes(col));
      if (missingColumns.length > 0) {
        throw new Error(
          `O arquivo está incompleto. Colunas obrigatórias faltando:\n${missingColumns.join(', ')}\n\nColunas esperadas:\n${requiredColumns.join(', ')}`,
        );
      }

      const {
        enunciadoColCandidates,
        enunciado2ColCandidates,
        comentarioColCandidates,
        numeroColIndex,
      } = buildImageColCandidates(originalKeys);

      if (numeroColIndex < 0) {
        throw new Error(
          'Coluna obrigatória "numero" não encontrada.\n\nAdicione uma coluna chamada exatamente "numero" com o número sequencial de cada questão (1, 2, 3...).\n\nSem essa coluna não é possível vincular as imagens embutidas às questões corretas.',
        );
      }

      const numeroErrors: string[] = [];
      const numerosVistos = new Map<number, number>();
      jsonData.forEach((row, idx) => {
        const linhaPlanilha = idx + 2;
        const normalized: Record<string, unknown> = {};
        Object.keys(row).forEach((k) => {
          normalized[k.toLowerCase().trim()] = row[k];
        });
        const raw = normalized['numero'];
        if (raw === undefined || raw === null || String(raw).trim() === '') {
          numeroErrors.push(`Linha ${linhaPlanilha}: coluna "numero" está vazia`);
          return;
        }
        const num = Number(String(raw).trim());
        if (!Number.isInteger(num) || num <= 0) {
          numeroErrors.push(`Linha ${linhaPlanilha}: "numero" deve ser um inteiro positivo (encontrado: "${raw}")`);
          return;
        }
        if (numerosVistos.has(num)) {
          numeroErrors.push(`Linha ${linhaPlanilha}: número ${num} duplicado (já usado na linha ${numerosVistos.get(num)})`);
          return;
        }
        numerosVistos.set(num, linhaPlanilha);
      });
      if (numeroErrors.length > 0) {
        const preview = numeroErrors.slice(0, 10).join('\n');
        const extra = numeroErrors.length > 10 ? `\n\n…e mais ${numeroErrors.length - 10} erro(s).` : '';
        throw new Error(`Problemas na coluna "numero":\n\n${preview}${extra}`);
      }

      setParseProgress(50);

      let extracted: ExtractedImagesResult = {
        enunciadoImages: {},
        enunciado2Images: {},
        comentarioImages: {},
        stats: {
          totalMedia: 0,
          matchedEnunciado: 0,
          matchedEnunciado2: 0,
          matchedComentario: 0,
          skippedNoAnchor: 0,
          skippedWrongColumn: 0,
          skippedNoQuestionNumber: 0,
        },
        debug: { anchors: [] },
      };
      if (enunciadoColCandidates.length > 0 || enunciado2ColCandidates.length > 0 || comentarioColCandidates.length > 0) {
        try {
          extracted = await extractImagesFromXlsx(arrayBuffer, {
            enunciadoColCandidates,
            enunciado2ColCandidates,
            comentarioColCandidates,
            numeroColIndex,
          });
        } catch (extractErr) {
          Logger.warn('[SimuladoConfigDialog] falha ao extrair imagens embutidas:', extractErr);
        }
      }

      setParseProgress(70);

      const questoes: Questao[] = await Promise.all(
        jsonData.map(async (row, index) => {
          const normalizedRow: Record<string, unknown> = {};
          Object.keys(row).forEach((key) => {
            normalizedRow[key.toLowerCase().trim()] = row[key];
          });

          const correta = String(normalizedRow['gabarito'] ?? '').toUpperCase();
          if (!correta || !['A', 'B', 'C', 'D'].includes(correta)) {
            throw new Error(`Questão ${index + 1}: campo "Gabarito" inválido. Deve ser A, B, C ou D. Valor: "${correta}"`);
          }

          const numeroQuestao = Number(normalizedRow['numero']) || index + 1;
          const rawEnunciado = extracted.enunciadoImages[numeroQuestao];
          const rawEnunciado2 = extracted.enunciado2Images[numeroQuestao];
          const rawComentario = extracted.comentarioImages[numeroQuestao];

          const [embeddedEnunciado, embeddedEnunciado2, embeddedComentario] = await Promise.all([
            rawEnunciado ? compressBase64Image(rawEnunciado.base64, rawEnunciado.mimeType) : Promise.resolve(undefined),
            rawEnunciado2 ? compressBase64Image(rawEnunciado2.base64, rawEnunciado2.mimeType) : Promise.resolve(undefined),
            rawComentario ? compressBase64Image(rawComentario.base64, rawComentario.mimeType) : Promise.resolve(undefined),
          ]);

          return {
            ordem: index + 1,
            numero_questao: Number(normalizedRow['numero']) || index + 1,
            grande_area: String(normalizedRow['grande área'] ?? ''),
            especialidade: String(normalizedRow['especialidade'] ?? ''),
            tema: String(normalizedRow['tema'] ?? ''),
            competencia: '',
            enunciado: String(normalizedRow['enunciado'] ?? ''),
            alternativa_a: String(normalizedRow['alternativa a'] ?? ''),
            alternativa_b: String(normalizedRow['alternativa b'] ?? ''),
            alternativa_c: String(normalizedRow['alternativa c'] ?? ''),
            alternativa_d: String(normalizedRow['alternativa d'] ?? ''),
            alternativa_e: null,
            correta: correta as 'A' | 'B' | 'C' | 'D',
            comentario: normalizedRow['comentário'] ? String(normalizedRow['comentário']) : null,
            feedback_corretas: null,
            imagem: null,
            imagem_2: null,
            imagem_comentario: null,
            observacao: null,
            _embeddedEnunciado: embeddedEnunciado,
            _embeddedEnunciado2: embeddedEnunciado2,
            _embeddedComentario: embeddedComentario,
          };
        }),
      );

      setParseProgress(100);
      setParsedFile({
        questoes,
        imageStats: extracted.stats,
        imageColCandidates: { enunciado: enunciadoColCandidates, comentario: comentarioColCandidates },
      });

      if (!form.nome) {
        setForm((prev) => ({ ...prev, nome: file.name.replace(/\.xlsx?$/i, '') }));
      }

      const totalEmbedded = extracted.stats.matchedEnunciado + extracted.stats.matchedEnunciado2 + extracted.stats.matchedComentario;
      if (totalEmbedded > 0) {
        toast.success('Imagens detectadas', { description: `${totalEmbedded} imagem(ns) vinculada(s) às questões.` });
      }
    } catch (err) {
      toast.error('Erro ao processar arquivo', { description: err instanceof Error ? err.message : String(err) });
      setParsedFile(null);
    } finally {
      setParsing(false);
      setParseProgress(0);
    }
  };

  const stats = parsedFile?.imageStats;
  const matched = stats ? stats.matchedEnunciado + stats.matchedEnunciado2 + stats.matchedComentario : 0;
  const hasUnmatchedImages = !!stats && stats.totalMedia > 0 && matched < stats.totalMedia;
  const allImagesFailed = !!stats && stats.totalMedia > 0 && matched === 0;

  const canSave =
    !saving &&
    form.nome.trim() !== '' &&
    selectedIES.length > 0 &&
    (mode === 'edit' || parsedFile !== null) &&
    (!allImagesFailed || ignoreImageWarning);

  const handleSave = async () => {
    if (!canSave) return;
    try {
      setSaving(true);
      const agora = new Date();
      // Em edição, só recalculamos `data_liberacao` se o admin de fato mexeu no
      // agendamento nesta sessão — do contrário mantemos o valor original tal como
      // veio do banco (achado P2: antes, editar um simulado já liberado reescrevia
      // `data_liberacao` para "agora" a cada save, mesmo sem o admin tocar na data).
      let dataLiberacaoISO: string | null;
      if (mode === 'edit' && !scheduleChanged) {
        dataLiberacaoISO = dataLiberacaoOriginalISO;
      } else if (form.liberarImediatamente) {
        dataLiberacaoISO = agora.toISOString();
      } else if (form.dataLiberacao) {
        dataLiberacaoISO = datetimeLocalToBrazilISO(form.dataLiberacao);
      } else {
        dataLiberacaoISO = null;
      }
      const dataEncerramentoISO = form.dataEncerramento ? datetimeLocalToBrazilISO(form.dataEncerramento) : null;
      // Preserva 'encerrado' ao editar (achado P1) SOMENTE quando o encerramento foi
      // manual/persistido no banco (`simulado.statusDb`) — nunca reabrimos uma prova
      // encerrada dessa forma silenciosamente. Quando o encerramento é apenas
      // computado (banco 'ativo', `data_encerramento` passada), passamos o status do
      // banco ('ativo') e deixamos `calcularStatusSalvar` recalcular pelas datas: se o
      // admin estendeu `data_encerramento` para o futuro, a prova reabre — que é a
      // intenção explícita ao editar a data.
      const statusCalculado = calcularStatusSalvar(
        dataLiberacaoISO,
        dataEncerramentoISO,
        mode === 'edit' ? simulado?.statusDb ?? null : null,
      );
      const dataLiberacaoDesempenhoISO =
        form.liberacaoDesempenho === 'agendado' && form.dataLiberacaoDesempenho
          ? datetimeLocalToBrazilISO(form.dataLiberacaoDesempenho)
          : null;

      if (mode === 'edit' && simulado) {
        // Escrita via RPC `admin_update_simulado`, não mais `.from().update()`
        // direto (decisão do Felipe em 28/07, escopo extra da Task 10 da Fase
        // 0b): a RPC audita no mesmo commit e deriva `data_agendada_original`
        // (§6.4), que é o que faz a tag "Reagendado" sumir sozinha. Dois
        // caminhos de escrita convivendo deixavam metade das mudanças sem
        // auditoria e sem a derivação.
        //
        // `atualizarAgenda` fica em `false` de propósito: este dialog não
        // conhece `modalidade` nem `data_realizacao` (não estão no tipo
        // `Simulado` nem no form), e é esse flag que faz a RPC PRESERVAR os
        // valores do banco em vez de zerá-los a cada save.
        await updateSimulado({
          simuladoId: simulado.id,
          nome: form.nome,
          descricao: form.descricao || null,
          dataLiberacao: dataLiberacaoISO,
          dataEncerramento: dataEncerramentoISO,
          duracaoMinutos,
          status: statusCalculado,
          iesIds: selectedIES,
          liberacaoDesempenho: form.liberacaoDesempenho,
          dataLiberacaoDesempenho: dataLiberacaoDesempenhoISO,
        });

        // Sem `logAdminAction` aqui: a RPC já grava `editar_simulado` em
        // `admin_audit_log` no mesmo commit. Chamar os dois daria duas linhas
        // de auditoria por save.

        toast.success('Simulado atualizado!', { description: 'As configurações foram salvas com sucesso.' });
      } else {
        if (!parsedFile) return;
        const { data: novoSimulado, error: insertError } = await supabase
          .from('simulados_admin')
          .insert({
            nome: form.nome,
            descricao: form.descricao || null,
            data_liberacao: dataLiberacaoISO,
            data_encerramento: dataEncerramentoISO,
            duracao_minutos: duracaoMinutos,
            status: statusCalculado,
            ies_ids: selectedIES,
            liberacao_desempenho: form.liberacaoDesempenho,
            data_liberacao_desempenho: dataLiberacaoDesempenhoISO,
          })
          .select()
          .single();
        if (insertError) throw insertError;

        const imagesPayload: ImageUploadInput[] = [];
        for (const q of parsedFile.questoes) {
          if (q._embeddedEnunciado) {
            imagesPayload.push({ ordem: q.ordem, slot: 'enunciado', data: q._embeddedEnunciado.base64, mime: q._embeddedEnunciado.mimeType });
          }
          if (q._embeddedEnunciado2) {
            imagesPayload.push({ ordem: q.ordem, slot: 'enunciado2', data: q._embeddedEnunciado2.base64, mime: q._embeddedEnunciado2.mimeType });
          }
          if (q._embeddedComentario) {
            imagesPayload.push({ ordem: q.ordem, slot: 'comentario', data: q._embeddedComentario.base64, mime: q._embeddedComentario.mimeType });
          }
        }

        const { urlsByOrdem, partialErrors, fatalError } = await uploadSimuladoImages(novoSimulado.id, imagesPayload);

        const questoesComSimuladoId = parsedFile.questoes.map((q) => {
          const { _embeddedEnunciado, _embeddedEnunciado2, _embeddedComentario, ...clean } = q;
          const slotUrls = urlsByOrdem[q.ordem] ?? {};
          return {
            ...clean,
            simulado_id: novoSimulado.id,
            imagem: slotUrls.enunciado ?? clean.imagem ?? null,
            imagem_2: slotUrls.enunciado2 ?? clean.imagem_2 ?? null,
            imagem_comentario: slotUrls.comentario ?? clean.imagem_comentario ?? null,
          };
        });

        const { error: questoesError } = await supabase.from('questoes_simulado').insert(questoesComSimuladoId);
        if (questoesError) {
          await supabase.from('simulados_admin').delete().eq('id', novoSimulado.id);
          throw questoesError;
        }

        if (fatalError) {
          toast.error('Simulado criado, mas as imagens não subiram', {
            description: `${fatalError}. Anexe manualmente pelo editor de cada questão depois.`,
          });
        } else if (partialErrors.length > 0) {
          const amostra = partialErrors.slice(0, 3).map((e) => `Q${e.ordem}${e.slot ? `/${e.slot}` : ''}: ${e.message}`).join(' · ');
          toast.error(`${partialErrors.length} imagem(ns) falharam`, {
            description: `${amostra}${partialErrors.length > 3 ? ' …' : ''}.`,
          });
        }

        await logAdminAction('criar_simulado', null, { simulado_id: novoSimulado.id, nome: form.nome });

        toast.success('Simulado criado com sucesso!', { description: `${parsedFile.questoes.length} questões foram adicionadas.` });
      }

      onSaved();
    } catch (err) {
      toast.error('Erro ao salvar simulado', { description: err instanceof Error ? err.message : String(err) });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(next) => !saving && onOpenChange(next)}>
      <DialogContent className="flex max-h-[90vh] max-w-2xl flex-col gap-0 overflow-hidden p-0">
        <DialogHeader className="border-b px-6 py-4">
          <DialogTitle>{mode === 'edit' ? 'Editar simulado' : 'Novo simulado'}</DialogTitle>
          <DialogDescription>
            {mode === 'edit' ? `Atualize as configurações de "${simulado?.nome}".` : 'Envie a planilha e configure o simulado.'}
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 space-y-5 overflow-y-auto px-6 py-4">
          {mode === 'create' && (
            <div className="space-y-2">
              <Label>Planilha de questões (.xlsx) *</Label>
              <div className="rounded-xl border-2 border-dashed p-6 text-center">
                <Upload className="mx-auto mb-2 h-8 w-8 text-muted-foreground" />
                <p className="mb-3 text-sm text-muted-foreground">Arraste um arquivo .xlsx ou clique para selecionar</p>
                <div className="flex flex-col items-center gap-2">
                  <Input type="file" accept=".xlsx,.xls" onChange={handleFileChange} disabled={parsing} className="max-w-xs cursor-pointer" />
                  <Button type="button" variant="outline" size="sm" onClick={handleDownloadTemplate} className="gap-2">
                    <Download className="h-4 w-4" /> Baixar arquivo modelo
                  </Button>
                </div>
                {parsing && (
                  <div className="mt-4 space-y-1.5">
                    <Progress value={parseProgress} />
                    <p className="flex items-center justify-center gap-2 text-xs text-muted-foreground">
                      <Loader2 className="h-3.5 w-3.5 animate-spin" /> Processando arquivo…
                    </p>
                  </div>
                )}
              </div>
              <p className="text-xs text-muted-foreground">
                Colunas obrigatórias: numero, Grande Área, Especialidade, Tema, Enunciado, Alternativa A–D, Gabarito,
                Comentário. Imagens coladas nas colunas de enunciado/comentário são extraídas automaticamente — se
                alguma não puder ser vinculada a uma questão, você verá um aviso abaixo antes de poder salvar
                (nenhuma imagem é perdida em silêncio).
              </p>

              {stats && stats.totalMedia > 0 && (
                <div
                  className={cn(
                    'rounded-xl border p-3 text-sm',
                    allImagesFailed
                      ? 'border-red-300 bg-red-500/10'
                      : hasUnmatchedImages
                        ? 'border-amber-300 bg-amber-500/10'
                        : 'border-emerald-300 bg-emerald-500/10',
                  )}
                >
                  <p className="flex items-center gap-2 font-medium">
                    {hasUnmatchedImages ? (
                      <AlertCircle className="h-4 w-4 text-amber-600 dark:text-amber-400" />
                    ) : (
                      <CheckCircle className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                    )}
                    {matched} de {stats.totalMedia} imagem(ns) vinculada(s)
                    {hasUnmatchedImages && ` — ${stats.totalMedia - matched} ficará(ão) de fora`}
                  </p>
                  {hasUnmatchedImages && (
                    <p className="mt-1 text-xs text-muted-foreground">
                      Colunas testadas — enunciado: [{parsedFile?.imageColCandidates.enunciado.map(colIdxToLetter).join(', ')}], comentário: [
                      {parsedFile?.imageColCandidates.comentario.map(colIdxToLetter).join(', ')}]. Cole a imagem na mesma linha da
                      questão, na coluna do enunciado/comentário, com a coluna “numero” preenchida.
                    </p>
                  )}
                  {allImagesFailed && (
                    <label className="mt-2 flex items-start gap-2 text-xs">
                      <Checkbox checked={ignoreImageWarning} onCheckedChange={(c) => setIgnoreImageWarning(!!c)} className="mt-0.5" />
                      <span>Entendo e quero criar o simulado sem essas imagens (posso anexá-las manualmente depois).</span>
                    </label>
                  )}
                </div>
              )}

              {parsedFile && (
                <p className="text-sm text-muted-foreground">
                  <MonoValue>{parsedFile.questoes.length}</MonoValue> questão(ões) carregada(s) da planilha.
                </p>
              )}
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="simulado-nome">Nome *</Label>
            <Input
              id="simulado-nome"
              value={form.nome}
              onChange={(e) => setForm((prev) => ({ ...prev, nome: e.target.value }))}
              placeholder="Ex: Simulado ENAMED 2024"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="simulado-descricao">Descrição</Label>
            <Textarea
              id="simulado-descricao"
              value={form.descricao}
              onChange={(e) => setForm((prev) => ({ ...prev, descricao: e.target.value }))}
              placeholder="Descrição opcional do simulado"
            />
          </div>

          <div className="space-y-2">
            <Label>IES responsáveis *</Label>
            <div className="flex flex-wrap items-center gap-2">
              {selectedIES.map((id) => {
                const nome = iesList.find((i) => i.id === id)?.nome ?? id;
                return (
                  <span key={id} className="inline-flex items-center gap-1.5 rounded-full bg-muted px-2.5 py-1 text-xs font-medium">
                    {nome}
                    <button type="button" onClick={() => removeIES(id)} className="text-muted-foreground hover:text-foreground">
                      <X className="h-3 w-3" />
                    </button>
                  </span>
                );
              })}
              <Popover open={iesPopoverOpen} onOpenChange={setIesPopoverOpen}>
                <PopoverTrigger asChild>
                  <Button type="button" variant="outline" size="sm" className="h-7 gap-1 rounded-full">
                    <Plus className="h-3 w-3" /> Adicionar
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-64 p-2" align="start">
                  <div className="max-h-60 space-y-1 overflow-y-auto">
                    {iesList.length === 0 ? (
                      <p className="px-2 py-1.5 text-sm text-muted-foreground">Carregando IES…</p>
                    ) : (
                      iesList.map((ies) => (
                        <label key={ies.id} className="flex cursor-pointer items-center gap-2 rounded px-2 py-1.5 text-sm hover:bg-accent">
                          <Checkbox checked={selectedIES.includes(ies.id)} onCheckedChange={(c) => toggleIES(ies.id, !!c)} />
                          {ies.nome}
                        </label>
                      ))
                    )}
                  </div>
                </PopoverContent>
              </Popover>
            </div>
            {selectedIES.length === 0 && <p className="text-xs text-destructive">Selecione ao menos uma IES.</p>}
          </div>

          <div className="space-y-2">
            <Label>Duração *</Label>
            <div className="flex gap-2">
              {DURACAO_OPCOES.map((opcao) => (
                <Button
                  key={opcao.value}
                  type="button"
                  size="sm"
                  variant={duracaoMinutos === opcao.value ? 'default' : 'outline'}
                  className="rounded-full"
                  onClick={() => setDuracaoMinutos(opcao.value)}
                >
                  {opcao.label}
                </Button>
              ))}
            </div>
          </div>

          {simuladoEncerrado && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>Esta prova está encerrada</AlertTitle>
              <AlertDescription>
                Salvar não a reabre — o status "Encerrado" é mantido mesmo que você altere as datas abaixo.
              </AlertDescription>
            </Alert>
          )}

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label>Início</Label>
              <Input
                type="datetime-local"
                value={form.dataLiberacao}
                disabled={form.liberarImediatamente}
                onChange={(e) => {
                  setScheduleChanged(true);
                  setForm((prev) => ({ ...prev, dataLiberacao: e.target.value, liberarImediatamente: false }));
                }}
              />
              <label className="flex items-center gap-2 text-xs text-muted-foreground">
                <Checkbox
                  checked={form.liberarImediatamente}
                  onCheckedChange={(c) => {
                    setScheduleChanged(true);
                    setForm((prev) => ({ ...prev, liberarImediatamente: !!c, dataLiberacao: '' }));
                  }}
                />
                Liberar imediatamente ao salvar
              </label>
            </div>
            <div className="space-y-2">
              <Label>Término</Label>
              <Input
                type="datetime-local"
                value={form.dataEncerramento}
                onChange={(e) => setForm((prev) => ({ ...prev, dataEncerramento: e.target.value }))}
              />
              <p className="text-xs text-muted-foreground">Horário de Brasília (UTC−3).</p>
            </div>
          </div>

          <div className="space-y-2 border-t pt-4">
            <Label>Regra de liberação de desempenho</Label>
            <Select
              value={form.liberacaoDesempenho}
              onValueChange={(v) => setForm((prev) => ({ ...prev, liberacaoDesempenho: v as typeof prev.liberacaoDesempenho }))}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="imediato">Liberar imediatamente ao finalizar</SelectItem>
                <SelectItem value="agendado">Liberar em data específica</SelectItem>
                <SelectItem value="ao_encerrar">Liberar quando o simulado encerrar</SelectItem>
              </SelectContent>
            </Select>
            {form.liberacaoDesempenho === 'agendado' && (
              <Input
                type="datetime-local"
                className="max-w-xs"
                value={form.dataLiberacaoDesempenho}
                onChange={(e) => setForm((prev) => ({ ...prev, dataLiberacaoDesempenho: e.target.value }))}
              />
            )}
          </div>
        </div>

        <div className="flex justify-end gap-2 border-t px-6 py-4">
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            Cancelar
          </Button>
          <Button type="button" onClick={handleSave} disabled={!canSave}>
            {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {mode === 'edit' ? 'Atualizar simulado' : 'Salvar simulado'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
