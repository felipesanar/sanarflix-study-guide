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
import Logger from "@/utils/logger";
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
    Logger.userAction('login_submit', { email: email.trim().toLowerCase().replace(/(.{2}).+(@.*)/, '$1***$2') });
    const success = await login(email.trim().toLowerCase(), password);
    Logger.debug('login_result', { success });
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
          Logger.info('post_login_navigation', { target });
          navigate(target, { replace: true });
        } catch (err) {
          navigate("/home", { replace: true });
        }
      }, 50);
    }
  };
  const handleResetPassword = async () => {
    const normalizedEmail = email.trim().toLowerCase();
    if (!normalizedEmail) {
      toast({
        title: "Informe seu e-mail",
        description: "Digite seu e-mail acima para enviarmos o link de redefinição.",
        duration: 3000,
      });
      return;
    }

    try {
      const redirectTo = `${window.location.origin}/reset-password`;
      const { error } = await supabase.auth.resetPasswordForEmail(normalizedEmail, {
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
    <div className="min-h-screen flex relative bg-[linear-gradient(135deg,theme(colors.background)_0%,theme(colors.background)_20%,rgba(220,38,38,0.12)_50%,rgba(220,38,38,0.22)_100%)] dark:bg-[linear-gradient(135deg,theme(colors.background)_0%,rgba(220,38,38,0.14)_35%,rgba(220,38,38,0.28)_100%)] text-foreground">
      <div className="absolute top-4 right-4 z-10">
        <ThemeToggle />
      </div>
      <div aria-hidden className="absolute inset-0 -z-10 overflow-hidden">
        <div className="absolute -top-40 -left-40 w-[70rem] h-[70rem] bg-[radial-gradient(ellipse_at_center,var(--tw-gradient-stops))] from-primary/40 via-primary/24 to-transparent dark:from-primary/50 dark:via-primary/28 dark:to-transparent blur-3xl" />
        <div className="absolute -bottom-32 -right-32 w-[70rem] h-[70rem] bg-[radial-gradient(ellipse_at_center,var(--tw-gradient-stops))] from-primary/40 via-primary/24 to-transparent dark:from-primary/46 dark:via-primary/26 dark:to-transparent blur-3xl" />
        <div className="absolute inset-0 bg-gradient-to-r from-transparent via-primary/24 to-transparent dark:via-primary/28" />
        <div className="absolute inset-y-0 left-1/2 -translate-x-1/2 w-[100rem] max-w-[85vw] bg-[radial-gradient(ellipse_at_center,var(--tw-gradient-stops))] from-primary/30 via-primary/20 to-transparent dark:from-primary/34 dark:via-primary/22 dark:to-transparent blur-2xl" />
      </div>
      <div className="flex-1 flex items-center justify-center p-8 lg:p-16 bg-transparent backdrop-blur-sm">
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
              <p className="text-sm text-neutral-600 dark:text-muted-foreground">Para Universidades Parceiras</p>
            </div>
          </div>

          <Card className="border border-border shadow-2xl bg-card/95 backdrop-blur-sm">
            <CardHeader className="space-y-1 pb-6">
              <CardTitle className="text-2xl font-bold text-foreground">
                Faça seu login
              </CardTitle>
              <CardDescription className="text-muted-foreground"></CardDescription>
            </CardHeader>

            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-6">
                <div className="space-y-2">
                  <Label htmlFor="email" className="text-sm font-medium text-neutral-700">
                    E-mail
                  </Label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-3.5 h-4 w-4 text-neutral-500 dark:text-neutral-400" />
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
                    <Lock className="absolute left-3 top-3.5 h-4 w-4 text-neutral-500 dark:text-neutral-400" />
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
                        <EyeOff className="h-4 w-4 text-neutral-600 dark:text-neutral-400" />
                      ) : (
                        <Eye className="h-4 w-4 text-neutral-600 dark:text-neutral-400" />
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

      <div className="hidden md:flex flex-1 relative overflow-hidden bg-transparent">
        <div className="absolute inset-0 flex flex-col items-center justify-center p-12 lg:p-16 text-white">
          <div className="max-w-xl space-y-10 text-center">
            {/* Logo */}
            <div className="flex items-center justify-center mb-2">
              <div className="w-16 h-16 lg:w-20 lg:h-20 bg-white/95 rounded-2xl shadow-2xl flex items-center justify-center p-3">
                <img
                  src="/lovable-uploads/8b68f9f7-c5f4-42f8-9ac8-0bffc3fdb96d.png"
                  alt="SanarFlix Academy"
                  className="w-full h-full object-contain"
                />
              </div>
            </div>

            {/* Title */}
            <h2 className="text-3xl lg:text-4xl font-bold leading-tight text-neutral-900 dark:text-white">
              SanarFlix Academy
            </h2>

            {/* Description */}
            <p className="text-base lg:text-lg text-neutral-700 dark:text-white/95 leading-relaxed font-light">
              Plataforma exclusiva para <strong className="font-semibold">Universidades Parceiras da Sanar</strong>.
              Guias de estudos personalizados, simulados com análise detalhada e métricas de engajamento.
            </p>

            {/* Feature Cards */}
            <div className="grid grid-cols-1 gap-3 mt-8">
              <div className="flex items-center gap-4 p-4 bg-white/10 backdrop-blur-sm rounded-xl border border-white/20 text-left hover:bg-white/15 transition-colors">
                <div className="flex-shrink-0 w-11 h-11 bg-white/20 rounded-lg flex items-center justify-center">
                  <svg className="w-5 h-5 text-primary dark:text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                  </svg>
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold text-base mb-0.5 text-neutral-800 dark:text-white">Dashboard de acompanhamento</h3>
                  <p className="text-sm text-neutral-600 dark:text-white/80 leading-snug">Monitore o progresso em tempo real</p>
                </div>
              </div>

              <div className="flex items-center gap-4 p-4 bg-white/10 backdrop-blur-sm rounded-xl border border-white/20 text-left hover:bg-white/15 transition-colors">
                <div className="flex-shrink-0 w-11 h-11 bg-white/20 rounded-lg flex items-center justify-center">
                  <svg className="w-5 h-5 text-primary dark:text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold text-base mb-0.5 text-neutral-800 dark:text-white">Conteúdo personalizado</h3>
                  <p className="text-sm text-neutral-600 dark:text-white/80 leading-snug">Alinhado à grade curricular</p>
                </div>
              </div>

              <div className="flex items-center gap-4 p-4 bg-white/10 backdrop-blur-sm rounded-xl border border-white/20 text-left hover:bg-white/15 transition-colors">
                <div className="flex-shrink-0 w-11 h-11 bg-white/20 rounded-lg flex items-center justify-center">
                  <svg className="w-5 h-5 text-primary dark:text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 8v8m-4-5v5m-4-2v2m-2 4h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold text-base mb-0.5 text-neutral-800 dark:text-white">Análise detalhada</h3>
                  <p className="text-sm text-neutral-600 dark:text-white/80 leading-snug">Insights para tomada de decisão</p>
                </div>
              </div>
            </div>
          </div>
        </div>


      </div>
    </div>
  );
};
