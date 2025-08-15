import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import { Loader2 } from 'lucide-react';

export const AuthCallback: React.FC = () => {
  const navigate = useNavigate();

  useEffect(() => {
    const handleAuthCallback = async () => {
      try {
        const { data, error } = await supabase.auth.getSession();
        
        if (error) {
          console.error('Auth callback error:', error);
          toast({
            title: "Erro de autenticação",
            description: error.message || "Não foi possível completar o login.",
            variant: "destructive",
            duration: 5000,
          });
          navigate('/login');
          return;
        }

        if (data.session) {
          toast({
            title: "Login realizado com sucesso!",
            description: "Bem-vindo de volta!",
            duration: 3000,
          });
          navigate('/');
        } else {
          navigate('/login');
        }
      } catch (error) {
        console.error('Unexpected auth callback error:', error);
        toast({
          title: "Erro inesperado",
          description: "Ocorreu um erro durante a autenticação.",
          variant: "destructive",
          duration: 5000,
        });
        navigate('/login');
      }
    };

    handleAuthCallback();
  }, [navigate]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="text-center">
        <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4 text-primary" />
        <p className="text-muted-foreground">Processando autenticação...</p>
      </div>
    </div>
  );
};