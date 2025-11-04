import React, { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { Upload, Download, Copy, Users, Shield } from 'lucide-react';

interface IES {
  id: string;
  nome: string;
}

interface UserCreationResult {
  email: string;
  password: string;
  success: boolean;
  error?: string;
}

export const UsersTab: React.FC = () => {
  const [iesList, setIesList] = useState<IES[]>([]);
  const [singleUser, setSingleUser] = useState({ nome: '', email: '', id_ies: '', semestre: '' });
  const [generatedPassword, setGeneratedPassword] = useState('');
  const [csvFile, setCsvFile] = useState<File | null>(null);
  const [processingResults, setProcessingResults] = useState<UserCreationResult[]>([]);
  const [logs, setLogs] = useState<string[]>([]);

  useEffect(() => {
    fetchIesList();
  }, []);

  const fetchIesList = async () => {
    const { data, error } = await supabase.from('ies').select('id, nome').order('nome');
    if (!error && data) {
      setIesList(data);
    }
  };

  const generatePassword = () => {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%';
    let password = '';
    for (let i = 0; i < 12; i++) {
      password += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return password;
  };

  const addLog = (message: string) => {
    const timestamp = new Date().toLocaleTimeString();
    setLogs(prev => [...prev, `[${timestamp}] ${message}`]);
  };

  const createSingleUser = async () => {
    if (!singleUser.nome || !singleUser.email || !singleUser.id_ies) {
      toast.error('Preencha todos os campos obrigatórios');
      return;
    }

    const password = generatePassword();
    setGeneratedPassword(password);

    const { data, error } = await supabase.functions.invoke('b2b-create-user', {
      body: {
        nome: singleUser.nome,
        email: singleUser.email,
        id_ies: singleUser.id_ies,
        semestre: singleUser.semestre ? parseInt(singleUser.semestre) : null,
        senha: password,
      },
    });

    if (error) {
      toast.error('Erro ao criar usuário');
      addLog(`Erro ao criar ${singleUser.email}: ${error.message}`);
    } else {
      toast.success('Usuário criado com sucesso!');
      addLog(`Usuário ${singleUser.email} criado com sucesso`);
      setSingleUser({ nome: '', email: '', id_ies: '', semestre: '' });
    }
  };

  const copyPassword = () => {
    navigator.clipboard.writeText(generatedPassword);
    toast.success('Senha copiada!');
  };

  const processCsvFile = async () => {
    if (!csvFile) {
      toast.error('Selecione um arquivo CSV');
      return;
    }

    addLog('Iniciando processamento do arquivo CSV...');
    const text = await csvFile.text();
    const lines = text.split('\n').filter(line => line.trim());
    const headers = lines[0].split(',').map(h => h.trim().toLowerCase());
    
    const results: UserCreationResult[] = [];

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

      const password = generatePassword();
      
      const { error } = await supabase.functions.invoke('b2b-create-user', {
        body: {
          nome: user.nome,
          email: user.email,
          id_ies: user.id_ies,
          semestre: user.semestre ? parseInt(user.semestre) : null,
          senha: password,
        },
      });

      results.push({
        email: user.email,
        password: password,
        success: !error,
        error: error?.message,
      });

      addLog(`${user.email}: ${error ? 'ERRO - ' + error.message : 'Criado com sucesso'}`);
    }

    setProcessingResults(results);
    toast.success(`Processamento concluído: ${results.filter(r => r.success).length} usuários criados`);

    // Auto download CSV with results
    const csvContent = 'email,senha\n' + results
      .filter(r => r.success)
      .map(r => `${r.email},${r.password}`)
      .join('\n');
    
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `senhas_geradas_${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
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

      {/* Single User Creation */}
      <Card>
        <CardHeader>
          <CardTitle>Criar Usuário Individual</CardTitle>
          <CardDescription>Adicione um novo usuário manualmente</CardDescription>
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
              <Label htmlFor="semestre">Semestre (opcional)</Label>
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

          <Button onClick={createSingleUser} className="w-full">
            Criar Usuário
          </Button>

          {generatedPassword && (
            <div className="p-4 bg-muted rounded-lg space-y-2">
              <Label>Senha Gerada</Label>
              <div className="flex gap-2">
                <Input value={generatedPassword} readOnly />
                <Button variant="outline" size="icon" onClick={copyPassword}>
                  <Copy className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Batch User Creation */}
      <Card>
        <CardHeader>
          <CardTitle>Criação em Lote via CSV</CardTitle>
          <CardDescription>Importe múltiplos usuários de uma vez</CardDescription>
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
              Exemplo
            </Button>
          </div>

          <Button onClick={processCsvFile} disabled={!csvFile} className="w-full">
            <Upload className="h-4 w-4 mr-2" />
            Processar Arquivo
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
