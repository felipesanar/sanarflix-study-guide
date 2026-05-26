import * as React from 'react';
import { useState, useMemo } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Eye, EyeOff, Loader2, ShieldCheck } from 'lucide-react';
import { toast } from 'sonner';
import { Logger } from '@/utils/logger';

type PageState = 'ready_to_verify' | 'verifying' | 'verified' | 'error' | 'invalid_params';

export default function UpdatePassword() {
    const [searchParams] = useSearchParams();
    const navigate = useNavigate();

    const [pageState, setPageState] = useState<PageState>('ready_to_verify');
    const [password, setPassword] = useState('');
    const [confirm, setConfirm] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [showConfirm, setShowConfirm] = useState(false);
    const [error, setError] = useState('');

    // Extract params once — never auto-verify
    const params = useMemo(() => {
        const hash = window.location.hash?.startsWith('#') ? window.location.hash.slice(1) : window.location.hash;
        const hashParams = new URLSearchParams(hash || '');
        const get = (key: string) => searchParams.get(key) || hashParams.get(key);

        const tokenHash = get('token_hash');
        const type = get('type');
        const accessToken = get('access_token');
        const refreshToken = get('refresh_token');
        const token = get('token');
        const errorParam = get('error');
        const errorCode = get('error_code');
        const errorDesc = get('error_description');

        return { tokenHash, type, accessToken, refreshToken, token, errorParam, errorCode, errorDesc };
    }, [searchParams]);

    // Check if we have any valid params at all
    const hasValidParams = !!(params.tokenHash && params.type) ||
        !!(params.accessToken && params.refreshToken) ||
        !!(params.token && params.type);

    const hasErrorParams = !!(params.errorParam || params.errorCode || params.errorDesc);

    // Check if Supabase's detectSessionInUrl already consumed the token
    // and created a valid session (common with token_hash in query params).
    React.useEffect(() => {
        if (pageState !== 'ready_to_verify') return;
        
        const checkExistingSession = async () => {
            // Small delay to let Supabase's auto-detection finish
            await new Promise(r => setTimeout(r, 500));
            
            const { data: { session } } = await supabase.auth.getSession();
            if (session) {
                Logger.info('[UpdatePassword] Session already exists (auto-detected). Skipping manual verify.');
                setPageState('verified');
            }
        };
        
        if (hasValidParams && !hasErrorParams) {
            checkExistingSession();
        }
    }, [pageState, hasValidParams, hasErrorParams]);

    const handleVerify = async () => {
        setPageState('verifying');
        setError('');

        try {
            // First check if session was already created by detectSessionInUrl
            const { data: { session: existingSession } } = await supabase.auth.getSession();
            if (existingSession) {
                Logger.info('[UpdatePassword] Session already exists. Skipping verifyOtp.');
                setPageState('verified');
                return;
            }

            if (params.tokenHash && params.type) {
                const { error } = await supabase.auth.verifyOtp({
                    token_hash: params.tokenHash,
                    type: params.type as any,
                });
                if (error) throw error;
            } else if (params.accessToken && params.refreshToken) {
                const { error } = await supabase.auth.setSession({
                    access_token: params.accessToken,
                    refresh_token: params.refreshToken,
                });
                if (error) throw error;
            } else if (params.token && params.type) {
                const { error } = await supabase.auth.verifyOtp({
                    token_hash: params.token,
                    type: params.type as any,
                });
                if (error) throw error;
            } else {
                throw new Error('Link inválido ou expirado');
            }
            setPageState('verified');
        } catch (e: any) {
            setError(e?.message || 'Não foi possível validar o link.');
            setPageState('error');
        }
    };

    const validatePassword = (pwd: string) => {
        if (pwd.length < 8) return 'A senha deve ter pelo menos 8 caracteres.';
        if (!/[A-Z]/.test(pwd)) return 'A senha deve conter pelo menos uma letra maiúscula.';
        if (!/[a-z]/.test(pwd)) return 'A senha deve conter pelo menos uma letra minúscula.';
        if (!/\d/.test(pwd)) return 'A senha deve conter pelo menos um número.';
        if (!/[@$!%*?&]/.test(pwd)) return 'A senha deve conter pelo menos um caractere especial (@$!%*?&).';
        return '';
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');

        const complexityError = validatePassword(password);
        if (complexityError) { setError(complexityError); return; }
        if (password !== confirm) { setError('As senhas não coincidem.'); return; }

        try {
            const { data: { session } } = await supabase.auth.getSession();
            if (!session?.access_token) throw new Error('Sessão expirada. Solicite um novo link.');

            const res = await supabase.functions.invoke('update-password', {
                body: { newPassword: password },
            });
            if (res.error || !res.data?.success) {
                throw new Error(res.data?.error || 'Erro ao definir senha.');
            }

            await supabase.auth.updateUser({ data: { must_change_password: false } });

            toast.success('Senha definida com sucesso! Faça login para continuar.');
            navigate('/login');
        } catch (e: any) {
            setError(e?.message || 'Erro ao definir senha. Tente novamente.');
        }
    };

    // --- Invalid params or error from Supabase redirect ---
    if (!hasValidParams || hasErrorParams) {
        const msg = params.errorDesc || params.errorCode || params.errorParam || '';
        return (
            <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-br from-primary/10 to-secondary/10">
                <Card className="w-full max-w-md">
                    <CardHeader className="text-center">
                        <CardTitle className="text-2xl font-bold">Link inválido</CardTitle>
                        <CardDescription>Solicite um novo link de acesso ao administrador ou tente "Esqueci a senha" no login.</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        {msg && <p className="text-sm text-destructive">{msg}</p>}
                        <div className="text-center">
                            <Button variant="link" onClick={() => navigate('/login')}>Ir para o login</Button>
                        </div>
                    </CardContent>
                </Card>
            </div>
        );
    }

    // --- Verifying spinner ---
    if (pageState === 'verifying') {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary/10 to-secondary/10">
                <div className="text-center">
                    <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4 text-primary" />
                    <p className="text-muted-foreground">Validando seu acesso...</p>
                </div>
            </div>
        );
    }

    // --- Ready to verify (button) ---
    if (pageState === 'ready_to_verify') {
        return (
            <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-br from-primary/10 to-secondary/10">
                <Card className="w-full max-w-md">
                    <CardHeader className="text-center">
                        <ShieldCheck className="h-12 w-12 mx-auto mb-2 text-primary" />
                        <CardTitle className="text-2xl font-bold">Bem-vindo ao SanarFlix Academy</CardTitle>
                        <CardDescription>Clique no botão abaixo para validar seu acesso e definir sua senha.</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <Button onClick={handleVerify} className="w-full" size="lg">
                            Validar meu acesso
                        </Button>
                        <div className="text-center">
                            <Button variant="link" onClick={() => navigate('/login')} className="text-sm">
                                Voltar ao login
                            </Button>
                        </div>
                    </CardContent>
                </Card>
            </div>
        );
    }

    // --- Error state ---
    if (pageState === 'error') {
        return (
            <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-br from-primary/10 to-secondary/10">
                <Card className="w-full max-w-md">
                    <CardHeader className="text-center">
                        <CardTitle className="text-2xl font-bold">Link inválido</CardTitle>
                        <CardDescription>O link pode ter expirado ou já foi utilizado. Solicite um novo link.</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        {error && <p className="text-sm text-destructive">{error}</p>}
                        <div className="text-center">
                            <Button variant="link" onClick={() => navigate('/login')}>Ir para o login</Button>
                        </div>
                    </CardContent>
                </Card>
            </div>
        );
    }

    // --- Verified: password form ---
    return (
        <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary/10 to-secondary/10 p-4">
            <Card className="w-full max-w-md">
                <CardHeader className="text-center">
                    <CardTitle className="text-2xl font-bold">Primeiro Acesso</CardTitle>
                    <CardDescription>Defina sua senha para entrar na plataforma</CardDescription>
                </CardHeader>
                <CardContent>
                    <form onSubmit={handleSubmit} className="space-y-4">
                        {error && <p className="text-sm text-destructive">{error}</p>}
                        <div className="space-y-2">
                            <Label htmlFor="password">Nova Senha</Label>
                            <div className="relative">
                                <Input
                                    id="password"
                                    type={showPassword ? 'text' : 'password'}
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    placeholder="Mínimo 8 caracteres, com complexidade"
                                    required
                                    minLength={8}
                                />
                                <Button type="button" variant="ghost" size="sm"
                                    className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                                    onClick={() => setShowPassword(!showPassword)}>
                                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                                </Button>
                            </div>
                            <p className="text-xs text-muted-foreground">
                                Use pelo menos: 1 maiúscula, 1 minúscula, 1 número e 1 símbolo (@$!%*?&).
                            </p>
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="confirm">Confirmar Nova Senha</Label>
                            <div className="relative">
                                <Input
                                    id="confirm"
                                    type={showConfirm ? 'text' : 'password'}
                                    value={confirm}
                                    onChange={(e) => setConfirm(e.target.value)}
                                    placeholder="Repita a nova senha"
                                    required
                                    minLength={8}
                                />
                                <Button type="button" variant="ghost" size="sm"
                                    className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                                    onClick={() => setShowConfirm(!showConfirm)}>
                                    {showConfirm ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                                </Button>
                            </div>
                        </div>
                        <Button type="submit" className="w-full">Definir Senha</Button>
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
