import { useState, useEffect } from 'react';
import * as XLSXLibStatic from 'xlsx';
import { supabase } from '@/integrations/supabase/client';
import { extractImagesFromXlsx, compressBase64Image } from '@/utils/xlsxImageExtractor';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useToast } from '@/hooks/use-toast';
import { Upload, FileSpreadsheet, Eye, Edit2, Trash2, Download, Plus, CheckCircle, AlertCircle, Loader2, Search, Filter, X, Unlock, StopCircle, Ban } from 'lucide-react';
import { LiberarSimuladoModal } from './LiberarSimuladoModal';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { format } from 'date-fns';
import { datetimeLocalToBrazilISO, brazilISOToDatetimeLocal } from '@/utils/timezone';
import { toBrazilDate } from '@/utils/timezone';
import { Checkbox } from '@/components/ui/checkbox';

// Função para calcular status baseado em datas
const calcularStatusSimulado = (
  dataLiberacao: string | null, 
  dataEncerramento: string | null,
  statusBanco: string
): 'aguardando' | 'ativo' | 'encerrado' => {
  const agora = new Date();
  
  // Se foi manualmente encerrado
  if (statusBanco === 'encerrado') return 'encerrado';
  
  // Se tem data de encerramento e já passou
  if (dataEncerramento && new Date(dataEncerramento) < agora) {
    return 'encerrado';
  }
  
  // Se tem data de liberação e ainda não chegou
  if (dataLiberacao && new Date(dataLiberacao) > agora) {
    return 'aguardando';
  }
  
  // Caso contrário, está ativo
  return 'ativo';
};

interface Simulado {
  id: string;
  nome: string;
  descricao: string | null;
  data_liberacao: string | null;
  data_encerramento: string | null;
  duracao_minutos: number;
  status: 'aguardando' | 'ativo' | 'encerrado';
  created_at: string;
  questoes_count?: number;
  liberacao_desempenho?: 'imediato' | 'agendado' | 'ao_encerrar';
  data_liberacao_desempenho?: string | null;
}

interface EmbeddedImage {
  base64: string;
  mimeType: string;
}

interface Questao {
  id?: string;
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
  imagem_comentario?: string | null;
  observacao: string | null;
  anulada?: boolean;
  /** Apenas no preview (cliente) — não vai pro banco */
  _embeddedEnunciado?: EmbeddedImage;
  /** Apenas no preview (cliente) — não vai pro banco */
  _embeddedComentario?: EmbeddedImage;
}

interface IES {
  id: string;
  nome: string;
}

interface PreviewData {
  questoes: Questao[];
  config: {
    nome: string;
    descricao: string;
    data_liberacao: string;
    data_encerramento: string;
    duracao_minutos: number;
  };
}

