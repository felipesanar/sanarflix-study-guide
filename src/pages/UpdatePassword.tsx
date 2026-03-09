import * as React from 'react';
import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Eye, EyeOff, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

export default function UpdatePassword() {
    const [searchParams] = useSearchParams();
    const navigate = useNavigate();

    const [password, setPassword] = useState('');
    const [confirm, setConfirm] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [showConfirm, setShowConfirm] = useState(false);

    const [isVerifying, setIsVerifying] = useState(true);
    const [canUpdate, setCanUpdate] = useState(false);
    const [error, setError] = useState<string>('');

    useEffect(() => {
        const verifyTokens = async () => {
            setIsVerifying(true);
            setError('');

            try {
                const hash = window.location.hash?.startsWith('#') ? window.location.hash.slice(1) : window.location.hash;
                const hashParams = new URLSearchParams(hash || '');
                const getParam = (key: string) => searchParams.get(key) || hashParams.get(key);

                // Priority 1: Query params token_hash + type (new frontend-direct format)
                // These links go directly to the SPA, so bots can't consume the token
                const tokenHash = searchParams.get('token_hash');
                const tokenType = searchParams.get('type');

                // Priority 2-3: Hash params (legacy Supabase redirect format)
                const accessToken = getParam('access_token');
                const refreshToken = getParam('refresh_token');
                const token = getParam('token');
                const type = getParam('type');

                const errorGeneral = getParam('error');
                const errorCode = getParam('error_code');
                const errorDesc = getParam('error_description');

                if (tokenHash && tokenType) {
                    // New format: frontend-direct link with token_hash in query params
                    console.log('[UpdatePassword] Verifying via query params token_hash');
                    const { error } = await supabase.auth.verifyOtp({
                        token_hash: tokenHash,
                        type: tokenType as any,
                    });
                    if (error) throw error;
                    setCanUpdate(true);
                } else if (accessToken && refreshToken) {
                    // Legacy format: Supabase redirect with access_token in hash
                    const { error } = await supabase.auth.setSession({
                        access_token: accessToken,
                        refresh_token: refreshToken,
                    });
                    if (error) throw error;
                    setCanUpdate(true);
                } else if (token && type) {
                    // Legacy format: token in hash params
                    const { error } = await supabase.auth.verifyOtp({
                        token_hash: token,
                        type: type as any,
                    });
                    if (error) throw error;
                    setCanUpdate(true);
                } else if (errorGeneral || errorCode || errorDesc) {
                    // Error params from Supabase redirect
                    const msg = errorDesc || errorCode || errorGeneral;
                    throw new Error(msg || 'Link inválido ou expirado');
                } else {
                    throw new Error('Link inválido ou expirado');
                }
            } catch (e: any) {
                setError(e?.message || 'Não foi possível validar o link.');
            } finally {
                setIsVerifying(false);
            }
        };

        verifyTokens();
    }, [searchParams]);

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
        if (complexityError) {
            setError(complexityError);
            return;
        }

        if (password !== confirm) {
            setError('As senhas não coincidem.');
            return;
        }

        try {
            const { data: { session } } = await supabase.auth.getSession();
            if (!session?.access_token) throw new Error('Sessão expirada. Solicite um novo link.');

            const res = await supabase.functions.invoke('update-password', {
                body: { newPassword: password },
            });
            if (res.error || !res.data?.success) {
                throw new Error(res.data?.error || 'Erro ao definir senha.');
            }

            // Clear must_change_password flag (metadata-only update, no reauth needed)
            await supabase.auth.updateUser({ data: { must_change_password: false } });

            toast.success('Senha definida com sucesso! Faça login para continuar.');
            navigate('/login');
        } catch (e: any) {
            setError(e?.message || 'Erro ao definir senha. Tente novamente.');
        }
    };

    if (isVerifying) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary/10 to-secondary/10">
                <div className="text-center">
                    <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4 text-primary" />
                    <p className="text-muted-foreground">Validando seu acesso...</p>
                </div>
            </div>
        );
    }

    if (!canUpdate) {
        return (
            <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-br from-primary/10 to-secondary/10">
                <Card className="w-full max-w-md">
                    <CardHeader className="text-center">
                        <CardTitle className="text-2xl font-bold">Link inválido</CardTitle>
                        <CardDescription>Solicite um novo link de acesso ao administrador ou tente “Esqueci a senha” no login.</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        {error && <p className="text-sm text-red-600">{error}</p>}
                        <div className="text-center">
                            <Button variant="link" onClick={() => navigate('/login')}>Ir para o login</Button>
                        </div>
                    </CardContent>
                </Card>
            </div>
        );
    }

    return (
        <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary/10 to-secondary/10 p-4">
            <Card className="w-full max-w-md">
                <CardHeader className="text-center">
                    <CardTitle className="text-2xl font-bold">Primeiro Acesso</CardTitle>
                    <CardDescription>Defina sua senha para entrar na plataforma</CardDescription>
                </CardHeader>
                <CardContent>
                    <form onSubmit={handleSubmit} className="space-y-4">
                        {error && <p className="text-sm text-red-600">{error}</p>}
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