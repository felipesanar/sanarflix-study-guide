import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2, Mail, Lock, Eye, EyeOff } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { ThemeToggle } from '@/components/ThemeToggle';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import { useNavigate } from 'react-router-dom';
import { getAccessRules } from '@/utils/accessRules';
export const LoginForm: React.FC = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const { login, isLoading } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const success = await login(email, password);
    if (success) {
      // Determine default route based on access rules (B2C -> cronograma)
      setTimeout(() => {
        try {
          const stored = localStorage.getItem('sanarflix-user');
          let target = '/intensivao-enamed';
          if (stored) {
            const parsed = JSON.parse(stored);
            const rules = getAccessRules(parsed);
            target = rules.cronogramaEnamed ? '/cronograma-enamed' : '/intensivao-enamed';
          }
          navigate(target, { replace: true });
        } catch (err) {
          
          navigate('/intensivao-enamed', { replace: true });
        }
      }, 50);
    }
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
      const redirectTo = `${window.location.origin}/reset-password`;
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
                      type={showPassword ? "text" : "password"}
                      placeholder="Sua senha"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="pl-10 pr-10 h-12 border-neutral-300 focus:border-primary focus:ring-primary/20 transition-colors-smooth"
                      required
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="absolute right-0 top-0 h-12 px-3 hover:bg-transparent"
                      onClick={() => setShowPassword(!showPassword)}
                    >
                      {showPassword ? (
                        <EyeOff className="h-4 w-4 text-neutral-400" />
                      ) : (
                        <Eye className="h-4 w-4 text-neutral-400" />
                      )}
                    </Button>
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

      {/* Right Side - Banner Image */}
      <div className="hidden md:flex flex-1 relative overflow-hidden">
        <img
          src="/lovable-uploads/a6e8ef24-a186-4923-b03e-bb52d20ca2dd.png"
          alt="Guia de Estudos - Plataforma desenvolvida em parceria com as faculdades para otimizar seus estudos"
          className="w-full h-full object-cover"
          loading="lazy"
        />
      </div>
    </div>
  );
};
