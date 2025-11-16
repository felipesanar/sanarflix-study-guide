import { useState, useEffect } from 'react';
import * as XLSXLibStatic from 'xlsx';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useToast } from '@/hooks/use-toast';
import { Upload, FileSpreadsheet, Eye, Edit2, Trash2, Download, Plus, CheckCircle, AlertCircle, Loader2, Search, Filter, X, Unlock } from 'lucide-react';
import { LiberarSimuladoModal } from './LiberarSimuladoModal';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { format } from 'date-fns';
import { datetimeLocalToBrazilISO, brazilISOToDatetimeLocal } from '@/utils/timezone';
import { Checkbox } from '@/components/ui/checkbox';

interface Simulado {
  id: string;
  nome: string;
  descricao: string | null;
  data_liberacao: string | null;
  data_encerramento: string | null;
  duracao_minutos: number;
  status: 'ativo' | 'rascunho' | 'encerrado';
  created_at: string;
  questoes_count?: number;
}

interface Questao {
  id?: string;
  ordem: number;
  numero_questao?: number;
  grande_area?: string;
  especialidade?: string;
  tema?: string;
  grau_dificuldade?: string;
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
  observacao: string | null;
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
    status: 'ativo' | 'rascunho' | 'encerrado';
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
  const [selectedIES, setSelectedIES] = useState<string>('');
  const [showLiberarModal, setShowLiberarModal] = useState(false);

  const [configForm, setConfigForm] = useState({
    nome: '',
    descricao: '',
    data_liberacao: '',
    data_encerramento: '',
    duracao_minutos: 180,
    status: 'rascunho' as 'ativo' | 'rascunho' | 'encerrado'
  });

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
        status: s.status as 'ativo' | 'rascunho' | 'encerrado',
        created_at: s.created_at,
        questoes_count: s.questoes_simulado?.[0]?.count || 0
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

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      setUploading(true);
      setUploadProgress(20);

      const reader = new FileReader();
      reader.onload = async (event) => {
        try {
          const data = event.target?.result;
          const XLSXLib = await loadXLSX();
          const workbook = XLSXLib.read(data, { type: 'binary' });
          const sheetName = workbook.SheetNames[0];
          const worksheet = workbook.Sheets[sheetName];
          const jsonData = XLSXLib.utils.sheet_to_json(worksheet);

          setUploadProgress(40);

          // Validar colunas obrigatórias (novo padrão)
          const requiredColumns = [
            'número da questão',
            'grande área',
            'especialidade',
            'tema',
            'grau de dificuldade',
            'competência',
            'enunciado da questão',
            'alternativa a',
            'alternativa b',
            'alternativa c',
            'alternativa d',
            'comentário da questão',
            'alternativa correta'
          ];
          
          const firstRow = jsonData[0] as any;
          const columns = Object.keys(firstRow).map(k => k.toLowerCase().trim());

          const missingColumns = requiredColumns.filter(col => !columns.includes(col));
          if (missingColumns.length > 0) {
            throw new Error(
              `O arquivo está incompleto. Colunas obrigatórias faltando:\n${missingColumns.join(', ')}\n\nColunas esperadas:\n${requiredColumns.join(', ')}`
            );
          }

          setUploadProgress(60);

          // Processar questões com novo padrão
          const questoes: Questao[] = jsonData.map((row: any, index) => {
            const normalizedRow: any = {};
            Object.keys(row).forEach(key => {
              normalizedRow[key.toLowerCase().trim()] = row[key];
            });

            // Validar alternativa correta
            const correta = normalizedRow['alternativa correta']?.toString().toUpperCase();
            if (!correta || !['A', 'B', 'C', 'D'].includes(correta)) {
              throw new Error(
                `Questão ${index + 1}: Campo "Alternativa Correta" inválido. Deve ser A, B, C ou D. Valor encontrado: "${correta}"`
              );
            }

            return {
              ordem: index + 1,
              numero_questao: normalizedRow['número da questão'] || index + 1,
              grande_area: normalizedRow['grande área'] || '',
              especialidade: normalizedRow['especialidade'] || '',
              tema: normalizedRow['tema'] || '',
              grau_dificuldade: normalizedRow['grau de dificuldade'] || '',
              competencia: normalizedRow['competência'] || '',
              enunciado: normalizedRow['enunciado da questão'] || '',
              alternativa_a: normalizedRow['alternativa a'] || '',
              alternativa_b: normalizedRow['alternativa b'] || '',
              alternativa_c: normalizedRow['alternativa c'] || '',
              alternativa_d: normalizedRow['alternativa d'] || '',
              alternativa_e: null,
              correta: correta as 'A' | 'B' | 'C' | 'D',
              comentario: normalizedRow['comentário da questão'] || null,
              feedback_corretas: null,
              imagem: normalizedRow['imagem/gráfico/tabela'] || null,
              observacao: null
            };
          });

          setUploadProgress(80);

          setPreviewData({
            questoes,
            config: {
              nome: file.name.replace('.xlsx', ''),
              descricao: '',
              data_liberacao: '',
              data_encerramento: '',
              duracao_minutos: 180,
              status: 'rascunho'
            }
          });

          setUploadProgress(100);
          setShowPreviewModal(true);
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

      reader.readAsBinaryString(file);
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
      setConfigForm(previewData.config);
      setShowPreviewModal(false);
      setShowConfigModal(true);
    }
  };

