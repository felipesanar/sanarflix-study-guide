import { useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Loader2 } from 'lucide-react';
import { Logger } from '@/utils/logger';

export default function AuthCallback() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  useEffect(() => {
    const handleAuthCallback = async () => {
      try {
        const type = searchParams.get('type');
        const token = searchParams.get('token');
        const accessToken = searchParams.get('access_token');
        const refreshToken = searchParams.get('refresh_token');

        // Handle different auth callback types
        if (type === 'recovery') {
          // Password recovery flow
          if (token) {
            const { error } = await supabase.auth.verifyOtp({
              token_hash: token,
              type: 'recovery'
            });

            if (error) {
              throw error;
            }

            toast.success('Link de redefinição válido! Digite sua nova senha.');
            navigate('/reset-password');
          } else {
            throw new Error('Token de recuperação não encontrado');
          }
        } else if (accessToken && refreshToken) {
          // Direct session setup (magic link login)
          const { error } = await supabase.auth.setSession({
            access_token: accessToken,
            refresh_token: refreshToken,
          });

          if (error) {
            throw error;
          }

          toast.success('Login realizado com sucesso!');
          navigate('/');
        } else {
          // Try to get session if tokens are in URL
          const { data, error } = await supabase.auth.getSession();
          
          if (error) {
            throw error;
          }

          if (data.session) {
            toast.success('Login realizado com sucesso!');
            navigate('/');
          } else {
            throw new Error('Sessão não encontrada');
          }
        }
      } catch (error: any) {
        Logger.error('Auth callback error:', error);
        toast.error(error.message || 'Erro na autenticação');
        navigate('/login');
      }
    };

    handleAuthCallback();
  }, [navigate, searchParams]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary/10 to-secondary/10">
      <div className="text-center">
        <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4 text-primary" />
        <p className="text-muted-foreground">Processando autenticação...</p>
      </div>
    </div>
  );
}