import * as React from 'react';
import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { Upload, Download, Users, Shield, Loader2, Mail } from 'lucide-react';
import { getBrazilDate } from '@/utils/timezone';
import { BatchProcessingReport, BatchResult, BatchReport } from './BatchProcessingReport';
import { UsersListTable } from './UsersListTable';
import * as XLSX from 'xlsx';

interface IES {
  id: string;
  nome: string;
}

export const UsersTab: React.FC = () => {
  const [iesList, setIesList] = useState<IES[]>([]);
  const [singleUser, setSingleUser] = useState({ nome: '', email: '', id_ies: '', semestre: '' });
  const [csvFile, setCsvFile] = useState<File | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [logs, setLogs] = useState<string[]>([]);
  const [batchReport, setBatchReport] = useState<BatchReport | null>(null);
  
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

    setIsProcessing(true);
    setLogs([]);
    setBatchReport(null);
    
    const startedAt = new Date();
    addLog('Iniciando processamento do arquivo CSV...');

    try {
      const text = await csvFile.text();
      const lines = text.split('\n').filter(line => line.trim());
      
      if (lines.length < 2) {
        toast.error('Arquivo CSV vazio ou sem dados');
        setIsProcessing(false);
        return;
      }

      const headers = lines[0].split(',').map(h => h.trim().toLowerCase());
      
      // Validate required columns
      const requiredColumns = ['nome', 'email', 'id_ies', 'semestre'];
      const missingColumns = requiredColumns.filter(col => !headers.includes(col));
      
      if (missingColumns.length > 0) {
        toast.error(`Colunas obrigatórias faltando: ${missingColumns.join(', ')}`);
        addLog(`Erro: colunas faltando - ${missingColumns.join(', ')}`);
        setIsProcessing(false);
        return;
      }

      const results: BatchResult[] = [];
      const processedEmails = new Set<string>();

      addLog(`Processando ${lines.length - 1} linhas...`);

      for (let i = 1; i < lines.length; i++) {
        const values = lines[i].split(',').map(v => v.trim());
        const user: Record<string, string> = {};
        
        headers.forEach((header, index) => {
          user[header] = values[index] || '';
        });

        const email = user.email?.toLowerCase().trim();
        const nome = user.nome?.trim();
        const id_ies = user.id_ies?.trim();
        const semestreStr = user.semestre?.trim();

        // Skip empty lines
        if (!email && !nome) {
          continue;
        }

        // Check for duplicates in this batch
        if (processedEmails.has(email)) {
          results.push({
            email,
            nome,
            linha: i + 1,
            success: false,
            error: {
              code: 'SKIPPED',
              message: 'Email já processado neste lote'
            }
          });
          addLog(`Linha ${i + 1}: ${email} - duplicado no lote`);
          continue;
        }

        // Basic validation
        if (!nome || !email || !id_ies || !semestreStr) {
          results.push({
            email: email || 'N/A',
            nome: nome || 'N/A',
            linha: i + 1,
            success: false,
            error: {
              code: 'VALIDATION_ERROR',
              message: 'Dados incompletos (nome, email, id_ies, semestre obrigatórios)'
            }
          });
          addLog(`Linha ${i + 1}: dados incompletos`);
          continue;
        }

        processedEmails.add(email);

        try {
          const { data, error } = await supabase.functions.invoke('b2b-create-user', {
            body: {
              nome,
              email,
              id_ies,
              semestre: parseInt(semestreStr),
            },
          });

          if (error || !data?.success) {
            results.push({
              email,
              nome,
              linha: i + 1,
              success: false,
              error: {
                code: data?.code || 'INTERNAL_ERROR',
                message: error?.message || data?.error || 'Erro desconhecido'
              }
            });
            addLog(`Linha ${i + 1}: ${email} - ERRO: ${data?.error || error?.message}`);
          } else {
            results.push({
              email,
              nome,
              linha: i + 1,
              success: true,
              action: data.action,
              message: data.message,
              fieldsUpdated: data.details?.fieldsUpdated,
              emailSent: data.details?.emailSent
            });
            
            const icon = data.action === 'created' ? '✅' : '🔄';
            addLog(`Linha ${i + 1}: ${email} - ${icon} ${data.action}`);
          }
        } catch (err) {
          results.push({
            email,
            nome,
            linha: i + 1,
            success: false,
            error: {
              code: 'INTERNAL_ERROR',
              message: err instanceof Error ? err.message : 'Erro inesperado'
            }
          });
          addLog(`Linha ${i + 1}: ${email} - ERRO: ${err instanceof Error ? err.message : 'Erro inesperado'}`);
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
      addLog(`Processamento concluído: ${report.created} criados, ${report.updated} atualizados, ${report.errors} erros. Emails: ${emailsSent} enviados, ${emailsFailed} falharam.`);
      
      toast.success(`Importação concluída. ${report.created} criados, ${report.updated} atualizados, ${emailsSent} e-mails enviados${emailsFailed > 0 ? `, ${emailsFailed} falharam` : ''}.`);
    } catch (err) {
      console.error('CSV processing error:', err);
      toast.error('Erro ao processar arquivo CSV');
      addLog(`Erro fatal: ${err instanceof Error ? err.message : 'Erro desconhecido'}`);
    } finally {
      setIsProcessing(false);
    }
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
    
    const header = ['nome', 'email', 'id_ies', 'semestre'];
    const exampleRows = iesList.length > 0
      ? [
          ['João Silva', 'joao@exemplo.com', iesList[0].id, 5],
          ['Maria Souza', 'maria@exemplo.com', iesList[0].id, 3],
        ]
      : [
          ['João Silva', 'joao@exemplo.com', 'cole-o-id-da-ies-aqui', 5],
          ['Maria Souza', 'maria@exemplo.com', 'cole-o-id-da-ies-aqui', 3],
        ];

    const wsData = [header, ...exampleRows];
    const ws = XLSX.utils.aoa_to_sheet(wsData);

    // Column widths
    ws['!cols'] = [
      { wch: 25 }, // nome
      { wch: 30 }, // email
      { wch: 40 }, // id_ies
      { wch: 10 }, // semestre
    ];

    // Add IES reference sheet
    const iesData = [['id_ies', 'nome'], ...iesList.map(i => [i.id, i.nome])];
    const wsIes = XLSX.utils.aoa_to_sheet(iesData);
    wsIes['!cols'] = [{ wch: 40 }, { wch: 30 }];

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Usuarios');
    XLSX.utils.book_append_sheet(wb, wsIes, 'IES (Referência)');

    XLSX.writeFile(wb, 'exemplo_cadastro_usuarios.xlsx');
  };

  return (
    <div className="space-y-6">
      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total de Usuários</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {totalUsers !== null ? totalUsers.toLocaleString('pt-BR') : '-'}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Administradores</CardTitle>
            <Shield className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {totalAdmins !== null ? totalAdmins : '-'}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Users List Table - NEW */}
      <UsersListTable iesList={iesList} onStatsUpdate={handleStatsUpdate} />


      {/* Single User Creation */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Mail className="h-5 w-5" />
            Criar Usuário Individual
          </CardTitle>
          <CardDescription>
            Adicione um novo usuário. Um email de convite será enviado automaticamente.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="nome">Nome Completo</Label>
              <Input
                id="nome"
                value={singleUser.nome}
                onChange={(e) => setSingleUser({ ...singleUser, nome: e.target.value })}
                placeholder="João Silva"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                value={singleUser.email}
                onChange={(e) => setSingleUser({ ...singleUser, email: e.target.value })}
                placeholder="joao@example.com"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="ies">Instituição</Label>
              <Select value={singleUser.id_ies} onValueChange={(v) => setSingleUser({ ...singleUser, id_ies: v })}>
                <SelectTrigger>
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
              <Label htmlFor="semestre">Semestre</Label>
              <Input
                id="semestre"
                type="number"
                value={singleUser.semestre}
                onChange={(e) => setSingleUser({ ...singleUser, semestre: e.target.value })}
                placeholder="5"
                min="1"
                max="12"
              />
            </div>
          </div>

          <Button onClick={createSingleUser} disabled={isCreating} className="w-full">
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
      <Card>
        <CardHeader>
          <CardTitle>Cadastro/Atualização em Lote via CSV</CardTitle>
          <CardDescription>
            Importe múltiplos usuários. Novos usuários receberão email de convite. 
            Usuários existentes terão seus dados atualizados.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-2">
            <Input
              type="file"
              accept=".csv"
              onChange={(e) => {
                setCsvFile(e.target.files?.[0] || null);
                setBatchReport(null);
              }}
              disabled={isProcessing}
            />
            <Button variant="outline" onClick={downloadExampleXlsx}>
              <Download className="h-4 w-4 mr-2" />
              Exemplo
            </Button>
          </div>

          <Button onClick={processCsvFile} disabled={!csvFile || isProcessing} className="w-full">
            {isProcessing ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Processando...
              </>
            ) : (
              <>
                <Upload className="h-4 w-4 mr-2" />
                Processar Arquivo
              </>
            )}
          </Button>

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
            <div className="bg-muted rounded-lg p-4 max-h-64 overflow-y-auto">
              <Label className="mb-2 block">Logs de Processamento</Label>
              <div className="font-mono text-xs space-y-1">
                {logs.map((log, i) => (
                  <div key={i}>{log}</div>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};
