import * as React from 'react';
import { useEffect } from 'react';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Eye, EyeOff, Loader2 } from 'lucide-react';
import { toast } from '@/hooks/use-toast';

export function UpdatePassword() {
    const navigate = useNavigate();
    const [password, setPassword] = useState('');
    const [confirm, setConfirm] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [showConfirm, setShowConfirm] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [formError, setFormError] = useState<string | null>(null);

    const validatePassword = (pwd: string) => {
        if (pwd.length < 8) return 'Senha deve ter pelo menos 8 caracteres';
        if (!/[A-Z]/.test(pwd)) return 'Senha deve conter pelo menos uma letra maiúscula';
        if (!/[a-z]/.test(pwd)) return 'Senha deve conter pelo menos uma letra minúscula';
        if (!/[0-9]/.test(pwd)) return 'Senha deve conter pelo menos um número';
        return null;
    };

    useEffect(() => {
        // Verifica se existe uma sessão ativa (vinda do link do email)
        supabase.auth.getSession().then(({ data: { session } }) => {
            if (!session) {
                toast({
                    title: "Link inválido ou expirado",
                    description: "Por favor, solicite um novo convite ou recuperação de senha.",
                    variant: "destructive"
                });
                navigate('/login'); // Manda de volta pro login se não tiver sessão
            }
        });
    }, [navigate]);

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
            // CORREÇÃO AQUI: Usamos o método nativo do cliente, pois o usuário
            // já está logado pela sessão do link do email.
            const { error } = await supabase.auth.updateUser({
                password: password
            });

            if (error) throw error;

            toast({
                title: 'Senha definida com sucesso!',
                description: 'Sua conta está pronta para uso.',
                duration: 3000,
            });

            // Redireciona para o Dashboard ou Home
            navigate('/', { replace: true });

        } catch (err: any) {
            toast({
                title: 'Erro ao atualizar',
                description: err.message || 'Tente novamente.',
                variant: 'destructive',
            });
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary/10 to-secondary/10 p-4">
            <Card className="w-full max-w-md">
                <CardHeader className="text-center">
                    <CardTitle className="text-2xl font-bold">Definir Nova Senha</CardTitle>
                    <CardDescription>
                        Você foi convidado. Defina sua senha para concluir o acesso.
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
                                    placeholder="Mínimo 8 caracteres, com maiúscula, minúscula e número"
                                    required
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
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="confirm">Confirmar Nova Senha</Label>
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

                        {formError && <div className="text-sm text-destructive">{formError}</div>}

                        <Button type="submit" className="w-full" disabled={isLoading}>
                            {isLoading ? (
                                <>
                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                    Salvando...
                                </>
                            ) : (
                                'Definir Senha'
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