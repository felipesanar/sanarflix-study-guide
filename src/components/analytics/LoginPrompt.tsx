import React from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { BarChart3, Lock } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export const LoginPrompt: React.FC = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-gradient-to-br from-blue-50 via-transparent to-primary/5 -z-10" />
      
      <Card className="w-full max-w-md mx-auto text-center border-2 shadow-lg">
        <CardContent className="pt-8 pb-6">
          <div className="flex justify-center mb-4">
            <div className="relative">
              <BarChart3 className="w-16 h-16 text-blue-600" />
              <Lock className="w-6 h-6 text-muted-foreground absolute -bottom-1 -right-1 bg-background rounded-full p-1" />
            </div>
          </div>
          
          <h1 className="text-2xl font-bold text-foreground mb-2">
            Dashboard Analytics
          </h1>
          
          <p className="text-muted-foreground mb-6">
            Acesso restrito para usuários B2B.
            <br />
            Faça login com uma conta institucional para continuar.
          </p>
          
          <Button 
            onClick={() => navigate('/login')}
            className="w-full bg-blue-600 hover:bg-blue-700 gap-2"
            size="lg"
          >
            <Lock className="w-4 h-4" />
            Entrar
          </Button>
          
          <p className="text-xs text-muted-foreground mt-4">
            Dados protegidos conforme LGPD
          </p>
        </CardContent>
      </Card>
    </div>
  );
};