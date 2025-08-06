import React, { createContext, useContext, useState, useEffect } from 'react';
import { User as SupabaseUser, Session } from '@supabase/supabase-js';
import { AuthContextType, User, Profile, SignUpData } from '@/types';
import { toast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';

const AuthContext = createContext<AuthContextType | null>(null);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Set up auth state listener
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        setSession(session);
        
        if (session?.user) {
          setUser({
            id: session.user.id,
            email: session.user.email || '',
            name: '',
            faculty: '',
            semester: 0
          });
          
          // Fetch user profile
          setTimeout(async () => {
            try {
              const { data: profileData, error } = await supabase
                .from('profiles')
                .select(`
                  *,
                  ies:id_ies(nome)
                `)
                .eq('user_id', session.user.id)
                .single();

              if (error) {
                console.error('Error fetching profile:', error);
                return;
              }

              if (profileData) {
                setProfile(profileData);
                setUser({
                  id: session.user.id,
                  email: profileData.email,
                  name: profileData.nome,
                  faculty: profileData.ies?.nome || '',
                  semester: profileData.semestre || 0,
                  cpf: profileData.cpf
                });
              }
            } catch (error) {
              console.error('Error in profile fetch:', error);
            }
          }, 0);
        } else {
          setUser(null);
          setProfile(null);
        }
        
        setIsLoading(false);
      }
    );

    // Check for existing session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      if (!session) {
        setIsLoading(false);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const login = async (email: string, password: string): Promise<{ success: boolean; error?: string }> => {
    setIsLoading(true);
    
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        toast({
          title: "Erro no login",
          description: error.message === "Invalid login credentials" ? 
            "Email ou senha inválidos" : error.message,
          variant: "destructive",
          duration: 3000,
        });
        setIsLoading(false);
        return { success: false, error: error.message };
      }

      if (data.user) {
        toast({
          title: "Login realizado com sucesso!",
          description: `Bem-vindo(a) de volta`,
          duration: 3000,
        });
        setIsLoading(false);
        return { success: true };
      }
    } catch (error) {
      console.error('Login error:', error);
      toast({
        title: "Erro no login",
        description: "Ocorreu um erro inesperado",
        variant: "destructive",
        duration: 3000,
      });
    }
    
    setIsLoading(false);
    return { success: false, error: "Erro inesperado" };
  };

  const signUp = async (email: string, password: string, userData: SignUpData): Promise<{ success: boolean; error?: string }> => {
    setIsLoading(true);
    
    try {
      const redirectUrl = `${window.location.origin}/`;
      
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: redirectUrl,
          data: userData
        }
      });

      if (error) {
        toast({
          title: "Erro no cadastro",
          description: error.message === "User already registered" ? 
            "Este email já está cadastrado" : error.message,
          variant: "destructive",
          duration: 3000,
        });
        setIsLoading(false);
        return { success: false, error: error.message };
      }

      if (data.user) {
        toast({
          title: "Cadastro realizado com sucesso!",
          description: "Verifique seu email para confirmar a conta",
          duration: 5000,
        });
        setIsLoading(false);
        return { success: true };
      }
    } catch (error) {
      console.error('SignUp error:', error);
      toast({
        title: "Erro no cadastro",
        description: "Ocorreu um erro inesperado",
        variant: "destructive",
        duration: 3000,
      });
    }
    
    setIsLoading(false);
    return { success: false, error: "Erro inesperado" };
  };

  const logout = async () => {
    const { error } = await supabase.auth.signOut();
    
    if (error) {
      toast({
        title: "Erro no logout",
        description: error.message,
        variant: "destructive",
        duration: 3000,
      });
      return;
    }

    setUser(null);
    setProfile(null);
    setSession(null);
    
    toast({
      title: "Logout realizado",
      description: "Até logo!",
      duration: 2000,
    });
  };

  return (
    <AuthContext.Provider value={{ user, profile, login, signUp, logout, isLoading }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
};