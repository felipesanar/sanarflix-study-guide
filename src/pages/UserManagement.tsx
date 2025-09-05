import React, { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { Upload, User, Users, Download, Copy, Loader2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';

interface UserCreationResult {
  email: string;
  password: string;
  success: boolean;
  error?: string;
}

const UserManagement: React.FC = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  
  // Estados para criação unitária
  const [singleUser, setSingleUser] = useState({
    nome: '',
    email: '',
    id_ies: '',
    semestre: ''
  });
  const [singleUserPassword, setSingleUserPassword] = useState('');
  const [isCreatingSingle, setIsCreatingSingle] = useState(false);

  // Estados para criação em lote
  const [csvFile, setCsvFile] = useState<File | null>(null);
  const [isProcessingBatch, setIsProcessingBatch] = useState(false);
  const [batchResults, setBatchResults] = useState<UserCreationResult[]>([]);
  const [processedCount, setProcessedCount] = useState(0);
  const [totalCount, setTotalCount] = useState(0);

  // Estados para logs
  const [logs, setLogs] = useState<string[]>([]);

  // Verifica se o usuário tem acesso B2B
  const hasB2BAccess = user?.id_ies === '9f21b138-0027-44c8-9660-dc6706d57bc0';

  if (!hasB2BAccess) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Alert className="max-w-md">
          <AlertDescription>
            Você não tem permissão para acessar esta página. Esta funcionalidade é restrita a usuários B2B.
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  const generatePassword = () => {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let result = '';
    for (let i = 0; i < 4; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return `SenhaSegura@${result}`;
  };

  const addLog = (message: string) => {
    const timestamp = new Date().toLocaleTimeString();
    setLogs(prev => [...prev, `[${timestamp}] ${message}`]);
  };

  const createSingleUser = async () => {
    if (!singleUser.nome || !singleUser.email || !singleUser.id_ies || !singleUser.semestre) {
      toast({
        title: "Erro",
        description: "Todos os campos são obrigatórios",
        variant: "destructive"
      });
      return;
    }

    setIsCreatingSingle(true);
    const password = generatePassword();
    
    try {
      addLog(`Iniciando criação do usuário: ${singleUser.email}`);
      
      // Criar usuário no auth
      const { data: authData, error: authError } = await supabase.auth.admin.createUser({
        email: singleUser.email,
        password: password,
        email_confirm: true,
        user_metadata: {
          nome: singleUser.nome,
          id_ies: singleUser.id_ies,
          semestre: parseInt(singleUser.semestre)
        }
      });

      if (authError) {
        addLog(`Erro ao criar usuário no auth: ${authError.message}`);
        throw authError;
      }

      addLog(`Usuário criado no auth com sucesso: ${singleUser.email}`);

      // Upsert na tabela users
      const { error: upsertError } = await supabase
        .from('users')
        .upsert({
          id: authData.user.id,
          email: singleUser.email,
          nome: singleUser.nome,
          id_ies: singleUser.id_ies,
          semestre: parseInt(singleUser.semestre)
        });

      if (upsertError) {
        addLog(`Erro ao inserir/atualizar usuário na tabela: ${upsertError.message}`);
        throw upsertError;
      }

      addLog(`Usuário inserido/atualizado na tabela com sucesso`);
      setSingleUserPassword(password);
      
      toast({
        title: "Sucesso",
        description: "Usuário criado com sucesso!",
      });

      // Limpar formulário
      setSingleUser({ nome: '', email: '', id_ies: '', semestre: '' });

    } catch (error: any) {
      toast({
        title: "Erro",
        description: error.message || "Erro ao criar usuário",
        variant: "destructive"
      });
    } finally {
      setIsCreatingSingle(false);
    }
  };

  const copyPassword = () => {
    navigator.clipboard.writeText(singleUserPassword);
    toast({
      title: "Copiado!",
      description: "Senha copiada para a área de transferência",
    });
  };

  const processCsvFile = async () => {
    if (!csvFile) {
      toast({
        title: "Erro",
        description: "Selecione um arquivo CSV",
        variant: "destructive"
      });
      return;
    }

    setIsProcessingBatch(true);
    setBatchResults([]);
    setProcessedCount(0);
    
    try {
      const text = await csvFile.text();
      const lines = text.split('\n').filter(line => line.trim());
      const headers = lines[0].split(',').map(h => h.trim());
      
      if (!headers.includes('nome') || !headers.includes('email') || !headers.includes('id_ies') || !headers.includes('semestre')) {
        throw new Error('CSV deve conter as colunas: nome, email, id_ies, semestre');
      }

      const users = lines.slice(1).map(line => {
        const values = line.split(',').map(v => v.trim());
        return {
          nome: values[headers.indexOf('nome')],
          email: values[headers.indexOf('email')],
          id_ies: values[headers.indexOf('id_ies')],
          semestre: values[headers.indexOf('semestre')]
        };
      });

      setTotalCount(users.length);
      addLog(`Iniciando processamento de ${users.length} usuários`);

      const results: UserCreationResult[] = [];

      for (const userData of users) {
        const password = generatePassword();
        
        try {
          addLog(`Processando: ${userData.email}`);
          
          // Criar usuário no auth
          const { data: authData, error: authError } = await supabase.auth.admin.createUser({
            email: userData.email,
            password: password,
            email_confirm: true,
            user_metadata: {
              nome: userData.nome,
              id_ies: userData.id_ies,
              semestre: parseInt(userData.semestre)
            }
          });

          if (authError) {
            results.push({
              email: userData.email,
              password: '',
              success: false,
              error: authError.message
            });
            addLog(`Erro no auth para ${userData.email}: ${authError.message}`);
            continue;
          }

          // Upsert na tabela users
          const { error: upsertError } = await supabase
            .from('users')
            .upsert({
              id: authData.user.id,
              email: userData.email,
              nome: userData.nome,
              id_ies: userData.id_ies,
              semestre: parseInt(userData.semestre)
            });

          if (upsertError) {
            results.push({
              email: userData.email,
              password: '',
              success: false,
              error: upsertError.message
            });
            addLog(`Erro na tabela para ${userData.email}: ${upsertError.message}`);
            continue;
          }

          results.push({
            email: userData.email,
            password: password,
            success: true
          });
          
          addLog(`Sucesso: ${userData.email}`);
          
        } catch (error: any) {
          results.push({
            email: userData.email,
            password: '',
            success: false,
            error: error.message
          });
          addLog(`Erro inesperado para ${userData.email}: ${error.message}`);
        }
        
        setProcessedCount(prev => prev + 1);
      }

      setBatchResults(results);
      
      const successCount = results.filter(r => r.success).length;
      const errorCount = results.filter(r => !r.success).length;
      
      addLog(`Processamento concluído: ${successCount} sucessos, ${errorCount} erros`);
      
      toast({
        title: "Processamento concluído",
        description: `${successCount} usuários criados, ${errorCount} erros`,
      });

    } catch (error: any) {
      toast({
        title: "Erro",
        description: error.message || "Erro ao processar arquivo",
        variant: "destructive"
      });
      addLog(`Erro fatal: ${error.message}`);
    } finally {
      setIsProcessingBatch(false);
    }
  };

  const downloadExampleCsv = () => {
    const csvContent = 'nome,email,id_ies,semestre\nJoão Silva,joao@exemplo.com,9f21b138-0027-44c8-9660-dc6706d57bc0,5';
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'exemplo_usuarios.csv';
    a.click();
    window.URL.revokeObjectURL(url);
  };

  const downloadResultsCsv = () => {
    const successfulResults = batchResults.filter(r => r.success);
    const csvContent = 'email,senha\n' + successfulResults.map(r => `${r.email},${r.password}`).join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'senhas_geradas.csv';
    a.click();
    window.URL.revokeObjectURL(url);
    
    toast({
      title: "Download concluído",
      description: "⚠️ Trate este arquivo com segurança e apague-o após o uso!",
    });
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-foreground">Gestão de Usuários</h1>
        <p className="text-muted-foreground">Criar usuários unitariamente ou em lote via CSV</p>
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        {/* Card Criação Unitária */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <User className="h-5 w-5" />
              Criar Usuário Unitário
            </CardTitle>
            <CardDescription>
              Criar um usuário por vez com dados individuais
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="nome">Nome Completo</Label>
              <Input
                id="nome"
                value={singleUser.nome}
                onChange={(e) => setSingleUser(prev => ({ ...prev, nome: e.target.value }))}
                placeholder="João Silva"
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                value={singleUser.email}
                onChange={(e) => setSingleUser(prev => ({ ...prev, email: e.target.value }))}
                placeholder="joao@exemplo.com"
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="id_ies">ID da IES</Label>
              <Input
                id="id_ies"
                value={singleUser.id_ies}
                onChange={(e) => setSingleUser(prev => ({ ...prev, id_ies: e.target.value }))}
                placeholder="9f21b138-0027-44c8-9660-dc6706d57bc0"
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="semestre">Semestre</Label>
              <Select value={singleUser.semestre} onValueChange={(value) => setSingleUser(prev => ({ ...prev, semestre: value }))}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione o semestre" />
                </SelectTrigger>
                <SelectContent>
                  {[1,2,3,4,5,6,7,8,9,10,11,12].map(sem => (
                    <SelectItem key={sem} value={sem.toString()}>{sem}º Semestre</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <Button 
              onClick={createSingleUser} 
              disabled={isCreatingSingle}
              className="w-full"
            >
              {isCreatingSingle ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Criando...
                </>
              ) : (
                'Criar Usuário'
              )}
            </Button>

            {singleUserPassword && (
              <Alert>
                <AlertDescription className="flex items-center justify-between">
                  <span>Senha gerada: <code className="font-mono">{singleUserPassword}</code></span>
                  <Button size="sm" variant="outline" onClick={copyPassword}>
                    <Copy className="h-4 w-4" />
                  </Button>
                </AlertDescription>
              </Alert>
            )}
          </CardContent>
        </Card>

        {/* Card Criação em Lote */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              Criar em Lote (CSV)
            </CardTitle>
            <CardDescription>
              Upload de arquivo CSV para criar múltiplos usuários
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="csv-file">Arquivo CSV</Label>
              <Input
                id="csv-file"
                type="file"
                accept=".csv"
                onChange={(e) => setCsvFile(e.target.files?.[0] || null)}
              />
            </div>

            <Button 
              variant="outline" 
              onClick={downloadExampleCsv}
              className="w-full"
            >
              <Download className="mr-2 h-4 w-4" />
              Baixar CSV de Exemplo
            </Button>

            <Button 
              onClick={processCsvFile}
              disabled={isProcessingBatch || !csvFile}
              className="w-full"
            >
              {isProcessingBatch ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Processando... ({processedCount}/{totalCount})
                </>
              ) : (
                <>
                  <Upload className="mr-2 h-4 w-4" />
                  Processar CSV
                </>
              )}
            </Button>

            {batchResults.length > 0 && (
              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <span className="text-sm">Resultados:</span>
                  <div className="flex gap-2">
                    <Badge variant="default">
                      {batchResults.filter(r => r.success).length} sucessos
                    </Badge>
                    <Badge variant="destructive">
                      {batchResults.filter(r => !r.success).length} erros
                    </Badge>
                  </div>
                </div>
                
                {batchResults.some(r => r.success) && (
                  <Button 
                    variant="outline" 
                    onClick={downloadResultsCsv}
                    className="w-full"
                  >
                    <Download className="mr-2 h-4 w-4" />
                    Baixar CSV com Senhas
                  </Button>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Logs */}
      {logs.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Logs de Processamento</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="bg-muted p-4 rounded-md max-h-60 overflow-y-auto">
              <pre className="text-sm whitespace-pre-wrap">
                {logs.join('\n')}
              </pre>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default UserManagement;