export default function SimuladosTab() {
  const { toast } = useToast();
  const [simulados, setSimulados] = useState<Simulado[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [previewData, setPreviewData] = useState<PreviewData | null>(null);
  const [showPreviewModal, setShowPreviewModal] = useState(false);
  const [showConfigModal, setShowConfigModal] = useState(false);
  const [showQuestoesModal, setShowQuestoesModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [selectedSimulado, setSelectedSimulado] = useState<Simulado | null>(null);
  const [questoesVisualizacao, setQuestoesVisualizacao] = useState<Questao[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('todos');
  const [editingQuestao, setEditingQuestao] = useState<Questao | null>(null);
  const [iesList, setIesList] = useState<IES[]>([]);
  const [selectedIESList, setSelectedIESList] = useState<string[]>([]);
  const [showLiberarModal, setShowLiberarModal] = useState(false);
  const [showAnularConfirm, setShowAnularConfirm] = useState(false);
  const [questaoToAnular, setQuestaoToAnular] = useState<Questao | null>(null);
  const [anulando, setAnulando] = useState(false);
  const [editingSimulado, setEditingSimulado] = useState<Simulado | null>(null);
  const [isEditMode, setIsEditMode] = useState(false);

  // Opções de duração fixas (2h, 3h, 4h, 5h, 6h)
  const duracaoOpcoes = [
    { value: 120, label: '2 horas' },
    { value: 180, label: '3 horas' },
    { value: 240, label: '4 horas' },
    { value: 300, label: '5 horas' },
    { value: 360, label: '6 horas' }
  ];

  const configFormInitial = {
    nome: '',
    descricao: '',
    data_liberacao: '',
    data_encerramento: '',
    duracao_minutos: duracaoOpcoes[0].value,
    liberarImediatamente: false,
    liberacao_desempenho: 'imediato' as 'imediato' | 'agendado' | 'ao_encerrar',
    data_liberacao_desempenho: ''
  };

  const [configForm, setConfigForm] = useState(configFormInitial);

  useEffect(() => {
    fetchSimulados();
    fetchIES();
  }, []);

  const fetchIES = async () => {
    try {
      const { data, error } = await supabase
        .from('ies')
        .select('id, nome')
        .order('nome');

      if (error) throw error;
      setIesList(data || []);
    } catch (error: any) {
      console.error('Erro ao carregar IES:', error);
    }
  };

  const fetchSimulados = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('simulados_admin')
        .select('*, questoes_simulado(count)')
        .order('created_at', { ascending: false });

      if (error) throw error;

      const simuladosComContagem = data.map(s => ({
        id: s.id,
        nome: s.nome,
        descricao: s.descricao,
        data_liberacao: s.data_liberacao,
        data_encerramento: s.data_encerramento,
        duracao_minutos: s.duracao_minutos,
        status: calcularStatusSimulado(s.data_liberacao, s.data_encerramento, s.status) as 'aguardando' | 'ativo' | 'encerrado',
        created_at: s.created_at,
        questoes_count: s.questoes_simulado?.[0]?.count || 0,
        liberacao_desempenho: (s.liberacao_desempenho || 'imediato') as 'imediato' | 'agendado' | 'ao_encerrar',
        data_liberacao_desempenho: s.data_liberacao_desempenho
      }));

      setSimulados(simuladosComContagem);
    } catch (error: any) {
      toast({
        title: 'Erro ao carregar simulados',
        description: error.message,
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };

  const handleDownloadTemplate = async () => {
    try {
      const XLSXLib = await loadXLSX();
      
      // Criar dados de exemplo
      const templateData = [
        {
          'numero': 1,
          'Grande Área': 'Clínica Médica',
          'Especialidade': 'Cardiologia',
          'Tema': 'Insuficiência Cardíaca',
          'Enunciado': 'Paciente de 65 anos apresenta dispneia progressiva há 3 meses. Qual o exame inicial mais indicado?',
          'Imagem do Enunciado': '',
          'Alternativa A': 'Radiografia de tórax',
          'Alternativa B': 'Ecocardiograma',
          'Alternativa C': 'Cateterismo cardíaco',
          'Alternativa D': 'Ressonância magnética cardíaca',
          'Gabarito': 'A',
          'Comentário': 'A radiografia de tórax é o exame inicial de escolha para avaliar dispneia, permitindo identificar cardiomegalia e congestão pulmonar.',
          'Imagem do Comentário': ''
        },
        {
          'numero': 2,
          'Grande Área': 'Cirurgia',
          'Especialidade': 'Cirurgia Geral',
          'Tema': 'Apendicite Aguda',
          'Enunciado': 'Qual o tratamento padrão-ouro para apendicite aguda não complicada?',
          'Imagem do Enunciado': '',
          'Alternativa A': 'Antibioticoterapia isolada',
          'Alternativa B': 'Apendicectomia',
          'Alternativa C': 'Drenagem percutânea',
          'Alternativa D': 'Observação clínica',
          'Gabarito': 'B',
          'Comentário': 'A apendicectomia continua sendo o tratamento padrão-ouro para apendicite aguda.',
          'Imagem do Comentário': ''
        }
      ];

      const worksheet = XLSXLib.utils.json_to_sheet(templateData);
      const workbook = XLSXLib.utils.book_new();
      XLSXLib.utils.book_append_sheet(workbook, worksheet, 'Simulado');

      // Ajustar largura das colunas (13 colunas, na ordem do template oficial)
      worksheet['!cols'] = [
        { wch: 10 }, // numero
        { wch: 18 }, // Grande Área
        { wch: 18 }, // Especialidade
        { wch: 22 }, // Tema
        { wch: 50 }, // Enunciado
        { wch: 22 }, // Imagem do Enunciado (cole a imagem dentro da célula)
        { wch: 30 }, // Alt A
        { wch: 30 }, // Alt B
        { wch: 30 }, // Alt C
        { wch: 30 }, // Alt D
        { wch: 12 }, // Gabarito
        { wch: 50 }, // Comentário
        { wch: 22 }  // Imagem do Comentário (cole a imagem dentro da célula)
      ];

      XLSXLib.writeFile(workbook, 'modelo_simulado.xlsx');

      toast({
        title: 'Modelo baixado',
        description: 'Cole imagens diretamente nas colunas "Imagem do Enunciado" e "Imagem do Comentário" (Inserir → Imagem na célula).'
      });
    } catch (error: any) {
      toast({
        title: 'Erro ao gerar modelo',
        description: error.message,
        variant: 'destructive'
      });
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      setUploading(true);
      setUploadProgress(20);

      const reader = new FileReader();
      reader.onload = async (event) => {
        try {
          const arrayBuffer = event.target?.result as ArrayBuffer;
          const XLSXLib = await loadXLSX();
          const workbook = XLSXLib.read(arrayBuffer, { type: 'array' });
          const sheetName = workbook.SheetNames[0];
          const worksheet = workbook.Sheets[sheetName];
          const jsonData = XLSXLib.utils.sheet_to_json(worksheet);

          setUploadProgress(40);

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
            'comentário'
          ];

          const firstRow = jsonData[0] as any;
          const originalKeys = Object.keys(firstRow);
          const columns = originalKeys.map(k => k.toLowerCase().trim());

          const missingColumns = requiredColumns.filter(col => !columns.includes(col));
          if (missingColumns.length > 0) {
            throw new Error(
              `O arquivo está incompleto. Colunas obrigatórias faltando:\n${missingColumns.join(', ')}\n\nColunas esperadas:\n${requiredColumns.join(', ')}`
            );
          }

          // Descobre os índices das colunas de imagem embutida (0-based, igual ao xdr:col).
          // Na planilha oficial, as imagens são coladas DENTRO das colunas "enunciado" e "comentário"
          // (não há colunas dedicadas). Mantemos fallback para o formato antigo.
          let enunciadoColIndex = originalKeys.findIndex(
            k => k.toLowerCase().trim() === 'imagem do enunciado'
          );
          if (enunciadoColIndex < 0) {
            enunciadoColIndex = originalKeys.findIndex(
              k => k.toLowerCase().trim() === 'enunciado'
            );
          }
          let comentarioColIndex = originalKeys.findIndex(
            k => k.toLowerCase().trim() === 'imagem do comentário'
          );
          if (comentarioColIndex < 0) {
            comentarioColIndex = originalKeys.findIndex(
              k => k.toLowerCase().trim() === 'comentário'
            );
          }
          const numeroColIndex = originalKeys.findIndex(
            k => k.toLowerCase().trim() === 'numero'
          );

          // Validação rigorosa da coluna `numero` — chave canônica de vinculação
          // imagem ↔ questão (path no Storage, linha em `questoes_simulado`, render).
          if (numeroColIndex < 0) {
            throw new Error(
              'Coluna obrigatória "numero" não encontrada.\n\n' +
              'Adicione uma coluna chamada exatamente "numero" (sem acentos, em minúsculas) com o número sequencial de cada questão (1, 2, 3...).\n\n' +
              'Sem essa coluna não é possível vincular as imagens embutidas às questões corretas.'
            );
          }

          const numeroErrors: string[] = [];
          const numerosVistos = new Map<number, number>(); // numero → primeira linha onde apareceu
          jsonData.forEach((row: any, idx) => {
            const linhaPlanilha = idx + 2; // +1 header, +1 base 1
            const normalized: any = {};
            Object.keys(row).forEach(k => { normalized[k.toLowerCase().trim()] = row[k]; });
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
            throw new Error(
              `Problemas na coluna "numero":\n\n${preview}${extra}\n\n` +
              'Cada questão deve ter um número único, inteiro e positivo. Esse número é usado para vincular as imagens embutidas.'
            );
          }

          console.log('[SimuladosTab] Colunas de imagem detectadas:', {
            enunciadoColIndex,
            comentarioColIndex,
            numeroColIndex,
            originalKeys,
          });

          setUploadProgress(55);

          let extracted = {
            enunciadoImages: {} as Record<number, { base64: string; mimeType: string }>,
            comentarioImages: {} as Record<number, { base64: string; mimeType: string }>,
            stats: { totalMedia: 0, matchedEnunciado: 0, matchedComentario: 0, skippedNoAnchor: 0, skippedWrongColumn: 0, skippedNoQuestionNumber: 0 }
          };
          if (enunciadoColIndex >= 0 || comentarioColIndex >= 0) {
            try {
              extracted = await extractImagesFromXlsx(arrayBuffer, {
                enunciadoColIndex: enunciadoColIndex >= 0 ? enunciadoColIndex : -1,
                comentarioColIndex: comentarioColIndex >= 0 ? comentarioColIndex : -1,
                numeroColIndex,
              });
              console.log('[SimuladosTab] Imagens extraídas:', extracted.stats);
            } catch (extractErr) {
              console.warn('[SimuladosTab] Falha ao extrair imagens embutidas:', extractErr);
            }
          }

          setUploadProgress(70);

          const questoes: Questao[] = await Promise.all(
            jsonData.map(async (row: any, index) => {
              const normalizedRow: any = {};
              Object.keys(row).forEach(key => {
                normalizedRow[key.toLowerCase().trim()] = row[key];
              });

              const correta = normalizedRow['gabarito']?.toString().toUpperCase();
              if (!correta || !['A', 'B', 'C', 'D'].includes(correta)) {
                throw new Error(
                  `Questão ${index + 1}: Campo "Gabarito" inválido. Deve ser A, B, C ou D. Valor encontrado: "${correta}"`
                );
              }

              // Vinculação imagem ↔ questão pelo NÚMERO DA QUESTÃO (chave canônica),
              // exatamente como o resto do pipeline (Storage path, render no app, PDF).
              const numeroQuestao = Number(normalizedRow['numero']) || (index + 1);
              const rawEnunciado = extracted.enunciadoImages[numeroQuestao];
              const rawComentario = extracted.comentarioImages[numeroQuestao];

              const [embeddedEnunciado, embeddedComentario] = await Promise.all([
                rawEnunciado
                  ? compressBase64Image(rawEnunciado.base64, rawEnunciado.mimeType)
                  : Promise.resolve(undefined),
                rawComentario
                  ? compressBase64Image(rawComentario.base64, rawComentario.mimeType)
                  : Promise.resolve(undefined),
              ]);

              return {
                ordem: index + 1,
                numero_questao: normalizedRow['numero'] || index + 1,
                grande_area: normalizedRow['grande área'] || '',
                especialidade: normalizedRow['especialidade'] || '',
                tema: normalizedRow['tema'] || '',
                competencia: '',
                enunciado: normalizedRow['enunciado'] || '',
                alternativa_a: normalizedRow['alternativa a'] || '',
                alternativa_b: normalizedRow['alternativa b'] || '',
                alternativa_c: normalizedRow['alternativa c'] || '',
                alternativa_d: normalizedRow['alternativa d'] || '',
                alternativa_e: null,
                correta: correta as 'A' | 'B' | 'C' | 'D',
                comentario: normalizedRow['comentário'] || null,
                feedback_corretas: null,
                imagem: null,
                imagem_comentario: null,
                observacao: null,
                _embeddedEnunciado: embeddedEnunciado as any,
                _embeddedComentario: embeddedComentario as any,
              };
            })
          );

          setUploadProgress(90);

          setPreviewData({
            questoes,
            config: {
              nome: file.name.replace('.xlsx', ''),
              descricao: '',
              data_liberacao: '',
              data_encerramento: '',
              duracao_minutos: duracaoOpcoes[0].value
            }
          });

          setUploadProgress(100);
          setShowPreviewModal(true);

          const totalEmbedded = extracted.stats.matchedEnunciado + extracted.stats.matchedComentario;
          if (totalEmbedded > 0) {
            toast({
              title: 'Imagens detectadas',
              description: `${extracted.stats.matchedEnunciado} no enunciado e ${extracted.stats.matchedComentario} no comentário.`,
            });
          } else if (extracted.stats.totalMedia > 0) {
            toast({
              title: 'Imagens não vinculadas',
              description: `Detectamos ${extracted.stats.totalMedia} imagem(ns) no arquivo, mas nenhuma está ancorada nas colunas "Enunciado" (índice ${enunciadoColIndex}) ou "Comentário" (índice ${comentarioColIndex}). Verifique o console (F12) para detalhes do formato.`,
              variant: 'destructive',
            });
          }
        } catch (error: any) {
          toast({
            title: 'Erro ao processar arquivo',
            description: error.message,
            variant: 'destructive'
          });
        } finally {
          setUploading(false);
          setUploadProgress(0);
        }
      };

      reader.readAsArrayBuffer(file);
    } catch (error: any) {
      toast({
        title: 'Erro no upload',
        description: error.message,
        variant: 'destructive'
      });
      setUploading(false);
      setUploadProgress(0);
    }
  };

  const handleConfirmPreview = () => {
    if (previewData) {
      setConfigForm({
        ...configFormInitial,
        ...previewData.config
      });
      setIsEditMode(false);
      setEditingSimulado(null);
      setShowPreviewModal(false);
      setShowConfigModal(true);
    }
  };

  const handleEditSimulado = async (simulado: Simulado) => {
    try {
      // Buscar dados completos do simulado incluindo ies_ids
      const { data, error } = await supabase
        .from('simulados_admin')
        .select('*')
        .eq('id', simulado.id)
        .single();

      if (error) throw error;

      // Configurar formulário com dados existentes
      // Se a data de liberação é igual ou anterior a agora, considera como "liberar imediatamente"
      const agora = new Date();
      const dataLib = data.data_liberacao ? new Date(data.data_liberacao) : null;
      const liberarImediatamente = dataLib ? dataLib <= agora : false;
      
      setConfigForm({
        nome: data.nome,
        descricao: data.descricao || '',
        data_liberacao: data.data_liberacao ? brazilISOToDatetimeLocal(data.data_liberacao) : '',
        data_encerramento: data.data_encerramento ? brazilISOToDatetimeLocal(data.data_encerramento) : '',
        duracao_minutos: data.duracao_minutos,
        liberarImediatamente,
        liberacao_desempenho: (data as any).liberacao_desempenho || 'imediato',
        data_liberacao_desempenho: (data as any).data_liberacao_desempenho 
          ? brazilISOToDatetimeLocal((data as any).data_liberacao_desempenho) 
          : ''
      });

      // Configurar IES selecionadas
      setSelectedIESList(data.ies_ids || []);

      // Configurar modo de edição
      setEditingSimulado(simulado);
      setIsEditMode(true);
      setShowConfigModal(true);
    } catch (error: any) {
      toast({
        title: 'Erro ao carregar simulado',
        description: error.message,
        variant: 'destructive'
      });
    }
  };

  const handleSaveSimulado = async () => {
    // Para edição, não precisa de previewData
    if (!isEditMode && !previewData) {
      toast({
        title: 'Erro',
        description: 'Dados do simulado não encontrados',
        variant: 'destructive'
      });
      return;
    }

    if (!configForm.nome) {
      toast({
        title: 'Erro',
        description: 'Nome do simulado é obrigatório',
        variant: 'destructive'
      });
      return;
    }

    if (!selectedIESList || selectedIESList.length === 0) {
      toast({
        title: 'Erro',
        description: 'Selecione pelo menos uma IES para receber este simulado',
        variant: 'destructive'
      });
      return;
    }

    try {
      setUploading(true);

      // Converter datas para timezone de Brasília
      const agora = new Date();
      let dataLiberacaoISO: string | null;
      let statusCalculado: 'aguardando' | 'ativo' | 'encerrado';
      
      // Calcular status baseado nas condições
      if (configForm.liberarImediatamente) {
        // Liberação imediata = ativo agora
        dataLiberacaoISO = agora.toISOString();
        statusCalculado = 'ativo';
      } else if (configForm.data_liberacao) {
        dataLiberacaoISO = datetimeLocalToBrazilISO(configForm.data_liberacao);
        // Se data de liberação é no futuro, aguardando
        if (new Date(dataLiberacaoISO) > agora) {
          statusCalculado = 'aguardando';
        } else {
          statusCalculado = 'ativo';
        }
      } else {
        dataLiberacaoISO = null;
        statusCalculado = 'ativo';
      }
      
      const dataEncerramentoISO = configForm.data_encerramento
        ? datetimeLocalToBrazilISO(configForm.data_encerramento)
        : null;

      // Preparar data de liberação de desempenho
      const dataLiberacaoDesempenhoISO = configForm.liberacao_desempenho === 'agendado' && configForm.data_liberacao_desempenho
        ? datetimeLocalToBrazilISO(configForm.data_liberacao_desempenho)
        : null;

      if (isEditMode && editingSimulado) {
        // Atualizar simulado existente
        const { error: updateError } = await supabase
          .from('simulados_admin')
          .update({
            nome: configForm.nome,
            descricao: configForm.descricao || null,
            data_liberacao: dataLiberacaoISO,
            data_encerramento: dataEncerramentoISO,
            duracao_minutos: configForm.duracao_minutos,
            status: statusCalculado,
            ies_ids: selectedIESList,
            liberacao_desempenho: configForm.liberacao_desempenho,
            data_liberacao_desempenho: dataLiberacaoDesempenhoISO
          })
          .eq('id', editingSimulado.id);

        if (updateError) throw updateError;

        toast({
          title: 'Simulado atualizado!',
          description: 'As configurações foram salvas com sucesso.'
        });
      } else {
        // Criar simulado novo
        const { data: simulado, error: simuladoError } = await supabase
          .from('simulados_admin')
          .insert({
            nome: configForm.nome,
            descricao: configForm.descricao || null,
            data_liberacao: dataLiberacaoISO,
            data_encerramento: dataEncerramentoISO,
            duracao_minutos: configForm.duracao_minutos,
            status: statusCalculado,
            ies_ids: selectedIESList,
            liberacao_desempenho: configForm.liberacao_desempenho,
            data_liberacao_desempenho: dataLiberacaoDesempenhoISO
          })
          .select()
          .single();

        if (simuladoError) throw simuladoError;

        // Upload de imagens embutidas (se houver) e inserção das questões
        if (previewData) {
          // 1. Coleta todas as imagens base64 para envio à edge function
          const imagesPayload: Array<{ ordem: number; slot: 'enunciado' | 'comentario'; data: string; mime: string }> = [];
          for (const q of previewData.questoes) {
            if (q._embeddedEnunciado) {
              imagesPayload.push({
                ordem: q.ordem,
                slot: 'enunciado',
                data: q._embeddedEnunciado.base64,
                mime: q._embeddedEnunciado.mimeType,
              });
            }
            if (q._embeddedComentario) {
              imagesPayload.push({
                ordem: q.ordem,
                slot: 'comentario',
                data: q._embeddedComentario.base64,
                mime: q._embeddedComentario.mimeType,
              });
            }
          }

          // Mapa ordem → { enunciado, comentario } com URLs vindas do Storage
          const urlsByOrdem: Record<number, { enunciado?: string; comentario?: string }> = {};

          if (imagesPayload.length > 0) {
            try {
              const { data: uploadData, error: uploadError } = await supabase.functions.invoke(
                'admin-upload-simulado-images',
                { body: { simulado_id: simulado.id, images: imagesPayload } }
              );
              if (uploadError) throw uploadError;
              const returnedUrls = (uploadData?.urls ?? []) as Array<{ ordem: number; slot: 'enunciado' | 'comentario'; url: string }>;
              for (const u of returnedUrls) {
                if (!urlsByOrdem[u.ordem]) urlsByOrdem[u.ordem] = {};
                urlsByOrdem[u.ordem][u.slot] = u.url;
              }
              const uploadErrors = (uploadData?.errors ?? []) as Array<{ ordem: number; message: string }>;
              if (uploadErrors.length > 0) {
                console.warn('[SimuladosTab] Falhas parciais no upload de imagens:', uploadErrors);
                toast({
                  title: 'Algumas imagens falharam',
                  description: `${uploadErrors.length} imagem(ns) não foram enviadas. As questões serão criadas sem elas.`,
                  variant: 'destructive',
                });
              }
            } catch (imgErr: any) {
              // Rollback do simulado para não deixar órfão
              await supabase.from('simulados_admin').delete().eq('id', simulado.id);
              throw new Error(`Falha no upload das imagens: ${imgErr?.message ?? imgErr}. O simulado foi revertido — tente novamente.`);
            }
          }

          // 2. Monta payload final, removendo campos internos e injetando URLs
          const questoesComSimuladoId = previewData.questoes.map(q => {
            const { _embeddedEnunciado, _embeddedComentario, ...clean } = q;
            const slotUrls = urlsByOrdem[q.ordem] ?? {};
            return {
              ...clean,
              simulado_id: simulado.id,
              imagem: slotUrls.enunciado ?? clean.imagem ?? null,
              imagem_comentario: slotUrls.comentario ?? clean.imagem_comentario ?? null,
            };
          });

          const { error: questoesError } = await supabase
            .from('questoes_simulado')
            .insert(questoesComSimuladoId);

          if (questoesError) {
            // Rollback se a inserção falhar
            await supabase.from('simulados_admin').delete().eq('id', simulado.id);
            throw questoesError;
          }
        }

        toast({
          title: 'Simulado criado com sucesso!',
          description: previewData ? `${previewData.questoes.length} questões foram adicionadas.` : 'Simulado criado.'
        });
      }

      setShowConfigModal(false);
      setPreviewData(null);
      setSelectedIESList([]);
      setEditingSimulado(null);
      setIsEditMode(false);
      setConfigForm(configFormInitial);
      fetchSimulados();
    } catch (error: any) {
      toast({
        title: 'Erro ao salvar simulado',
        description: error.message,
        variant: 'destructive'
      });
    } finally {
      setUploading(false);
    }
  };

  const handleVisualizarQuestoes = async (simulado: Simulado) => {
    try {
      const { data, error } = await supabase
        .from('questoes_simulado')
        .select('*')
        .eq('simulado_id', simulado.id)
        .order('ordem');

      if (error) throw error;

      const questoesFormatadas = (data || []).map(q => ({
        id: q.id,
        ordem: q.ordem,
        enunciado: q.enunciado,
        alternativa_a: q.alternativa_a,
        alternativa_b: q.alternativa_b,
        alternativa_c: q.alternativa_c,
        alternativa_d: q.alternativa_d,
        alternativa_e: q.alternativa_e,
        correta: q.correta as 'A' | 'B' | 'C' | 'D' | 'E',
        comentario: q.comentario,
        feedback_corretas: q.feedback_corretas,
        imagem: q.imagem,
        imagem_comentario: (q as any).imagem_comentario ?? null,
        observacao: q.observacao,
        anulada: q.anulada ?? false
      }));

      setQuestoesVisualizacao(questoesFormatadas);
      setSelectedSimulado(simulado);
      setShowQuestoesModal(true);
    } catch (error: any) {
      toast({
        title: 'Erro ao carregar questões',
        description: error.message,
        variant: 'destructive'
      });
    }
  };

  const handleDeleteSimulado = async () => {
    if (!selectedSimulado) return;

    try {
      const { error } = await supabase
        .from('simulados_admin')
        .delete()
        .eq('id', selectedSimulado.id);

      if (error) throw error;

      toast({
        title: 'Simulado excluído',
        description: 'O simulado e todas as suas questões foram removidos.'
      });

      setShowDeleteModal(false);
      setSelectedSimulado(null);
      fetchSimulados();
    } catch (error: any) {
      toast({
        title: 'Erro ao excluir',
        description: error.message,
        variant: 'destructive'
      });
    }
  };

  const handleSaveQuestao = async () => {
    if (!editingQuestao || !editingQuestao.id) return;

    try {
      const { error } = await supabase
        .from('questoes_simulado')
        .update({
          enunciado: editingQuestao.enunciado,
          alternativa_a: editingQuestao.alternativa_a,
          alternativa_b: editingQuestao.alternativa_b,
          alternativa_c: editingQuestao.alternativa_c,
          alternativa_d: editingQuestao.alternativa_d,
          alternativa_e: editingQuestao.alternativa_e,
          correta: editingQuestao.correta,
          comentario: editingQuestao.comentario,
          grande_area: editingQuestao.grande_area,
          especialidade: editingQuestao.especialidade,
          tema: editingQuestao.tema,
          imagem: editingQuestao.imagem
        })
        .eq('id', editingQuestao.id);

      if (error) throw error;

      toast({
        title: 'Questão atualizada!',
        description: 'As alterações foram salvas com sucesso.'
      });

      // Atualizar a lista de questões na visualização
      setQuestoesVisualizacao(prev => 
        prev.map(q => q.id === editingQuestao.id ? editingQuestao : q)
      );
      setEditingQuestao(null);
    } catch (error: any) {
      toast({
        title: 'Erro ao salvar questão',
        description: error.message,
        variant: 'destructive'
      });
    }
  };

  const handleEncerrarSimulado = async (simulado: Simulado) => {
    try {
      const { error } = await supabase
        .from('simulados_admin')
        .update({ status: 'encerrado' })
        .eq('id', simulado.id);

      if (error) throw error;

      toast({
        title: 'Simulado encerrado',
        description: 'O simulado foi encerrado e não está mais disponível para os alunos.'
      });

      fetchSimulados();
    } catch (error: any) {
      toast({
        title: 'Erro ao encerrar simulado',
        description: error.message,
        variant: 'destructive'
      });
    }
  };

  const handleAnularQuestao = async () => {
    if (!questaoToAnular?.id) return;

    try {
      setAnulando(true);

      // 1. Marcar a questão como anulada
      const { error: updateQuestaoError } = await supabase
        .from('questoes_simulado')
        .update({ anulada: true })
        .eq('id', questaoToAnular.id);

      if (updateQuestaoError) throw updateQuestaoError;

      // 2. Atualizar todas as respostas existentes para correct = true
      const { error: updateRespostasError } = await supabase
        .from('answer_progress')
        .update({ correct: true })
        .eq('question_id', questaoToAnular.id);

      if (updateRespostasError) {
        console.error('Erro ao atualizar respostas:', updateRespostasError);
        // Não bloquear - pode não haver respostas ainda
      }

      // 3. Atualizar estado local
      setQuestoesVisualizacao(prev => 
        prev.map(q => q.id === questaoToAnular.id ? { ...q, anulada: true } : q)
      );

      toast({
        title: 'Questão anulada com sucesso',
        description: 'Todos os alunos receberão pontuação para esta questão.'
      });

      setShowAnularConfirm(false);
      setQuestaoToAnular(null);
    } catch (error: any) {
      toast({
        title: 'Erro ao anular questão',
        description: error.message,
        variant: 'destructive'
      });
    } finally {
      setAnulando(false);
    }
  };

  const handleExportSimulado = async (simulado: Simulado) => {
    try {
      const { data: questoes, error } = await supabase
        .from('questoes_simulado')
        .select('*')
        .eq('simulado_id', simulado.id)
        .order('ordem');

      if (error) throw error;

      const exportData = questoes?.map(q => ({
        ENUNCIADO: q.enunciado,
        A: q.alternativa_a,
        B: q.alternativa_b,
        C: q.alternativa_c,
        D: q.alternativa_d,
        E: q.alternativa_e || '',
        CORRETA: q.correta,
        'Feedback das respostas corretas': q.feedback_corretas || '',
        'IMAGEM DA QUESTÃO': q.imagem || '',
        'OBSERVAÇÃO': q.observacao || ''
      }));

          const XLSXLib = await loadXLSX();
          const ws = XLSXLib.utils.json_to_sheet(exportData || []);
          const wb = XLSXLib.utils.book_new();
          XLSXLib.utils.book_append_sheet(wb, ws, 'Questões');
          XLSXLib.writeFile(wb, `${simulado.nome}.xlsx`);

      toast({
        title: 'Exportação concluída',
        description: 'O arquivo foi baixado com sucesso.'
      });
    } catch (error: any) {
      toast({
        title: 'Erro na exportação',
        description: error.message,
        variant: 'destructive'
      });
    }
  };

  const getStatusBadge = (simulado: Simulado) => {
    const statusAtual = simulado.status;
    
    const variants: Record<string, { variant: any; label: string; icon: string }> = {
      ativo: { variant: 'default', label: 'Ativo', icon: '🟢' },
      aguardando: { variant: 'secondary', label: 'Aguardando', icon: '🟡' },
      encerrado: { variant: 'destructive', label: 'Encerrado', icon: '🔴' }
    };

    const config = variants[statusAtual] || variants.aguardando;
    return (
      <Badge variant={config.variant}>
        {config.icon} {config.label}
      </Badge>
    );
  };

  const getLiberacaoDesempenhoBadge = (simulado: Simulado) => {
    const liberacao = simulado.liberacao_desempenho || 'imediato';
    
    const liberacaoConfig: Record<string, { label: string; className: string; sublabel?: string }> = {
      imediato: { label: 'Imediato', className: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200' },
      agendado: { 
        label: 'Agendado', 
        className: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
        sublabel: simulado.data_liberacao_desempenho 
          ? format(toBrazilDate(simulado.data_liberacao_desempenho), 'dd/MM HH:mm')
          : undefined
      },
      ao_encerrar: { label: 'Ao Encerrar', className: 'bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200' }
    };

    const config = liberacaoConfig[liberacao] || liberacaoConfig.imediato;
    return (
      <div className="flex flex-col gap-0.5">
        <Badge variant="outline" className={config.className}>
          {config.label}
        </Badge>
        {config.sublabel && (
          <span className="text-xs text-muted-foreground">{config.sublabel}</span>
        )}
      </div>
    );
  };

  const filteredSimulados = simulados.filter(s => {
    const matchesSearch = s.nome.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === 'todos' || s.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <FileSpreadsheet className="h-6 w-6 text-primary" />
              Gerenciamento de Simulados
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowLiberarModal(true)}
              className="gap-2"
            >
              <Unlock className="h-4 w-4" />
              Liberar Simulado
            </Button>
          </CardTitle>
          <CardDescription>
            Faça upload, edite e gerencie simulados completos em formato .xlsx
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Upload Section */}
          <div className="border-2 border-dashed rounded-xl p-8 text-center hover:border-primary/50 transition-colors">
            <Upload className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
            <h3 className="font-semibold mb-2">Upload de Simulado</h3>
            <p className="text-sm text-muted-foreground mb-4">
              Arraste um arquivo .xlsx ou clique para selecionar
            </p>
            <div className="flex flex-col items-center gap-3">
              <Input
                type="file"
                accept=".xlsx,.xls"
                onChange={handleFileUpload}
                disabled={uploading}
                className="max-w-xs cursor-pointer"
              />
              <Button
                variant="outline"
                size="sm"
                onClick={handleDownloadTemplate}
                className="gap-2"
              >
                <Download className="h-4 w-4" />
                Baixar arquivo modelo
              </Button>
            </div>
            {uploading && (
              <div className="mt-4 space-y-2">
                <div className="w-full bg-secondary rounded-full h-2 overflow-hidden">
                  <div
                    className="bg-primary h-full transition-all duration-300"
                    style={{ width: `${uploadProgress}%` }}
                  />
                </div>
                <p className="text-sm text-muted-foreground flex items-center justify-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Processando arquivo... {uploadProgress}%
                </p>
              </div>
            )}
          </div>

          {/* Filters */}
          <div className="flex gap-4">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar simulados..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[180px]">
                <Filter className="h-4 w-4 mr-2" />
                <SelectValue placeholder="Filtrar por status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos</SelectItem>
                <SelectItem value="aguardando">Aguardando</SelectItem>
                <SelectItem value="ativo">Ativos</SelectItem>
                <SelectItem value="encerrado">Encerrados</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Simulados List */}
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : filteredSimulados.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <FileSpreadsheet className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>Nenhum simulado encontrado</p>
            </div>
          ) : (
            <div className="rounded-lg border overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nome</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Questões</TableHead>
                    <TableHead>Lib. Desempenho</TableHead>
                    <TableHead>Data de Criação</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredSimulados.map((simulado) => (
                    <TableRow key={simulado.id}>
                      <TableCell className="font-medium">{simulado.nome}</TableCell>
                      <TableCell>{getStatusBadge(simulado)}</TableCell>
                      <TableCell>{simulado.questoes_count || 0}</TableCell>
                      <TableCell>
                        {getLiberacaoDesempenhoBadge(simulado)}
                      </TableCell>
                      <TableCell>
                        {format(toBrazilDate(simulado.created_at), 'dd/MM/yyyy')}
                      </TableCell>
                        <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleVisualizarQuestoes(simulado)}
                            title="Visualizar questões"
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleEditSimulado(simulado)}
                            title="Editar configurações"
                          >
                            <Edit2 className="h-4 w-4 text-primary" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleExportSimulado(simulado)}
                            title="Exportar questões"
                          >
                            <Download className="h-4 w-4" />
                          </Button>
                          {simulado.status === 'ativo' && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleEncerrarSimulado(simulado)}
                              title="Encerrar simulado"
                            >
                              <StopCircle className="h-4 w-4 text-red-500" />
                            </Button>
                          )}
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              setSelectedSimulado(simulado);
                              setShowDeleteModal(true);
                            }}
                            title="Excluir simulado"
                          >
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Preview Modal */}
      <Dialog open={showPreviewModal} onOpenChange={setShowPreviewModal}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CheckCircle className="h-5 w-5 text-green-500" />
              Pré-visualização do Upload
            </DialogTitle>
            <DialogDescription>
              Revise as primeiras 3 questões antes de confirmar
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            {previewData?.questoes.slice(0, 3).map((questao, index) => (
              <Card key={index}>
                <CardHeader>
                  <CardTitle className="text-sm">Questão {questao.ordem}</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3 text-sm">
                  {/* Metadados da questão */}
                  <div className="grid grid-cols-2 gap-2 text-xs border-b pb-3">
                    <div>
                      <span className="font-semibold text-muted-foreground">Grande Área:</span>
                      <p>{questao.grande_area || 'N/A'}</p>
                    </div>
                    <div>
                      <span className="font-semibold text-muted-foreground">Especialidade:</span>
                      <p>{questao.especialidade || 'N/A'}</p>
                    </div>
                    <div>
                      <span className="font-semibold text-muted-foreground">Tema:</span>
                      <p>{questao.tema || 'N/A'}</p>
                    </div>
                    <div className="col-span-2">
                      <span className="font-semibold text-muted-foreground">Competência:</span>
                      <p>{questao.competencia || 'N/A'}</p>
                    </div>
                  </div>

                  {/* Enunciado */}
                  <div>
                    <p className="font-medium">{questao.enunciado}</p>
                  </div>

                  {/* Imagem/Gráfico/Tabela (URL legacy) */}
                  {questao.imagem && (
                    <div>
                      <img 
                        src={questao.imagem} 
                        alt="Imagem/Gráfico/Tabela da questão" 
                        className="max-w-full h-auto rounded-lg border"
                      />
                    </div>
                  )}

                  {/* Imagem do Enunciado (embutida no XLSX) */}
                  {questao._embeddedEnunciado && (
                    <div>
                      <p className="text-xs font-semibold text-muted-foreground mb-1">Imagem do enunciado (embutida):</p>
                      <img
                        src={`data:${questao._embeddedEnunciado.mimeType};base64,${questao._embeddedEnunciado.base64}`}
                        alt="Imagem do enunciado"
                        className="max-w-xs h-auto rounded-lg border"
                      />
                    </div>
                  )}

                  {/* Alternativas */}
                  <div className="space-y-1 pl-4">
                    <p className={questao.correta === 'A' ? 'text-green-600 font-semibold' : ''}>
                      A) {questao.alternativa_a}
                    </p>
                    <p className={questao.correta === 'B' ? 'text-green-600 font-semibold' : ''}>
                      B) {questao.alternativa_b}
                    </p>
                    <p className={questao.correta === 'C' ? 'text-green-600 font-semibold' : ''}>
                      C) {questao.alternativa_c}
                    </p>
                    <p className={questao.correta === 'D' ? 'text-green-600 font-semibold' : ''}>
                      D) {questao.alternativa_d}
                    </p>
                  </div>

                  {/* Resposta Correta */}
                  <div className="border-t pt-2">
                    <p className="text-green-600 font-medium">✓ Alternativa Correta: {questao.correta}</p>
                  </div>

                  {/* Comentário */}
                  {questao.comentario && (
                    <div className="bg-muted/50 p-2 rounded">
                      <p className="text-xs font-semibold text-muted-foreground mb-1">Comentário:</p>
                      <p className="text-xs">{questao.comentario}</p>
                    </div>
                  )}

                  {/* Imagem do Comentário (embutida no XLSX) */}
                  {questao._embeddedComentario && (
                    <div>
                      <p className="text-xs font-semibold text-muted-foreground mb-1">Imagem do comentário (embutida):</p>
                      <img
                        src={`data:${questao._embeddedComentario.mimeType};base64,${questao._embeddedComentario.base64}`}
                        alt="Imagem do comentário"
                        className="max-w-xs h-auto rounded-lg border"
                      />
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
            {previewData && previewData.questoes.length > 3 && (
              <p className="text-center text-muted-foreground">
                ... e mais {previewData.questoes.length - 3} questões
              </p>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowPreviewModal(false)}>
              Cancelar
            </Button>
            <Button onClick={handleConfirmPreview}>
              Confirmar e Configurar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Config Modal */}
      <Dialog open={showConfigModal} onOpenChange={setShowConfigModal}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Edit2 className="h-5 w-5 text-primary" />
              {isEditMode ? 'Editar Simulado' : 'Configurar Simulado'}
            </DialogTitle>
            <DialogDescription>
              {isEditMode 
                ? `Atualize as configurações do simulado "${editingSimulado?.nome}"`
                : 'Defina as informações do simulado antes de salvar'
              }
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 px-1">
            <div>
              <Label>Nome do Simulado *</Label>
              <Input
                value={configForm.nome}
                onChange={(e) => setConfigForm({ ...configForm, nome: e.target.value })}
                placeholder="Ex: Simulado ENAMED 2024"
              />
            </div>
            <div>
              <Label>Descrição</Label>
              <Textarea
                value={configForm.descricao}
                onChange={(e) => setConfigForm({ ...configForm, descricao: e.target.value })}
                placeholder="Descrição opcional do simulado"
              />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label>Data de Liberação</Label>
                <Input
                  type="datetime-local"
                  value={configForm.data_liberacao}
                  onChange={(e) => setConfigForm({ 
                    ...configForm, 
                    data_liberacao: e.target.value,
                    liberarImediatamente: false 
                  })}
                  className="w-full"
                  disabled={configForm.liberarImediatamente}
                />
                <div className="flex items-center gap-2 mt-2">
                  <Checkbox
                    id="liberar-imediatamente"
                    checked={configForm.liberarImediatamente}
                    onCheckedChange={(checked) => setConfigForm({
                      ...configForm,
                      liberarImediatamente: !!checked,
                      data_liberacao: ''
                    })}
                  />
                  <label htmlFor="liberar-imediatamente" className="text-xs text-muted-foreground cursor-pointer">
                    Liberar imediatamente ao salvar
                  </label>
                </div>
              </div>
              <div>
                <Label>Data de Encerramento (opcional)</Label>
                <Input
                  type="datetime-local"
                  value={configForm.data_encerramento}
                  onChange={(e) => setConfigForm({ ...configForm, data_encerramento: e.target.value })}
                  className="w-full"
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Horário de Brasília (UTC−3)
                </p>
              </div>
            </div>

            <div>
              <Label className="text-sm md:text-base">IES Responsáveis * (Múltipla seleção)</Label>
              <div className="border rounded-md p-3 md:p-4 max-h-40 md:max-h-48 overflow-y-auto space-y-2 bg-background">
                {iesList.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Carregando IES...</p>
                ) : (
                  iesList.map(ies => (
                    <div key={ies.id} className="flex items-center space-x-2 py-1">
                      <Checkbox
                        id={`ies-${ies.id}`}
                        checked={selectedIESList.includes(ies.id)}
                        onCheckedChange={(checked) => {
                          if (checked) {
                            setSelectedIESList([...selectedIESList, ies.id]);
                          } else {
                            setSelectedIESList(selectedIESList.filter(id => id !== ies.id));
                          }
                        }}
                      />
                      <label
                        htmlFor={`ies-${ies.id}`}
                        className="text-xs md:text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer flex-1"
                      >
                        {ies.nome}
                      </label>
                    </div>
                  ))
                )}
              </div>
              {selectedIESList.length === 0 && (
                <p className="text-xs text-destructive mt-1">
                  ⚠️ Selecione pelo menos uma IES para receber este simulado
                </p>
              )}
              {selectedIESList.length > 0 && (
                <p className="text-xs text-muted-foreground mt-1">
                  ✓ {selectedIESList.length} IES selecionada(s)
                </p>
              )}
            </div>

            <div>
              <Label>Duração da Prova *</Label>
              <Select 
                value={configForm.duracao_minutos.toString()} 
                onValueChange={(value) => setConfigForm({ ...configForm, duracao_minutos: parseInt(value) })}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Selecione a duração" />
                </SelectTrigger>
                <SelectContent className="z-50 bg-background">
                  {duracaoOpcoes.map(opcao => (
                    <SelectItem key={opcao.value} value={opcao.value.toString()}>
                      {opcao.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground mt-1">
                Selecione entre 2h e 6h (incrementos de 1 hora)
              </p>
            </div>

            {/* Seção de Liberação de Desempenho */}
            <div className="border-t pt-4">
              <Label className="text-sm font-semibold mb-3 block">Liberação do Desempenho</Label>
              <div className="space-y-3">
                <div className="flex items-start gap-3">
                  <input
                    type="radio"
                    id="desempenho-imediato"
                    name="liberacao_desempenho"
                    value="imediato"
                    checked={configForm.liberacao_desempenho === 'imediato'}
                    onChange={(e) => setConfigForm({ 
                      ...configForm, 
                      liberacao_desempenho: e.target.value as 'imediato' | 'agendado' | 'ao_encerrar',
                      data_liberacao_desempenho: ''
                    })}
                    className="mt-1"
                  />
                  <div>
                    <label htmlFor="desempenho-imediato" className="text-sm font-medium cursor-pointer">
                      Liberar imediatamente
                    </label>
                    <p className="text-xs text-muted-foreground">
                      O aluno pode ver o desempenho assim que finalizar.
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <input
                    type="radio"
                    id="desempenho-agendado"
                    name="liberacao_desempenho"
                    value="agendado"
                    checked={configForm.liberacao_desempenho === 'agendado'}
                    onChange={(e) => setConfigForm({ 
                      ...configForm, 
                      liberacao_desempenho: e.target.value as 'imediato' | 'agendado' | 'ao_encerrar'
                    })}
                    className="mt-1"
                  />
                  <div className="flex-1">
                    <label htmlFor="desempenho-agendado" className="text-sm font-medium cursor-pointer">
                      Liberar em data específica
                    </label>
                    <p className="text-xs text-muted-foreground mb-2">
                      O desempenho será liberado na data/hora definida.
                    </p>
                    {configForm.liberacao_desempenho === 'agendado' && (
                      <Input
                        type="datetime-local"
                        value={configForm.data_liberacao_desempenho}
                        onChange={(e) => setConfigForm({ ...configForm, data_liberacao_desempenho: e.target.value })}
                        className="max-w-xs"
                      />
                    )}
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <input
                    type="radio"
                    id="desempenho-encerrar"
                    name="liberacao_desempenho"
                    value="ao_encerrar"
                    checked={configForm.liberacao_desempenho === 'ao_encerrar'}
                    onChange={(e) => setConfigForm({ 
                      ...configForm, 
                      liberacao_desempenho: e.target.value as 'imediato' | 'agendado' | 'ao_encerrar',
                      data_liberacao_desempenho: ''
                    })}
                    className="mt-1"
                  />
                  <div>
                    <label htmlFor="desempenho-encerrar" className="text-sm font-medium cursor-pointer">
                      Liberar quando encerrar
                    </label>
                    <p className="text-xs text-muted-foreground">
                      O desempenho será liberado automaticamente quando o simulado mudar para status "encerrado".
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
          <DialogFooter className="flex-col sm:flex-row gap-2 sm:gap-0">
            <Button 
              variant="outline" 
              onClick={() => {
                setShowConfigModal(false);
                setIsEditMode(false);
                setEditingSimulado(null);
                setSelectedIESList([]);
                setConfigForm(configFormInitial);
              }}
              className="w-full sm:w-auto"
            >
              Cancelar
            </Button>
            <Button 
              onClick={handleSaveSimulado} 
              disabled={uploading}
              className="w-full sm:w-auto"
            >
              {uploading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              {isEditMode ? 'Atualizar Simulado' : 'Salvar Simulado'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Questões Modal */}
      <Dialog open={showQuestoesModal} onOpenChange={setShowQuestoesModal}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Questões - {selectedSimulado?.nome}</DialogTitle>
            <DialogDescription>
              {questoesVisualizacao.length} questões cadastradas
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            {questoesVisualizacao.map((questao, index) => (
              <Card key={questao.id || index} className={questao.anulada ? 'border-purple-500/50 bg-purple-500/5' : ''}>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <CardTitle className="text-sm">Questão {questao.ordem}</CardTitle>
                      {questao.anulada && (
                        <Badge variant="secondary" className="bg-purple-500/10 text-purple-500 border-purple-500/30">
                          <Ban className="h-3 w-3 mr-1" />
                          ANULADA
                        </Badge>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setEditingQuestao(questao)}
                      >
                        <Edit2 className="h-4 w-4" />
                      </Button>
                      {!questao.anulada && questao.id && (
                        <Button
                          variant="outline"
                          size="sm"
                          className="text-destructive hover:bg-destructive/10"
                          onClick={() => {
                            setQuestaoToAnular(questao);
                            setShowAnularConfirm(true);
                          }}
                        >
                          <Ban className="h-4 w-4 mr-1" />
                          Anular
                        </Button>
                      )}
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-2 text-sm">
                  <p className="font-medium">{questao.enunciado}</p>
                  {questao.imagem && (
                    <img 
                      src={questao.imagem} 
                      alt="Imagem da questão" 
                      className="max-w-full h-auto rounded-lg border"
                    />
                  )}
                  <div className="space-y-1 pl-4">
                    <p>A) {questao.alternativa_a}</p>
                    <p>B) {questao.alternativa_b}</p>
                    <p>C) {questao.alternativa_c}</p>
                    <p>D) {questao.alternativa_d}</p>
                    {questao.alternativa_e && <p>E) {questao.alternativa_e}</p>}
                  </div>
                  <p className={questao.anulada ? "text-purple-500 font-medium" : "text-green-600 font-medium"}>
                    {questao.anulada ? 'Questão anulada - todos os alunos recebem pontuação' : `Correta: ${questao.correta}`}
                  </p>
                  {questao.feedback_corretas && (
                    <p className="text-blue-600 text-xs italic">Feedback: {questao.feedback_corretas}</p>
                  )}
                  {questao.observacao && (
                    <p className="text-muted-foreground text-xs italic">Obs: {questao.observacao}</p>
                  )}
                  {questao.comentario && (
                    <p className="text-muted-foreground italic">{questao.comentario}</p>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete Modal */}
      <Dialog open={showDeleteModal} onOpenChange={setShowDeleteModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertCircle className="h-5 w-5 text-destructive" />
              Confirmar Exclusão
            </DialogTitle>
            <DialogDescription>
              Tem certeza que deseja excluir o simulado "{selectedSimulado?.nome}"?
              Esta ação não pode ser desfeita e todas as questões serão removidas.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDeleteModal(false)}>
              Cancelar
            </Button>
            <Button variant="destructive" onClick={handleDeleteSimulado}>
              Excluir Simulado
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal de Liberar Simulado */}
      <LiberarSimuladoModal
        open={showLiberarModal}
        onClose={() => setShowLiberarModal(false)}
      />

      {/* Modal de Confirmação de Anulação */}
      <Dialog open={showAnularConfirm} onOpenChange={setShowAnularConfirm}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Ban className="h-5 w-5 text-purple-500" />
              Anular Questão
            </DialogTitle>
            <DialogDescription className="space-y-2">
              <p>
                Tem certeza que deseja anular a <strong>Questão {questaoToAnular?.ordem}</strong>?
              </p>
              <p className="text-sm">
                Esta ação irá:
              </p>
              <ul className="list-disc list-inside text-sm text-muted-foreground">
                <li>Marcar a questão como anulada</li>
                <li>Contabilizar como correta para TODOS os alunos que já responderam</li>
                <li>Contabilizar como correta para alunos que responderem no futuro</li>
              </ul>
              <p className="text-sm text-destructive font-medium">
                ⚠️ Esta ação não pode ser desfeita.
              </p>
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button 
              variant="outline" 
              onClick={() => {
                setShowAnularConfirm(false);
                setQuestaoToAnular(null);
              }}
              disabled={anulando}
            >
              Cancelar
            </Button>
            <Button 
              variant="destructive" 
              onClick={handleAnularQuestao}
              disabled={anulando}
              className="bg-purple-600 hover:bg-purple-700"
            >
              {anulando ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Ban className="h-4 w-4 mr-2" />}
              Confirmar Anulação
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal de Edição de Questão */}
      <Dialog open={!!editingQuestao} onOpenChange={(open) => !open && setEditingQuestao(null)}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Edit2 className="h-5 w-5" />
              Editar Questão {editingQuestao?.ordem}
            </DialogTitle>
            <DialogDescription>
              Edite os dados da questão abaixo
            </DialogDescription>
          </DialogHeader>
          
          {editingQuestao && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="edit-grande-area">Grande Área</Label>
                  <Input
                    id="edit-grande-area"
                    value={editingQuestao.grande_area || ''}
                    onChange={(e) => setEditingQuestao({ ...editingQuestao, grande_area: e.target.value })}
                  />
                </div>
                <div>
                  <Label htmlFor="edit-especialidade">Especialidade</Label>
                  <Input
                    id="edit-especialidade"
                    value={editingQuestao.especialidade || ''}
                    onChange={(e) => setEditingQuestao({ ...editingQuestao, especialidade: e.target.value })}
                  />
                </div>
              </div>
              
              <div>
                <Label htmlFor="edit-tema">Tema</Label>
                <Input
                  id="edit-tema"
                  value={editingQuestao.tema || ''}
                  onChange={(e) => setEditingQuestao({ ...editingQuestao, tema: e.target.value })}
                />
              </div>

              <div>
                <Label htmlFor="edit-enunciado">Enunciado</Label>
                <Textarea
                  id="edit-enunciado"
                  value={editingQuestao.enunciado}
                  onChange={(e) => setEditingQuestao({ ...editingQuestao, enunciado: e.target.value })}
                  rows={4}
                />
              </div>

              <div>
                <Label htmlFor="edit-imagem">URL da Imagem (opcional)</Label>
                <Input
                  id="edit-imagem"
                  value={editingQuestao.imagem || ''}
                  onChange={(e) => setEditingQuestao({ ...editingQuestao, imagem: e.target.value })}
                  placeholder="https://..."
                />
              </div>

              <div className="grid grid-cols-1 gap-3">
                <div>
                  <Label htmlFor="edit-alt-a">Alternativa A</Label>
                  <Input
                    id="edit-alt-a"
                    value={editingQuestao.alternativa_a}
                    onChange={(e) => setEditingQuestao({ ...editingQuestao, alternativa_a: e.target.value })}
                  />
                </div>
                <div>
                  <Label htmlFor="edit-alt-b">Alternativa B</Label>
                  <Input
                    id="edit-alt-b"
                    value={editingQuestao.alternativa_b}
                    onChange={(e) => setEditingQuestao({ ...editingQuestao, alternativa_b: e.target.value })}
                  />
                </div>
                <div>
                  <Label htmlFor="edit-alt-c">Alternativa C</Label>
                  <Input
                    id="edit-alt-c"
                    value={editingQuestao.alternativa_c}
                    onChange={(e) => setEditingQuestao({ ...editingQuestao, alternativa_c: e.target.value })}
                  />
                </div>
                <div>
                  <Label htmlFor="edit-alt-d">Alternativa D</Label>
                  <Input
                    id="edit-alt-d"
                    value={editingQuestao.alternativa_d}
                    onChange={(e) => setEditingQuestao({ ...editingQuestao, alternativa_d: e.target.value })}
                  />
                </div>
                {editingQuestao.alternativa_e !== null && (
                  <div>
                    <Label htmlFor="edit-alt-e">Alternativa E</Label>
                    <Input
                      id="edit-alt-e"
                      value={editingQuestao.alternativa_e || ''}
                      onChange={(e) => setEditingQuestao({ ...editingQuestao, alternativa_e: e.target.value })}
                    />
                  </div>
                )}
              </div>

              <div>
                <Label htmlFor="edit-correta">Alternativa Correta</Label>
                <Select
                  value={editingQuestao.correta}
                  onValueChange={(value) => setEditingQuestao({ ...editingQuestao, correta: value as 'A' | 'B' | 'C' | 'D' | 'E' })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="A">A</SelectItem>
                    <SelectItem value="B">B</SelectItem>
                    <SelectItem value="C">C</SelectItem>
                    <SelectItem value="D">D</SelectItem>
                    {editingQuestao.alternativa_e !== null && <SelectItem value="E">E</SelectItem>}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label htmlFor="edit-comentario">Comentário</Label>
                <Textarea
                  id="edit-comentario"
                  value={editingQuestao.comentario || ''}
                  onChange={(e) => setEditingQuestao({ ...editingQuestao, comentario: e.target.value })}
                  rows={3}
                />
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingQuestao(null)}>
              Cancelar
            </Button>
            <Button onClick={handleSaveQuestao}>
              <CheckCircle className="h-4 w-4 mr-2" />
              Salvar Alterações
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
// Carrega a lib XLSX sob demanda
const loadXLSX = async () => {
  return XLSXLibStatic as any;
};
