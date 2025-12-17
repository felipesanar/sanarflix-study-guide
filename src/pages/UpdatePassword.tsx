import * as React from 'react';
import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Eye, EyeOff, Loader2, CheckCircle2 } from 'lucide-react';
import { toast } from '@/hooks/use-toast';

export function UpdatePassword() {
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const [password, setPassword] = useState('');
    const [confirm, setConfirm] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [showConfirm, setShowConfirm] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [isVerifying, setIsVerifying] = useState(true);
    const [formError, setFormError] = useState<string | null>(null);
    const [sessionValid, setSessionValid] = useState(false);

    const validatePassword = (pwd: string) => {
        if (pwd.length < 8) return 'Senha deve ter pelo menos 8 caracteres';
        if (!/[A-Z]/.test(pwd)) return 'Senha deve conter pelo menos uma letra maiúscula';
        if (!/[a-z]/.test(pwd)) return 'Senha deve conter pelo menos uma letra minúscula';
        if (!/[0-9]/.test(pwd)) return 'Senha deve conter pelo menos um número';
        return null;
    };

    useEffect(() => {
        const verifySession = async () => {
            setIsVerifying(true);
            
            try {
                // Primeiro, tenta pegar a sessão existente (pode ter sido setada pelo callback do Supabase)
                const { data: { session }, error: sessionError } = await supabase.auth.getSession();
                
                if (session) {
                    console.log('Session found, user can set password');
                    setSessionValid(true);
                    setIsVerifying(false);
                    return;
                }

                // Se não tem sessão, verifica se há tokens na URL (hash fragments)
                const hashParams = new URLSearchParams(window.location.hash.substring(1));
                const accessToken = hashParams.get('access_token');
                const refreshToken = hashParams.get('refresh_token');
                const type = hashParams.get('type');

                // Também verifica query params (alguns fluxos usam isso)
                const tokenHash = searchParams.get('token_hash') || searchParams.get('token');
                const tokenType = searchParams.get('type') || type;

                console.log('Checking auth tokens:', { 
                    hasAccessToken: !!accessToken, 
                    hasTokenHash: !!tokenHash, 
                    type: tokenType 
                });

                if (accessToken && refreshToken) {
                    // Tenta setar a sessão com os tokens do hash
                    const { error } = await supabase.auth.setSession({
                        access_token: accessToken,
                        refresh_token: refreshToken,
                    });

                    if (!error) {
                        console.log('Session set from hash tokens');
                        setSessionValid(true);
                        setIsVerifying(false);
                        // Limpa o hash da URL
                        window.history.replaceState(null, '', window.location.pathname);
                        return;
                    }
                    console.error('Error setting session from tokens:', error);
                }

                if (tokenHash && tokenType) {
                    // Verifica o token (invite, recovery, etc)
                    const { error } = await supabase.auth.verifyOtp({
                        token_hash: tokenHash,
                        type: tokenType as any,
                    });

                    if (!error) {
                        console.log('OTP verified successfully');
                        setSessionValid(true);
                        setIsVerifying(false);
                        return;
                    }
                    console.error('Error verifying OTP:', error);
                }

                // Nenhum método de autenticação funcionou
                console.log('No valid authentication found');
                toast({
                    title: "Link inválido ou expirado",
                    description: "Por favor, solicite um novo convite ou recuperação de senha.",
                    variant: "destructive"
                });
                navigate('/login');
                
            } catch (err) {
                console.error('Error during session verification:', err);
                toast({
                    title: "Erro ao verificar sessão",
                    description: "Por favor, tente novamente ou solicite um novo link.",
                    variant: "destructive"
                });
                navigate('/login');
            } finally {
                setIsVerifying(false);
            }
        };

        verifySession();
    }, [navigate, searchParams]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setFormError(null);

        const clientValidation = validatePassword(password);
        if (clientValidation) {
            setFormError(clientValidation);
            return;
        }
        if (password !== confirm) {
            setFormError('As senhas não conferem');
            return;
        }

        setIsLoading(true);
        try {
            const { error } = await supabase.auth.updateUser({
                password: password
            });

            if (error) throw error;

            toast({
                title: 'Senha definida com sucesso!',
                description: 'Sua conta está pronta para uso. Redirecionando...',
                duration: 3000,
            });

            // Aguarda um pouco para o usuário ver a mensagem
            setTimeout(() => {
                navigate('/', { replace: true });
            }, 1500);

        } catch (err: any) {
            console.error('Error updating password:', err);
            toast({
                title: 'Erro ao definir senha',
                description: err.message || 'Tente novamente ou solicite um novo link.',
                variant: 'destructive',
            });
        } finally {
            setIsLoading(false);
        }
    };

    // Tela de loading enquanto verifica a sessão
    if (isVerifying) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary/10 to-secondary/10 p-4">
                <Card className="w-full max-w-md">
                    <CardContent className="pt-6">
                        <div className="flex flex-col items-center gap-4">
                            <Loader2 className="h-8 w-8 animate-spin text-primary" />
                            <p className="text-muted-foreground">Verificando seu link...</p>
                        </div>
                    </CardContent>
                </Card>
            </div>
        );
    }

    // Se a sessão não for válida, não renderiza o form (já redirecionou)
    if (!sessionValid) {
        return null;
    }

    return (
        <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary/10 to-secondary/10 p-4">
            <Card className="w-full max-w-md">
                <CardHeader className="text-center">
                    <div className="mx-auto mb-4 w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
                        <CheckCircle2 className="h-8 w-8 text-primary" />
                    </div>
                    <CardTitle className="text-2xl font-bold">Definir Nova Senha</CardTitle>
                    <CardDescription>
                        Você foi convidado para o SanarFlix Academy. Defina sua senha para começar a usar a plataforma.
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <form onSubmit={handleSubmit} className="space-y-4">
                        <div className="space-y-2">
                            <Label htmlFor="password">Nova Senha</Label>
                            <div className="relative">
                                <Input
                                    id="password"
                                    type={showPassword ? 'text' : 'password'}
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    placeholder="Mínimo 8 caracteres"
                                    required
                                    autoFocus
                                />
                                <Button
                                    type="button"
                                    variant="ghost"
                                    size="sm"
                                    className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                                    onClick={() => setShowPassword(!showPassword)}
                                >
                                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                                </Button>
                            </div>
                            <p className="text-xs text-muted-foreground">
                                Deve conter maiúscula, minúscula e número
                            </p>
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="confirm">Confirmar Senha</Label>
                            <div className="relative">
                                <Input
                                    id="confirm"
                                    type={showConfirm ? 'text' : 'password'}
                                    value={confirm}
                                    onChange={(e) => setConfirm(e.target.value)}
                                    placeholder="Repita a senha"
                                    required
                                />
                                <Button
                                    type="button"
                                    variant="ghost"
                                    size="sm"
                                    className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                                    onClick={() => setShowConfirm(!showConfirm)}
                                >
                                    {showConfirm ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                                </Button>
                            </div>
                        </div>

                        {formError && (
                            <div className="text-sm text-destructive bg-destructive/10 p-3 rounded-md">
                                {formError}
                            </div>
                        )}

                        <Button type="submit" className="w-full" disabled={isLoading}>
                            {isLoading ? (
                                <>
                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                    Salvando...
                                </>
                            ) : (
                                'Definir Senha e Acessar'
                            )}
                        </Button>

                        <div className="text-center">
                            <Button type="button" variant="link" onClick={() => navigate('/login')} className="text-sm">
                                Voltar ao login
                            </Button>
                        </div>
                    </form>
                </CardContent>
            </Card>
        </div>
    );
}

export default UpdatePassword;