import * as React from 'react';
import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { Upload, Download, Users, Shield, RefreshCw, Search, Copy, Loader2, Mail } from 'lucide-react';
import { getBrazilDate } from '@/utils/timezone';
import { BatchProcessingReport, BatchResult, BatchReport } from './BatchProcessingReport';

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
  
  // Sync auth states
  const [syncEmail, setSyncEmail] = useState('');
  const [syncLoading, setSyncLoading] = useState(false);
  const [syncResult, setSyncResult] = useState<{ password?: string; message?: string } | null>(null);

  useEffect(() => {
    fetchIesList();
  }, []);

  const fetchIesList = async () => {
    const { data, error } = await supabase.from('ies').select('id, nome').order('nome');
    if (!error && data) {
      setIesList(data);
    }
  };

  const addLog = (message: string) => {
    const timestamp = getBrazilDate().toLocaleTimeString('pt-BR');
    setLogs(prev => [...prev, `[${timestamp}] ${message}`]);
  };

  const syncUserAuth = async () => {
    if (!syncEmail.trim()) {
      toast.error('Digite o email do usuário');
      return;
    }

    setSyncLoading(true);
    setSyncResult(null);

    try {
      const { data, error } = await supabase.functions.invoke('sync-user-auth', {
        body: { email: syncEmail.trim().toLowerCase() }
      });

      if (error) {
        const errorMsg = error.message || 'Erro ao sincronizar';
        toast.error(errorMsg);
        addLog(`[SYNC] Erro: ${errorMsg}`);
        return;
      }

      if (data?.error) {
        if (data.already_synced) {
          toast.info(data.error);
        } else {
          toast.error(data.error);
        }
        addLog(`[SYNC] ${data.error}`);
        return;
      }

      if (data?.success) {
        toast.success(data.message);
        addLog(`[SYNC] ${data.message}`);
        
        if (data.temporary_password) {
          setSyncResult({ 
            password: data.temporary_password,
            message: 'Senha temporária gerada. Envie para o usuário.'
          });
        } else if (data.password_reset_needed) {
          setSyncResult({
            message: 'IDs sincronizados. Solicite reset de senha pelo Supabase Dashboard.'
          });
        }
      }
    } catch (err) {
      console.error('Sync error:', err);
      toast.error('Erro inesperado ao sincronizar');
    } finally {
      setSyncLoading(false);
    }
  };

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

      const actionMsg = data.action === 'created' 
        ? '✅ Usuário criado! Email de convite enviado.'
        : `🔄 Usuário atualizado: ${data.details?.fieldsUpdated?.join(', ') || 'nenhuma alteração'}`;
      
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
              fieldsUpdated: data.details?.fieldsUpdated
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

      setBatchReport(report);
      addLog(`Processamento concluído: ${report.created} criados, ${report.updated} atualizados, ${report.errors} erros`);
      
      toast.success(`Processamento concluído! ${report.created} criados, ${report.updated} atualizados`);
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

    const csvContent = [
      'email,nome,linha,status,acao,campos_atualizados,erro_codigo,erro_mensagem',
      ...batchReport.results.map(r => [
        r.email,
        `"${r.nome}"`,
        r.linha,
        r.success ? 'sucesso' : 'erro',
        r.action || '',
        r.fieldsUpdated?.join(';') || '',
        r.error?.code || '',
        `"${r.error?.message || ''}"`
      ].join(','))
    ].join('\n');
    
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `relatorio_cadastro_${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const downloadExampleCsv = () => {
    const example = 'nome,email,id_ies,semestre\nJoão Silva,joao@example.com,UUID-DA-IES,5';
    const blob = new Blob([example], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'exemplo_usuarios.csv';
    a.click();
    URL.revokeObjectURL(url);
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
            <div className="text-2xl font-bold">-</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Administradores</CardTitle>
            <Shield className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">-</div>
          </CardContent>
        </Card>
      </div>

      {/* Sync User Auth - Fix Login Issues */}
      <Card className="border-amber-500/30 bg-amber-500/5">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <RefreshCw className="h-5 w-5 text-amber-600" />
            Sincronizar Autenticação
          </CardTitle>
          <CardDescription>
            Corrige problemas de login para usuários importados manualmente. 
            Sincroniza public.users com auth.users.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Email do usuário com problema de login"
                value={syncEmail}
                onChange={(e) => setSyncEmail(e.target.value)}
                className="pl-9"
                onKeyDown={(e) => e.key === 'Enter' && syncUserAuth()}
              />
            </div>
            <Button 
              onClick={syncUserAuth} 
              disabled={syncLoading || !syncEmail.trim()}
              variant="outline"
              className="border-amber-500/50 hover:bg-amber-500/10"
            >
              {syncLoading ? (
                <RefreshCw className="h-4 w-4 animate-spin" />
              ) : (
                <>
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Sincronizar
                </>
              )}
            </Button>
          </div>

          {syncResult && (
            <div className="p-4 bg-muted rounded-lg space-y-2">
              <p className="text-sm text-muted-foreground">{syncResult.message}</p>
              {syncResult.password && (
                <div className="flex gap-2">
                  <Input value={syncResult.password} readOnly className="font-mono" />
                  <Button 
                    variant="outline" 
                    size="icon" 
                    onClick={() => {
                      navigator.clipboard.writeText(syncResult.password!);
                      toast.success('Senha copiada!');
                    }}
                  >
                    <Copy className="h-4 w-4" />
                  </Button>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

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
            <Button variant="outline" onClick={downloadExampleCsv}>
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