  const handleSaveSimulado = async () => {
    if (!previewData || !configForm.nome) {
      toast({
        title: 'Erro',
        description: 'Nome do simulado é obrigatório',
        variant: 'destructive'
      });
      return;
    }

    if (!selectedIES) {
      toast({
        title: 'Erro',
        description: 'Selecione a IES responsável por este simulado',
        variant: 'destructive'
      });
      return;
    }

    try {
      setUploading(true);

      // Converter datas para timezone de Brasília
      const dataLiberacaoISO = configForm.data_liberacao 
        ? datetimeLocalToBrazilISO(configForm.data_liberacao)
        : null;
      const dataEncerramentoISO = configForm.data_encerramento
        ? datetimeLocalToBrazilISO(configForm.data_encerramento)
        : null;

      // Criar simulado
      const { data: simulado, error: simuladoError } = await supabase
        .from('simulados_admin')
        .insert({
          nome: configForm.nome,
          descricao: configForm.descricao || null,
          data_liberacao: dataLiberacaoISO,
          data_encerramento: dataEncerramentoISO,
          duracao_minutos: configForm.duracao_minutos,
          status: configForm.status,
          ies_id: selectedIES
        })
        .select()
        .single();

      if (simuladoError) throw simuladoError;

      // Inserir questões
      const questoesComSimuladoId = previewData.questoes.map(q => ({
        ...q,
        simulado_id: simulado.id
      }));

      const { error: questoesError } = await supabase
        .from('questoes_simulado')
        .insert(questoesComSimuladoId);

      if (questoesError) throw questoesError;

      toast({
        title: 'Simulado criado com sucesso!',
        description: `${previewData.questoes.length} questões foram adicionadas.`
      });

      setShowConfigModal(false);
      setPreviewData(null);
      setSelectedIES('');
      setConfigForm({
        nome: '',
        descricao: '',
        data_liberacao: '',
        data_encerramento: '',
        duracao_minutos: 180,
        status: 'rascunho'
      });
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
        observacao: q.observacao
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

  const getStatusBadge = (status: string) => {
    const variants: Record<string, { variant: any; label: string; icon: string }> = {
      ativo: { variant: 'default', label: 'Ativo', icon: '🟢' },
      rascunho: { variant: 'secondary', label: 'Rascunho', icon: '🟡' },
      encerrado: { variant: 'destructive', label: 'Encerrado', icon: '🔴' }
    };

    const config = variants[status] || variants.rascunho;
    return (
      <Badge variant={config.variant}>
        {config.icon} {config.label}
      </Badge>
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
            <Input
              type="file"
              accept=".xlsx,.xls"
              onChange={handleFileUpload}
              disabled={uploading}
              className="max-w-xs mx-auto cursor-pointer"
            />
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
                <SelectItem value="ativo">Ativos</SelectItem>
                <SelectItem value="rascunho">Rascunhos</SelectItem>
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
                    <TableHead>Data de Criação</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredSimulados.map((simulado) => (
                    <TableRow key={simulado.id}>
                      <TableCell className="font-medium">{simulado.nome}</TableCell>
                      <TableCell>{getStatusBadge(simulado.status)}</TableCell>
                      <TableCell>{simulado.questoes_count || 0}</TableCell>
                      <TableCell>
                        {format(new Date(simulado.created_at), 'dd/MM/yyyy')}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleVisualizarQuestoes(simulado)}
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleExportSimulado(simulado)}
                          >
                            <Download className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              setSelectedSimulado(simulado);
                              setShowDeleteModal(true);
                            }}
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
                    <div>
                      <span className="font-semibold text-muted-foreground">Dificuldade:</span>
                      <p>{questao.grau_dificuldade || 'N/A'}</p>
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

                  {/* Imagem/Gráfico/Tabela */}
                  {questao.imagem && (
                    <div>
                      <img 
                        src={questao.imagem} 
                        alt="Imagem/Gráfico/Tabela da questão" 
                        className="max-w-full h-auto rounded-lg border"
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
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Configurar Simulado</DialogTitle>
            <DialogDescription>
              Defina as informações do simulado antes de salvar
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
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
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Data de Liberação</Label>
                <Input
                  type="datetime-local"
                  value={configForm.data_liberacao}
                  onChange={(e) => setConfigForm({ ...configForm, data_liberacao: e.target.value })}
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Horário de Brasília (UTC−3)
                </p>
              </div>
              <div>
                <Label>Data de Encerramento</Label>
                <Input
                  type="datetime-local"
                  value={configForm.data_encerramento}
                  onChange={(e) => setConfigForm({ ...configForm, data_encerramento: e.target.value })}
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Horário de Brasília (UTC−3)
                </p>
              </div>
            </div>

            <div>
              <Label>IES Responsável *</Label>
              <Select value={selectedIES} onValueChange={setSelectedIES}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione a IES" />
                </SelectTrigger>
                <SelectContent>
                  {iesList.map(ies => (
                    <SelectItem key={ies.id} value={ies.id}>
                      {ies.nome}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {!selectedIES && (
                <p className="text-xs text-destructive mt-1">
                  ⚠️ Selecione a IES responsável por este simulado
                </p>
              )}
            </div>

            <div>
              <Label>Duração (minutos)</Label>
              <Input
                type="number"
                value={configForm.duracao_minutos}
                onChange={(e) => setConfigForm({ ...configForm, duracao_minutos: parseInt(e.target.value) })}
              />
            </div>
            <div>
              <Label>Status</Label>
              <Select
                value={configForm.status}
                onValueChange={(value: any) => setConfigForm({ ...configForm, status: value })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="rascunho">🟡 Rascunho</SelectItem>
                  <SelectItem value="ativo">🟢 Ativo</SelectItem>
                  <SelectItem value="encerrado">🔴 Encerrado</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowConfigModal(false)}>
              Cancelar
            </Button>
            <Button onClick={handleSaveSimulado} disabled={uploading}>
              {uploading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Salvar Simulado
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
              <Card key={questao.id || index}>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-sm">Questão {questao.ordem}</CardTitle>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setEditingQuestao(questao)}
                    >
                      <Edit2 className="h-4 w-4" />
                    </Button>
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
                  <p className="text-green-600 font-medium">Correta: {questao.correta}</p>
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
    </div>
  );
}
// Carrega a lib XLSX sob demanda
const loadXLSX = async () => {
  return XLSXLibStatic as any;
};
