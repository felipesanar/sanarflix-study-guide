import * as React from 'react';
import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { Upload, Download, Copy, Users, Shield, RefreshCw, Search, Mail } from 'lucide-react';
import { getBrazilDate } from '@/utils/timezone';

// --- Interfaces ---

interface IES {
  id: string;
  nome: string;
}

interface UserCreationResult {
  email: string;
  success: boolean;
  action?: 'invite' | 'reset'; // Identifica o que ocorreu no backend
  error?: string;
}

// --- Componente Principal ---

export const UsersTab: React.FC = () => {
  // Estados de Dados
  const [iesList, setIesList] = useState<IES[]>([]);
  const [singleUser, setSingleUser] = useState({ nome: '', email: '', id_ies: '', semestre: '' });

  // Estados de Processamento em Lote
  const [csvFile, setCsvFile] = useState<File | null>(null);
  const [logs, setLogs] = useState<string[]>([]);

  // Estados de Sincronização (Manutenção)
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

  // --- Helper de Segurança ---
  const checkSession = async () => {
    const { data: { session }, error } = await supabase.auth.getSession();
    if (error || !session) {
      toast.error("Sessão expirada. Por favor, faça login novamente.");
      console.error("[Auth] Sem sessão ativa ou erro ao obter sessão");
      return false;
    }
    return true;
  };

  // --- Função 1: Sincronizar Usuário (Manutenção) ---
  const syncUserAuth = async () => {
    if (!syncEmail.trim()) {
      toast.error('Digite o email do usuário');
      return;
    }

    if (!(await checkSession())) return;

    setSyncLoading(true);
    setSyncResult(null);

    try {
      const { data, error } = await supabase.functions.invoke('sync-user-auth', {
        body: { email: syncEmail.trim().toLowerCase() }
      });

      if (error) throw new Error(error.message);

      if (data?.error) {
        toast.error(data.error);
        addLog(`[SYNC] ${data.error}`);
        return;
      }

      if (data?.success) {
        toast.success(data.message);
        addLog(`[SYNC] ${data.message}`);

        // Mantive a lógica de senha AQUI apenas caso a função sync retorne uma temporária
        if (data.temporary_password) {
          setSyncResult({
            password: data.temporary_password,
            message: 'Senha temporária gerada (Sync).'
          });
        } else {
          setSyncResult({ message: 'Sincronizado. Solicite reset de senha.' });
        }
      }
    } catch (err: any) {
      console.error('Sync error:', err);
      toast.error(err.message || 'Erro ao sincronizar');
    } finally {
      setSyncLoading(false);
    }
  };

  // --- Função 2: Criar Usuário Individual (Invite Flow) ---
  const createSingleUser = async () => {
    // Validação de inputs
    if (!singleUser.nome || !singleUser.email || !singleUser.id_ies) {
      toast.error('Preencha todos os campos obrigatórios');
      return;
    }

    // Validação de segurança
    if (!(await checkSession())) return;

    try {
      const { data, error } = await supabase.functions.invoke('b2b-create-user', {
        body: {
          nome: singleUser.nome,
          email: singleUser.email,
          id_ies: singleUser.id_ies,
          semestre: singleUser.semestre ? parseInt(singleUser.semestre) : null,
        },
      });

      if (error) throw new Error(error.message);

      if (data?.error) {
        const detailMsg = data.details ? `: ${data.details}` : '';
        throw new Error(data.error + detailMsg);
      }

      // Sucesso: Diferenciar Invite de Reset
      const actionType = data.action === 'reset' ? 'Link de redefinição' : 'Convite';
      const successMsg = `Sucesso! ${actionType} enviado para ${singleUser.email}`;

      toast.success(successMsg);
      addLog(successMsg);

      // Limpa formulário
      setSingleUser({ nome: '', email: '', id_ies: '', semestre: '' });

    } catch (err: any) {
      const msg = err.message || 'Erro desconhecido';
      toast.error(msg);
      addLog(`Erro ao convidar ${singleUser.email}: ${msg}`);
    }
  };

  // --- Função 3: Processamento em Lote (Invite Flow) ---
  const processCsvFile = async () => {
    if (!csvFile) {
      toast.error('Selecione um arquivo CSV');
      return;
    }

    if (!(await checkSession())) return;

    addLog('Iniciando processamento do arquivo CSV...');
    const text = await csvFile.text();
    const lines = text.split('\n').filter(line => line.trim());

    // Normaliza headers
    const headers = lines[0].split(',').map(h => h.trim().toLowerCase());

    if (!headers.includes('nome') || !headers.includes('email') || !headers.includes('id_ies')) {
      toast.error('CSV inválido. Headers obrigatórios: nome, email, id_ies');
      return;
    }

    const results: UserCreationResult[] = [];

    // Loop de processamento
    for (let i = 1; i < lines.length; i++) {
      const values = lines[i].split(',').map(v => v.trim());
      const user: any = {};

      headers.forEach((header, index) => {
        user[header] = values[index];
      });

      if (!user.nome || !user.email || !user.id_ies) {
        addLog(`Linha ${i + 1}: Dados incompletos, pulando...`);
        continue;
      }

      try {
        const { data, error } = await supabase.functions.invoke('b2b-create-user', {
          body: {
            nome: user.nome,
            email: user.email,
            id_ies: user.id_ies,
            semestre: user.semestre ? parseInt(user.semestre) : null,
          },
        });

        if (error) throw new Error(error.message);
        if (data?.error) throw new Error(`${data.error} ${data.details || ''}`);

        results.push({
          email: user.email,
          success: true,
          action: data.action // 'invite' ou 'reset'
        });
        addLog(`${user.email}: Email enviado (${data.action === 'reset' ? 'Reset' : 'Novo Convite'})`);

      } catch (err: any) {
        results.push({
          email: user.email,
          success: false,
          error: err.message
        });
        addLog(`${user.email}: ERRO - ${err.message}`);
      }
    }

    // Feedback Final e Download de Relatório
    const successCount = results.filter(r => r.success).length;

    if (successCount > 0) {
      toast.success(`Processamento: ${successCount} emails enviados.`);

      // Gera CSV de Status (Sem senhas)
      const csvContent = 'email,status,detalhe\n' + results
        .map(r => `${r.email},${r.success ? 'SUCESSO' : 'ERRO'},${r.success ? (r.action === 'reset' ? 'Reset Enviado' : 'Convite Enviado') : r.error}`)
        .join('\n');

      const blob = new Blob([csvContent], { type: 'text/csv' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `relatorio_convites_${new Date().toISOString().split('T')[0]}.csv`;
      a.click();
    } else {
      toast.error("Nenhum convite enviado com sucesso. Verifique os logs.");
    }
  };

  const copyPassword = (pwd: string) => {
    navigator.clipboard.writeText(pwd);
    toast.success('Senha copiada!');
  };

  const downloadExampleCsv = () => {
    const example = 'nome,email,id_ies,semestre\nJoão Silva,joao@example.com,UUID-DA-IES,5';
    const blob = new Blob([example], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'exemplo_usuarios.csv';
    a.click();
  };

  return (
    <div className="space-y-6">

      {/* 1. Sync User Auth (Manutenção) */}
      <Card className="border-amber-500/30 bg-amber-500/5">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <RefreshCw className="h-5 w-5 text-amber-600" />
            Sincronizar Autenticação
          </CardTitle>
          <CardDescription>
            Use apenas para corrigir usuários com erro de login. Sincroniza tabelas internas.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Email do usuário"
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
              {syncLoading ? <RefreshCw className="h-4 w-4 animate-spin" /> : "Sincronizar"}
            </Button>
          </div>

          {syncResult && (
            <div className="p-4 bg-muted rounded-lg space-y-2">
              <p className="text-sm text-muted-foreground">{syncResult.message}</p>
              {syncResult.password && (
                <div className="flex gap-2">
                  <Input value={syncResult.password} readOnly className="font-mono" />
                  <Button variant="outline" size="icon" onClick={() => copyPassword(syncResult.password!)}>
                    <Copy className="h-4 w-4" />
                  </Button>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* 2. Single User Invite (Fluxo Principal) */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Mail className="h-5 w-5" />
            Convidar Usuário
          </CardTitle>
          <CardDescription>
            O usuário receberá um email com link para definir sua própria senha.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Nome Completo</Label>
              <Input
                value={singleUser.nome}
                onChange={(e) => setSingleUser({ ...singleUser, nome: e.target.value })}
                placeholder="João Silva"
              />
            </div>
            <div className="space-y-2">
              <Label>Email</Label>
              <Input
                type="email"
                value={singleUser.email}
                onChange={(e) => setSingleUser({ ...singleUser, email: e.target.value })}
                placeholder="joao@example.com"
              />
            </div>
            <div className="space-y-2">
              <Label>Instituição</Label>
              <Select value={singleUser.id_ies} onValueChange={(v) => setSingleUser({ ...singleUser, id_ies: v })}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione a IES" />
                </SelectTrigger>
                <SelectContent>
                  {iesList.map((ies) => (
                    <SelectItem key={ies.id} value={ies.id}>{ies.nome}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Semestre (opcional)</Label>
              <Input
                type="number"
                value={singleUser.semestre}
                onChange={(e) => setSingleUser({ ...singleUser, semestre: e.target.value })}
                placeholder="1"
                min="1"
                max="12"
              />
            </div>
          </div>

          <Button onClick={createSingleUser} className="w-full">
            <Mail className="h-4 w-4 mr-2" />
            Enviar Convite
          </Button>
        </CardContent>
      </Card>

      {/* 3. Batch Invite (CSV) */}
      <Card>
        <CardHeader>
          <CardTitle>Convites em Lote (CSV)</CardTitle>
          <CardDescription>
            Importe uma lista. Usuários existentes receberão link de reset; novos receberão convite.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-2">
            <Input
              type="file"
              accept=".csv"
              onChange={(e) => setCsvFile(e.target.files?.[0] || null)}
            />
            <Button variant="outline" onClick={downloadExampleCsv}>
              <Download className="h-4 w-4 mr-2" />
              Modelo CSV
            </Button>
          </div>

          <Button onClick={processCsvFile} disabled={!csvFile} className="w-full">
            <Upload className="h-4 w-4 mr-2" />
            Processar e Enviar Emails
          </Button>

          {logs.length > 0 && (
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