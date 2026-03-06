import * as React from 'react';
import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Progress } from '@/components/ui/progress';
import { toast } from 'sonner';
import { Upload, Download, Users, Shield, Loader2, Mail, UserPlus, FileSpreadsheet, Building2, GraduationCap, AtSign, User, XCircle } from 'lucide-react';
import { getBrazilDate } from '@/utils/timezone';
import { BatchProcessingReport, BatchResult, BatchReport } from './BatchProcessingReport';
import { UsersListTable } from './UsersListTable';
import * as XLSX from 'xlsx';

const MAX_BATCH_ROWS = 1000;
const CONCURRENCY = 5;
const INTER_CHUNK_DELAY_MS = 300;

function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

interface IES {
  id: string;
  nome: string;
}

export const UsersTab: React.FC = () => {
  const [iesList, setIesList] = useState<IES[]>([]);
  const [singleUser, setSingleUser] = useState({ nome: '', email: '', id_ies: '', semestre: '' });
  const [csvFile, setCsvFile] = useState<File | null>(null);
  const [batchIesId, setBatchIesId] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [logs, setLogs] = useState<string[]>([]);
  const [batchReport, setBatchReport] = useState<BatchReport | null>(null);
  const [batchProgress, setBatchProgress] = useState<{ current: number; total: number } | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  
  // Stats
  const [totalUsers, setTotalUsers] = useState<number | null>(null);
  const [totalAdmins, setTotalAdmins] = useState<number | null>(null);
  

  useEffect(() => {
    fetchIesList();
  }, []);

  const fetchIesList = async () => {
    const { data, error } = await supabase.from('ies').select('id, nome').order('nome');
    if (!error && data) {
      setIesList(data);
    }
  };

  const handleStatsUpdate = useCallback((users: number, admins: number) => {
    setTotalUsers(users);
    setTotalAdmins(admins);
  }, []);

  const addLog = (message: string) => {
    const timestamp = getBrazilDate().toLocaleTimeString('pt-BR');
    setLogs(prev => [...prev, `[${timestamp}] ${message}`]);
  };

  // syncUserAuth removed – available per-user in UsersListTable

  const createSingleUser = async () => {
    if (!singleUser.nome || !singleUser.email || !singleUser.id_ies || !singleUser.semestre) {
      toast.error('Preencha todos os campos obrigatórios');
      return;
    }

    setIsCreating(true);

    try {
      const { data, error } = await supabase.functions.invoke('b2b-create-user', {
        body: {
          nome: singleUser.nome,
          email: singleUser.email.toLowerCase().trim(),
          id_ies: singleUser.id_ies,
          semestre: parseInt(singleUser.semestre),
        },
      });

      if (error || !data?.success) {
        const msg = error?.message || data?.error || 'Erro ao criar usuário';
        toast.error(msg);
        addLog(`Erro ao criar ${singleUser.email}: ${msg}`);
        return;
      }

      let actionMsg: string;
      if (data.action === 'created') {
        actionMsg = data.details?.emailSent 
          ? '✅ Usuário cadastrado. E-mail de boas-vindas enviado.'
          : '⚠️ Usuário cadastrado, mas não foi possível enviar o e-mail.';
      } else {
        actionMsg = `🔄 Usuário atualizado: ${data.details?.fieldsUpdated?.join(', ') || 'nenhuma alteração'}`;
      }
      
      toast.success(actionMsg);
      addLog(`${singleUser.email}: ${actionMsg}`);
      setSingleUser({ nome: '', email: '', id_ies: '', semestre: '' });
    } catch (err) {
      console.error('Create user error:', err);
      toast.error('Erro inesperado ao criar usuário');
    } finally {
      setIsCreating(false);
    }
  };

  const processCsvFile = async () => {
    if (!csvFile) {
      toast.error('Selecione um arquivo CSV');
      return;
    }

    // Fix #2: Validate batchIesId explicitly
    if (!batchIesId) {
      toast.error('Selecione uma IES antes de processar');
      return;
    }

    setIsProcessing(true);
    setLogs([]);
    setBatchReport(null);
    setBatchProgress(null);
    
    const startedAt = new Date();
    addLog('Iniciando processamento do arquivo...');

    // Setup abort controller for cancellation
    const abortController = new AbortController();
    abortRef.current = abortController;

    try {
      // Fix #1: Use XLSX to parse CSV/XLSX robustly instead of split(',')
      const arrayBuffer = await csvFile.arrayBuffer();
      const workbook = XLSX.read(arrayBuffer, { type: 'array' });
      const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
      const rows: Record<string, any>[] = XLSX.utils.sheet_to_json(firstSheet, { defval: '' });

      if (rows.length === 0) {
        toast.error('Arquivo vazio ou sem dados');
        setIsProcessing(false);
        return;
      }

      // Fix #6: Limit batch size
      if (rows.length > MAX_BATCH_ROWS) {
        toast.error(`Limite de ${MAX_BATCH_ROWS} linhas por lote excedido (${rows.length} linhas encontradas). Divida o arquivo.`);
        addLog(`Erro: arquivo com ${rows.length} linhas excede limite de ${MAX_BATCH_ROWS}`);
        setIsProcessing(false);
        return;
      }

      // Normalize headers to lowercase
      const normalizedRows = rows.map(row => {
        const normalized: Record<string, string> = {};
        for (const key of Object.keys(row)) {
          normalized[key.trim().toLowerCase()] = String(row[key]).trim();
        }
        return normalized;
      });

      // Validate required columns
      const firstRow = normalizedRows[0];
      const requiredColumns = ['nome', 'email', 'semestre'];
      const missingColumns = requiredColumns.filter(col => !(col in firstRow));
      
      if (missingColumns.length > 0) {
        toast.error(`Colunas obrigatórias faltando: ${missingColumns.join(', ')}`);
        addLog(`Erro: colunas faltando - ${missingColumns.join(', ')}`);
        setIsProcessing(false);
        return;
      }

      // Pre-validate all rows
      const validUsers: { nome: string; email: string; semestre: number; linha: number }[] = [];
      const results: BatchResult[] = [];
      const processedEmails = new Set<string>();

      for (let i = 0; i < normalizedRows.length; i++) {
        const user = normalizedRows[i];
        const email = user.email?.toLowerCase().trim();
        const nome = user.nome?.trim();
        const semestreStr = user.semestre?.trim();
        const linha = i + 2; // +2 because row 1 is header, 0-indexed

        // Skip empty lines
        if (!email && !nome) continue;

        // Check for duplicates in this batch
        if (processedEmails.has(email)) {
          results.push({ email, nome, linha, success: false, error: { code: 'SKIPPED', message: 'Email já processado neste lote' } });
          continue;
        }

        // Basic validation
        if (!nome || !email || !semestreStr) {
          results.push({ email: email || 'N/A', nome: nome || 'N/A', linha, success: false, error: { code: 'VALIDATION_ERROR', message: 'Dados incompletos (nome, email, semestre obrigatórios)' } });
          continue;
        }

        // Fix #9: Frontend email validation
        if (!isValidEmail(email)) {
          results.push({ email, nome, linha, success: false, error: { code: 'VALIDATION_ERROR', message: `Email inválido: ${email}` } });
          continue;
        }

        const semestre = parseInt(semestreStr);
        if (isNaN(semestre) || semestre < 1 || semestre > 12) {
          results.push({ email, nome, linha, success: false, error: { code: 'VALIDATION_ERROR', message: `Semestre inválido: ${semestreStr}` } });
          continue;
        }

        processedEmails.add(email);
        validUsers.push({ nome, email, semestre, linha });
      }

      const totalToProcess = validUsers.length;
      addLog(`${results.length} linhas com problemas de validação. Processando ${totalToProcess} usuários válidos...`);
      setBatchProgress({ current: 0, total: totalToProcess });

      // Fix #3: Process in parallel chunks with concurrency control
      let processed = 0;
      for (let chunkStart = 0; chunkStart < validUsers.length; chunkStart += CONCURRENCY) {
        // Check for cancellation
        if (abortController.signal.aborted) {
          addLog('⚠️ Processamento cancelado pelo administrador.');
          break;
        }

        const chunk = validUsers.slice(chunkStart, chunkStart + CONCURRENCY);

        const chunkResults = await Promise.allSettled(
          chunk.map(async (user) => {
            const { data, error } = await supabase.functions.invoke('b2b-create-user', {
              body: { nome: user.nome, email: user.email, id_ies: batchIesId, semestre: user.semestre },
            });

            if (error || !data?.success) {
              return {
                email: user.email, nome: user.nome, linha: user.linha, success: false as const,
                error: { code: data?.code || 'INTERNAL_ERROR', message: error?.message || data?.error || 'Erro desconhecido' },
              };
            }

            return {
              email: user.email, nome: user.nome, linha: user.linha, success: true as const,
              action: data.action, message: data.message,
              fieldsUpdated: data.details?.fieldsUpdated, emailSent: data.details?.emailSent,
            };
          })
        );

        for (const result of chunkResults) {
          processed++;
          if (result.status === 'fulfilled') {
            const r = result.value;
            results.push(r as BatchResult);
            if (r.success) {
              const icon = r.action === 'created' ? '✅' : '🔄';
              addLog(`${r.email} - ${icon} ${r.action}`);
            } else {
              addLog(`${r.email} - ❌ ${(r as any).error?.message}`);
            }
          } else {
            const user = chunk[chunkResults.indexOf(result)];
            results.push({ email: user.email, nome: user.nome, linha: user.linha, success: false, error: { code: 'INTERNAL_ERROR', message: result.reason?.message || 'Erro inesperado' } });
            addLog(`${user.email} - ❌ Erro inesperado`);
          }
        }

        setBatchProgress({ current: processed, total: totalToProcess });

        // Inter-chunk delay to avoid rate limiting
        if (chunkStart + CONCURRENCY < validUsers.length && !abortController.signal.aborted) {
          await new Promise(resolve => setTimeout(resolve, INTER_CHUNK_DELAY_MS));
        }
      }

      const finishedAt = new Date();
      
      const report: BatchReport = {
        total: results.length,
        created: results.filter(r => r.success && r.action === 'created').length,
        updated: results.filter(r => r.success && r.action === 'updated').length,
        errors: results.filter(r => !r.success).length,
        skipped: results.filter(r => r.error?.code === 'SKIPPED').length,
        results,
        startedAt,
        finishedAt
      };

      const emailsSent = results.filter(r => r.success && r.action === 'created' && r.emailSent).length;
      const emailsFailed = results.filter(r => r.success && r.action === 'created' && !r.emailSent).length;

      setBatchReport(report);
      setBatchProgress(null);
      addLog(`Processamento concluído: ${report.created} criados, ${report.updated} atualizados, ${report.errors} erros. Emails: ${emailsSent} enviados, ${emailsFailed} falharam.`);
      
      toast.success(`Importação concluída. ${report.created} criados, ${report.updated} atualizados, ${emailsSent} e-mails enviados${emailsFailed > 0 ? `, ${emailsFailed} falharam` : ''}.`);
    } catch (err) {
      console.error('CSV processing error:', err);
      toast.error('Erro ao processar arquivo');
      addLog(`Erro fatal: ${err instanceof Error ? err.message : 'Erro desconhecido'}`);
    } finally {
      setIsProcessing(false);
      setBatchProgress(null);
      abortRef.current = null;
    }
  };

  const cancelBatchProcessing = () => {
    abortRef.current?.abort();
    toast.info('Cancelando processamento...');
  };

  const downloadReport = () => {
    if (!batchReport) return;

    const workbook = XLSX.utils.book_new();

    // ========== Sheet 1: Resumo ==========
    const summaryData = [
      ['📊 RELATÓRIO DE CADASTRO EM LOTE'],
      [''],
      ['Data/Hora Início', batchReport.startedAt.toLocaleString('pt-BR')],
      ['Data/Hora Fim', batchReport.finishedAt.toLocaleString('pt-BR')],
      ['Duração', formatDuration(batchReport.startedAt, batchReport.finishedAt)],
      [''],
      ['RESUMO'],
      ['Total Processados', batchReport.total],
      ['✅ Criados', batchReport.created],
      ['🔄 Atualizados', batchReport.updated],
      ['❌ Erros', batchReport.errors],
      ['⏭️ Ignorados (duplicados)', batchReport.skipped],
      [''],
      ['Taxa de Sucesso', `${((batchReport.created + batchReport.updated) / batchReport.total * 100).toFixed(1)}%`]
    ];
    const summarySheet = XLSX.utils.aoa_to_sheet(summaryData);
    summarySheet['!cols'] = [{ wch: 25 }, { wch: 35 }];
    XLSX.utils.book_append_sheet(workbook, summarySheet, 'Resumo');

    // ========== Sheet 2: Todos os Resultados ==========
    const allResultsData = batchReport.results.map(r => ({
      'Linha': r.linha,
      'Email': r.email,
      'Nome': r.nome,
      'Status': r.success ? '✅ Sucesso' : '❌ Erro',
      'Ação': r.action === 'created' ? 'Criado' : r.action === 'updated' ? 'Atualizado' : '-',
      'Campos Atualizados': r.fieldsUpdated?.join(', ') || '-',
      'Código Erro': r.error?.code || '-',
      'Mensagem Erro': r.error?.message || '-'
    }));
    const allResultsSheet = XLSX.utils.json_to_sheet(allResultsData);
    allResultsSheet['!cols'] = [
      { wch: 8 },  // Linha
      { wch: 35 }, // Email
      { wch: 30 }, // Nome
      { wch: 12 }, // Status
      { wch: 12 }, // Ação
      { wch: 25 }, // Campos Atualizados
      { wch: 20 }, // Código Erro
      { wch: 50 }, // Mensagem Erro
    ];
    XLSX.utils.book_append_sheet(workbook, allResultsSheet, 'Todos os Resultados');

    // ========== Sheet 3: Somente Erros ==========
    const errorResults = batchReport.results.filter(r => !r.success);
    if (errorResults.length > 0) {
      const errorData = errorResults.map(r => ({
        'Linha': r.linha,
        'Email': r.email,
        'Nome': r.nome,
        'Código': r.error?.code || 'UNKNOWN',
        'Mensagem': r.error?.message || 'Erro desconhecido'
      }));
      const errorSheet = XLSX.utils.json_to_sheet(errorData);
      errorSheet['!cols'] = [
        { wch: 8 },
        { wch: 35 },
        { wch: 30 },
        { wch: 20 },
        { wch: 60 },
      ];
      XLSX.utils.book_append_sheet(workbook, errorSheet, 'Erros');
    }

    // ========== Sheet 4: Criados com Sucesso ==========
    const createdResults = batchReport.results.filter(r => r.success && r.action === 'created');
    if (createdResults.length > 0) {
      const createdData = createdResults.map(r => ({
        'Linha': r.linha,
        'Email': r.email,
        'Nome': r.nome,
        'Email Boas-Vindas': r.emailSent ? '✅ Enviado' : '❌ Falhou'
      }));
      const createdSheet = XLSX.utils.json_to_sheet(createdData);
      createdSheet['!cols'] = [
        { wch: 8 },
        { wch: 35 },
        { wch: 30 },
        { wch: 20 },
      ];
      XLSX.utils.book_append_sheet(workbook, createdSheet, 'Criados');
    }

    // ========== Sheet 5: Atualizados ==========
    const updatedResults = batchReport.results.filter(r => r.success && r.action === 'updated');
    if (updatedResults.length > 0) {
      const updatedData = updatedResults.map(r => ({
        'Linha': r.linha,
        'Email': r.email,
        'Nome': r.nome,
        'Campos Atualizados': r.fieldsUpdated?.join(', ') || 'Nenhuma alteração'
      }));
      const updatedSheet = XLSX.utils.json_to_sheet(updatedData);
      updatedSheet['!cols'] = [
        { wch: 8 },
        { wch: 35 },
        { wch: 30 },
        { wch: 40 },
      ];
      XLSX.utils.book_append_sheet(workbook, updatedSheet, 'Atualizados');
    }

    // Generate and download
    const fileName = `relatorio_cadastro_${new Date().toISOString().split('T')[0]}.xlsx`;
    XLSX.writeFile(workbook, fileName);
    
    toast.success('Relatório XLSX baixado com sucesso!');
  };

  const formatDuration = (start: Date, end: Date): string => {
    const diffMs = end.getTime() - start.getTime();
    const seconds = Math.floor(diffMs / 1000);
    if (seconds < 60) return `${seconds}s`;
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}m ${remainingSeconds}s`;
  };

  const downloadExampleXlsx = () => {
    const header = ['nome', 'email', 'semestre'];
    const exampleRows = [
      ['João Silva', 'joao@exemplo.com', 5],
      ['Maria Souza', 'maria@exemplo.com', 3],
    ];

    const wsData = [header, ...exampleRows];
    const ws = XLSX.utils.aoa_to_sheet(wsData);
    ws['!cols'] = [
      { wch: 25 }, // nome
      { wch: 30 }, // email
      { wch: 10 }, // semestre
    ];

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Usuarios');
    XLSX.writeFile(wb, 'exemplo_cadastro_usuarios.xlsx');
  };

  return (
    <div className="space-y-6">
      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card className="border-border/50 bg-gradient-to-br from-card to-card/80 shadow-sm hover:shadow-md transition-shadow">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total de Usuários</CardTitle>
            <div className="rounded-lg bg-primary/10 p-2">
              <Users className="h-4 w-4 text-primary" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold tracking-tight">
              {totalUsers !== null ? totalUsers.toLocaleString('pt-BR') : '-'}
            </div>
          </CardContent>
        </Card>
        <Card className="border-border/50 bg-gradient-to-br from-card to-card/80 shadow-sm hover:shadow-md transition-shadow">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Administradores</CardTitle>
            <div className="rounded-lg bg-primary/10 p-2">
              <Shield className="h-4 w-4 text-primary" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold tracking-tight">
              {totalAdmins !== null ? totalAdmins : '-'}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Users List Table */}
      <UsersListTable iesList={iesList} onStatsUpdate={handleStatsUpdate} />

      {/* Single User Creation */}
      <Card className="border-border/50 overflow-hidden shadow-sm">
        <CardHeader className="bg-gradient-to-r from-primary/5 to-transparent pb-4">
          <div className="flex items-center gap-3">
            <div className="rounded-xl bg-primary/10 p-2.5">
              <UserPlus className="h-5 w-5 text-primary" />
            </div>
            <div>
              <CardTitle className="text-lg">Criar Usuário Individual</CardTitle>
              <CardDescription className="mt-0.5">
                Adicione um novo usuário. Um email de convite será enviado automaticamente.
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-5 pt-5">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="nome" className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                <User className="h-3.5 w-3.5" />
                Nome Completo
              </Label>
              <Input
                id="nome"
                value={singleUser.nome}
                onChange={(e) => setSingleUser({ ...singleUser, nome: e.target.value })}
                placeholder="João Silva"
                className="h-11 bg-secondary/50 border-border/60 focus:bg-background transition-colors"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email" className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                <AtSign className="h-3.5 w-3.5" />
                Email
              </Label>
              <Input
                id="email"
                type="email"
                value={singleUser.email}
                onChange={(e) => setSingleUser({ ...singleUser, email: e.target.value })}
                placeholder="joao@example.com"
                className="h-11 bg-secondary/50 border-border/60 focus:bg-background transition-colors"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="ies" className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                <Building2 className="h-3.5 w-3.5" />
                Instituição
              </Label>
              <Select value={singleUser.id_ies} onValueChange={(v) => setSingleUser({ ...singleUser, id_ies: v })}>
                <SelectTrigger className="h-11 bg-secondary/50 border-border/60 focus:bg-background transition-colors">
                  <SelectValue placeholder="Selecione a IES" />
                </SelectTrigger>
                <SelectContent>
                  {iesList.map((ies) => (
                    <SelectItem key={ies.id} value={ies.id}>
                      {ies.nome}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="semestre" className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                <GraduationCap className="h-3.5 w-3.5" />
                Semestre
              </Label>
              <Input
                id="semestre"
                type="number"
                value={singleUser.semestre}
                onChange={(e) => setSingleUser({ ...singleUser, semestre: e.target.value })}
                placeholder="5"
                min="1"
                max="12"
                className="h-11 bg-secondary/50 border-border/60 focus:bg-background transition-colors"
              />
            </div>
          </div>

          <Button
            onClick={createSingleUser}
            disabled={isCreating}
            className="w-full h-12 text-base font-semibold shadow-sm hover:shadow-md transition-all active:scale-[0.99]"
          >
            {isCreating ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Processando...
              </>
            ) : (
              <>
                <Mail className="h-4 w-4 mr-2" />
                Criar Usuário e Enviar Convite
              </>
            )}
          </Button>
        </CardContent>
      </Card>

      {/* Batch User Creation */}
      <Card className="border-border/50 overflow-hidden shadow-sm">
        <CardHeader className="bg-gradient-to-r from-primary/5 to-transparent pb-4">
          <div className="flex items-center gap-3">
            <div className="rounded-xl bg-primary/10 p-2.5">
              <FileSpreadsheet className="h-5 w-5 text-primary" />
            </div>
            <div>
              <CardTitle className="text-lg">Cadastro/Atualização em Lote</CardTitle>
              <CardDescription className="mt-0.5">
                Importe múltiplos usuários via CSV/XLSX (máx. {MAX_BATCH_ROWS} linhas). Novos receberão convite por email.
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-5 pt-5">
          {/* Step 1: IES Selection */}
          <div className="space-y-2">
            <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
              <Building2 className="h-3.5 w-3.5" />
              Instituição (IES)
            </Label>
            <Select value={batchIesId} onValueChange={setBatchIesId}>
              <SelectTrigger className="h-11 bg-secondary/50 border-border/60 focus:bg-background transition-colors">
                <SelectValue placeholder="Selecione a IES para este lote" />
              </SelectTrigger>
              <SelectContent>
                {iesList.map((ies) => (
                  <SelectItem key={ies.id} value={ies.id}>
                    {ies.nome}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Step 2: File Upload */}
          <div className="space-y-2">
            <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
              <Upload className="h-3.5 w-3.5" />
              Arquivo CSV / XLSX
            </Label>
            <div className="flex gap-2">
              <Input
                type="file"
                accept=".csv,.xlsx,.xls"
                onChange={(e) => {
                  setCsvFile(e.target.files?.[0] || null);
                  setBatchReport(null);
                }}
                disabled={isProcessing}
                className="h-11 bg-secondary/50 border-border/60 file:bg-primary/10 file:text-primary file:border-0 file:rounded-md file:px-3 file:py-1 file:mr-3 file:font-medium file:text-sm hover:file:bg-primary/20 file:transition-colors cursor-pointer"
              />
              <Button
                variant="outline"
                onClick={downloadExampleXlsx}
                className="h-11 shrink-0 border-border/60 hover:bg-secondary/80 transition-all active:scale-[0.98]"
              >
                <Download className="h-4 w-4 mr-2" />
                Exemplo
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              O arquivo deve conter as colunas: <span className="font-medium text-foreground/70">nome</span>, <span className="font-medium text-foreground/70">email</span>, <span className="font-medium text-foreground/70">semestre</span>. Máximo {MAX_BATCH_ROWS} linhas.
            </p>
          </div>

          <div className="flex gap-2">
            <Button
              onClick={processCsvFile}
              disabled={!csvFile || !batchIesId || isProcessing}
              className="flex-1 h-12 text-base font-semibold shadow-sm hover:shadow-md transition-all active:scale-[0.99]"
            >
              {isProcessing ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Processando{batchProgress ? ` ${batchProgress.current}/${batchProgress.total}` : '...'}
                </>
              ) : (
                <>
                  <Upload className="h-4 w-4 mr-2" />
                  Processar Arquivo
                </>
              )}
            </Button>
            {isProcessing && (
              <Button
                variant="destructive"
                onClick={cancelBatchProcessing}
                className="h-12 shrink-0"
              >
                <XCircle className="h-4 w-4 mr-2" />
                Cancelar
              </Button>
            )}
          </div>

          {/* Fix #7: Progress bar */}
          {batchProgress && batchProgress.total > 0 && (
            <div className="space-y-2">
              <Progress value={(batchProgress.current / batchProgress.total) * 100} className="h-2" />
              <p className="text-xs text-muted-foreground text-center">
                {batchProgress.current} de {batchProgress.total} usuários processados ({Math.round((batchProgress.current / batchProgress.total) * 100)}%)
              </p>
            </div>
          )}

          {/* Batch Report */}
          {batchReport && (
            <BatchProcessingReport
              report={batchReport}
              onDownload={downloadReport}
              onClose={() => setBatchReport(null)}
            />
          )}

          {/* Processing Logs */}
          {logs.length > 0 && !batchReport && (
            <div className="bg-secondary/50 border border-border/50 rounded-xl p-4 max-h-64 overflow-y-auto">
              <Label className="mb-3 block text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Logs de Processamento
              </Label>
              <div className="font-mono text-xs space-y-1 text-muted-foreground">
                {logs.map((log, i) => (
                  <div key={i} className="py-0.5">{log}</div>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};
