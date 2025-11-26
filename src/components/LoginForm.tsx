import React, { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, Mail, Lock, Eye, EyeOff } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { ThemeToggle } from "@/components/ThemeToggle";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { useNavigate } from "react-router-dom";
import { getAccessRules } from "@/utils/accessRules";
export const LoginForm: React.FC = () => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const authContext = useAuth();
  const navigate = useNavigate();
  
  // Se o contexto não estiver disponível, mostra loading
  if (!authContext) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="w-16 h-16 border-4 border-primary/30 border-t-primary rounded-full animate-spin mx-auto"></div>
      </div>
    );
  }
  
  const { login, isLoading } = authContext;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const success = await login(email, password);
    if (success) {
      // Determine default route based on access rules (B2C -> cronograma)
      setTimeout(() => {
        try {
          const stored = localStorage.getItem("sanarflix-user");
          let target = "/home";
          if (stored) {
            const parsed = JSON.parse(stored);
            const rules = getAccessRules(parsed);
            target = rules.cronogramaEnamed ? "/cronograma-enamed" : "/home";
          }
          navigate(target, { replace: true });
        } catch (err) {
          navigate("/home", { replace: true });
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
              alt="Logo SanarFlix Academy"
              className="w-12 h-12 rounded-xl mr-3 shadow-lg object-contain"
              loading="eager"
              width="48"
              height="48"
            />
            <div>
              <h1 className="text-2xl font-bold text-neutral-900 dark:text-primary-foreground">SanarFlix Academy</h1>
              <p className="text-sm text-neutral-600 dark:text-muted-foreground">Plataforma Institucional B2B</p>
            </div>
          </div>

          <Card className="border border-border shadow-lg">
            <CardHeader className="space-y-1 pb-6">
              <CardTitle className="text-2xl font-bold text-neutral-900 dark:text-primary-foreground">
                Faça seu login
              </CardTitle>
              <CardDescription className="text-neutral-600 dark:text-muted-foreground"></CardDescription>
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
                  <Button type="button" variant="link" className="px-0 text-primary" onClick={handleResetPassword}>
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
                    "Entrar"
                  )}
                </Button>
              </form>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Right Side - Banner with Institutional Message */}
      <div className="hidden md:flex flex-1 relative overflow-hidden bg-gradient-to-br from-primary/95 to-primary">
        <div className="absolute inset-0 flex flex-col items-center justify-center p-12 text-white">
          <div className="max-w-2xl space-y-8">
            <div className="flex items-center justify-center mb-6">
              <img
                src="/lovable-uploads/8b68f9f7-c5f4-42f8-9ac8-0bffc3fdb96d.png"
                alt="SanarFlix Academy"
                className="w-20 h-20 rounded-2xl shadow-2xl"
              />
            </div>
            
            <h2 className="text-4xl font-bold text-center leading-tight">
              SanarFlix Academy
            </h2>
            
            <p className="text-lg text-white/90 text-center leading-relaxed">
              Plataforma B2B exclusiva para <strong>Universidades Parceiras da Sanar</strong>. 
              Centralize entregas pedagógicas personalizadas com guias de estudos alinhados à ementa 
              da sua faculdade, simulados com análise de desempenho detalhada e métricas gerais de 
              engajamento e consumo dos estudantes de medicina.
            </p>

            <div className="grid grid-cols-1 gap-4 mt-8">
              <div className="flex items-start gap-4 p-4 bg-white/10 backdrop-blur-sm rounded-xl border border-white/20">
                <div className="flex-shrink-0 w-12 h-12 bg-white/20 rounded-lg flex items-center justify-center">
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                  </svg>
                </div>
                <div>
                  <h3 className="font-semibold text-lg mb-1">Dashboard de acompanhamento</h3>
                  <p className="text-sm text-white/80">Monitore o progresso individual e coletivo em tempo real</p>
                </div>
              </div>
              
              <div className="flex items-start gap-4 p-4 bg-white/10 backdrop-blur-sm rounded-xl border border-white/20">
                <div className="flex-shrink-0 w-12 h-12 bg-white/20 rounded-lg flex items-center justify-center">
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                </div>
                <div>
                  <h3 className="font-semibold text-lg mb-1">Conteúdo personalizado por semestre</h3>
                  <p className="text-sm text-white/80">Material didático alinhado à grade curricular da instituição</p>
                </div>
              </div>
              
              <div className="flex items-start gap-4 p-4 bg-white/10 backdrop-blur-sm rounded-xl border border-white/20">
                <div className="flex-shrink-0 w-12 h-12 bg-white/20 rounded-lg flex items-center justify-center">
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                  </svg>
                </div>
                <div>
                  <h3 className="font-semibold text-lg mb-1">Análise de desempenho detalhada</h3>
                  <p className="text-sm text-white/80">Métricas de engajamento e insights para tomada de decisão</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
