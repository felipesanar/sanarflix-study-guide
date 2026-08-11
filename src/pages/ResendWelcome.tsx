import { useEffect, useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Loader2, CheckCircle2, AlertCircle } from 'lucide-react';

type Status = 'loading' | 'success' | 'error';

const ResendWelcome = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [status, setStatus] = useState<Status>('loading');
  const email = searchParams.get('email') || '';
  const type = searchParams.get('type') || 'welcome'; // 'welcome' | 'reset'

  useEffect(() => {
    if (!email) {
      setStatus('error');
      return;
    }

    const resend = async () => {
      try {
        const functionName = type === 'reset' ? 'request-password-reset' : 'resend-welcome-link';
        const { error } = await supabase.functions.invoke(functionName, {
          body: { email },
        });
        setStatus(error ? 'error' : 'success');
      } catch {
        setStatus('error');
      }
    };

    resend();
  }, [email, type]);

  useEffect(() => {
    if (status === 'success') {
      const timer = setTimeout(() => navigate('/login', { replace: true }), 5000);
      return () => clearTimeout(timer);
    }
  }, [status, navigate]);

  const isReset = type === 'reset';
  const successTitle = isReset ? 'Novo link de redefinição enviado!' : 'Novo link enviado!';
  const successDesc = isReset
    ? `Um novo link de redefinição de senha foi enviado para`
    : `Um novo link de acesso foi enviado para`;
  const loadingMsg = isReset ? 'Gerando novo link de redefinição...' : 'Gerando novo link de acesso...';

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <div className="max-w-md w-full text-center space-y-4">
        <img
          src="/sanarflix-academy-symbol.svg"
          alt="SanarFlix Academy"
          className="w-20 h-20 mx-auto rounded-2xl"
        />

        {status === 'loading' && (
          <>
            <Loader2 className="w-8 h-8 mx-auto animate-spin text-primary" />
            <p className="text-muted-foreground">{loadingMsg}</p>
          </>
        )}

        {status === 'success' && (
          <>
            <CheckCircle2 className="w-10 h-10 mx-auto text-green-600" />
            <h1 className="text-xl font-semibold text-foreground">{successTitle}</h1>
            <p className="text-muted-foreground text-sm">
              {successDesc} <strong>{email}</strong>.
              Verifique sua caixa de entrada e spam.
            </p>
            <p className="text-xs text-muted-foreground">Redirecionando para o login em 5 segundos...</p>
          </>
        )}

        {status === 'error' && (
          <>
            <AlertCircle className="w-10 h-10 mx-auto text-destructive" />
            <h1 className="text-xl font-semibold text-foreground">Algo deu errado</h1>
            <p className="text-muted-foreground text-sm">
              {email
                ? 'Não foi possível enviar o link. Tente novamente mais tarde ou entre em contato com o suporte.'
                : 'Email não informado. Verifique o link que você recebeu.'}
            </p>
            <button
              onClick={() => navigate('/login', { replace: true })}
              className="text-sm text-primary underline hover:no-underline"
            >
              Ir para o login
            </button>
          </>
        )}
      </div>
    </div>
  );
};

export default ResendWelcome;
