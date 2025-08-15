import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2, Mail, Lock, GraduationCap } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { ThemeToggle } from '@/components/ThemeToggle';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
export const LoginForm: React.FC = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const { login, isLoading } = useAuth();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await login(email, password);
  };

  const handleResetPassword = async () => {
    if (!email) {
      toast({
        title: "Informe seu e-mail",
        description: "Digite seu e-mail acima para enviarmos o link de redefinição.",
        duration: 3000,
      });
      return;
    }

    try {
      const redirectTo = `${window.location.origin}/auth/callback`;
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo,
      });
      if (error) throw error;
      toast({
        title: "Verifique seu e-mail",
        description: "Enviamos um link para redefinir sua senha.",
        duration: 4000,
      });
    } catch (err: any) {
      console.error("resetPassword error:", err);
      toast({
        title: "Não foi possível enviar o e-mail",
        description: err?.message || "Tente novamente em instantes.",
        variant: "destructive",
        duration: 3500,
      });
    }
  };
  return (
    <div className="min-h-screen flex relative bg-background text-foreground">
      {/* Theme toggle */}
      <div className="absolute top-4 right-4 z-10">
        <ThemeToggle />
      </div>
      {/* Left Side - Login Form */}
      <div className="flex-1 flex items-center justify-center p-8 lg:p-16 bg-card">
        <div className="w-full max-w-md animate-slide-in-left">
          <div className="flex items-center mb-8">
            <img
              src="/lovable-uploads/8b68f9f7-c5f4-42f8-9ac8-0bffc3fdb96d.png"
              alt="Logo Sanarflix"
              className="w-12 h-12 rounded-xl mr-3 shadow-lg object-contain"
            />
            <div>
              <h1 className="text-2xl font-bold text-neutral-900 dark:text-primary-foreground">Sanarflix</h1>
              <p className="text-sm text-neutral-600 dark:text-muted-foreground">Guia de Estudos</p>
            </div>
          </div>

          <Card className="border border-border shadow-lg">
            <CardHeader className="space-y-1 pb-6">
              <CardTitle className="text-2xl font-bold text-neutral-900 dark:text-primary-foreground">
                Faça seu login
              </CardTitle>
              <CardDescription className="text-neutral-600 dark:text-muted-foreground">
                Acesse com suas credenciais do Sanarflix
              </CardDescription>
            </CardHeader>
            
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-6">
                <div className="space-y-2">
                  <Label htmlFor="email" className="text-sm font-medium text-neutral-700">
                    E-mail
                  </Label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-3.5 h-4 w-4 text-neutral-400" />
                    <Input
                      id="email"
                      type="email"
                      placeholder="seu@email.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="pl-10 h-12 border-neutral-300 focus:border-primary focus:ring-primary/20 transition-colors-smooth"
                      required
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="password" className="text-sm font-medium text-neutral-700">
                    Senha
                  </Label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-3.5 h-4 w-4 text-neutral-400" />
                    <Input
                      id="password"
                      type="password"
                      placeholder="Sua senha"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="pl-10 h-12 border-neutral-300 focus:border-primary focus:ring-primary/20 transition-colors-smooth"
                      required
                    />
                  </div>
                </div>

                <div className="flex items-center justify-end -mt-2">
                  <Button
                    type="button"
                    variant="link"
                    className="px-0 text-primary"
                    onClick={handleResetPassword}
                  >
                    Esqueci a senha
                  </Button>
                </div>

                <Button 
                  type="submit" 
                  className="w-full h-12 bg-primary hover:bg-primary-dark text-white font-semibold shadow-lg hover:shadow-xl transition-all duration-200 hover:scale-[1.02]"
                  disabled={isLoading}
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Entrando...
                    </>
                  ) : (
                    'Entrar'
                  )}
                </Button>
              </form>

            </CardContent>
          </Card>
        </div>
      </div>

      {/* Right Side - Institutional Block */}
      <div className="hidden md:flex flex-1 bg-gradient-to-br from-primary-900 to-primary-700 flex items-center justify-center p-8 lg:p-16 relative overflow-hidden">
        {/* Background pattern */}
        <div className="absolute inset-0 opacity-10">
          <div className="w-full h-full" style={{
            backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23ffffff' fill-opacity='0.1'%3E%3Ccircle cx='30' cy='30' r='1'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`,
          }} />
        </div>
        
        <div className="relative z-10 text-center text-white animate-slide-in-right max-w-lg">
          <div className="mb-8">
            <div className="inline-flex items-center justify-center w-20 h-20 bg-white/10 rounded-3xl mb-6 backdrop-blur-sm">
              <img src="/lovable-uploads/8b68f9f7-c5f4-42f8-9ac8-0bffc3fdb96d.png" alt="Logo Sanarflix" className="w-14 h-14 object-contain" />
            </div>
          </div>
          
          <h2 className="text-4xl font-bold mb-6 leading-tight">
            Acesso ao Guia de Estudos 
            <span className="block text-primary-light">Sanarflix</span>
          </h2>
          
          <p className="text-xl text-white/90 mb-8 leading-relaxed">
            Plataforma desenvolvida em parceria com as faculdades para otimizar seus estudos
          </p>
          
          <div className="grid grid-cols-1 gap-4 text-left">
            <div className="flex items-center space-x-3">
              <div className="w-2 h-2 bg-primary-light rounded-full"></div>
              <span className="text-white/80">Conteúdo personalizado por semestre</span>
            </div>
            <div className="flex items-center space-x-3">
              <div className="w-2 h-2 bg-primary-light rounded-full"></div>
              <span className="text-white/80">Progresso individual detalhado</span>
            </div>
            <div className="flex items-center space-x-3">
              <div className="w-2 h-2 bg-primary-light rounded-full"></div>
              <span className="text-white/80">Dashboard de progresso para acompanhamento</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
