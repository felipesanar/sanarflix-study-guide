import React from 'react';
import { render, RenderOptions } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter } from 'react-router-dom';
import { ThemeProvider } from 'next-themes';
import { TooltipProvider } from '@/components/ui/tooltip';

// Mock do contexto de autenticação
const MockAuthProvider = ({ children }: { children: React.ReactNode }) => {
  return <>{children}</>;
};

// Wrapper personalizado para testes
const AllTheProviders = ({ children }: { children: React.ReactNode }) => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
    },
  });

  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <ThemeProvider attribute="class" defaultTheme="light" enableSystem={false}>
          <TooltipProvider>
            <MockAuthProvider>
              {children}
            </MockAuthProvider>
          </TooltipProvider>
        </ThemeProvider>
      </BrowserRouter>
    </QueryClientProvider>
  );
};

// Função de render customizada
const customRender = (
  ui: React.ReactElement,
  options?: Omit<RenderOptions, 'wrapper'>
) => render(ui, { wrapper: AllTheProviders, ...options });

// Re-export tudo
export * from '@testing-library/react';
export { customRender as render };

// Utilitários de teste
export const createMockUser = (overrides = {}) => ({
  id: 'test-user-id',
  email: 'test@example.com',
  nome: 'Test User',
  id_ies: 'test-ies-id',
  ies_nome: 'Test IES',
  semestre: 5,
  ...overrides,
});

export const createMockStudyContent = (overrides = {}) => ({
  id: 'test-content-id',
  name: 'Test Content',
  discipline: 'Test Discipline',
  week: 1,
  sanarflixUrl: 'https://test.sanar.com',
  completed: false,
  type: 'video' as const,
  ...overrides,
});

export const waitForLoadingToFinish = () => {
  return new Promise(resolve => setTimeout(resolve, 0));
};