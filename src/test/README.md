# Testes Automatizados

Este diretório contém os testes automatizados do projeto usando Vitest e React Testing Library.

## Estrutura

```
src/test/
├── components/          # Testes de componentes
│   ├── admin/          # Testes dos componentes admin
│   │   ├── AnnouncementEditor.test.tsx
│   │   ├── AnnouncementsTab.test.tsx
│   │   ├── UserManagement.test.tsx
│   │   └── UsersTab.test.tsx
│   └── LoginForm.test.tsx
├── setup.ts            # Configuração global dos testes
├── utils.tsx           # Utilitários e helpers para testes
└── README.md           # Este arquivo
```

## Como executar os testes

### Executar todos os testes
```bash
npm run test
```

### Executar testes em modo watch
```bash
npm run test:watch
```

### Executar testes com coverage
```bash
npm run test:coverage
```

### Executar testes de um arquivo específico
```bash
npm run test src/test/components/admin/UsersTab.test.tsx
```

## Estrutura de um teste

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, fireEvent, waitFor } from '@testing-library/react';
import { render } from '../../utils';
import { MyComponent } from '@/components/MyComponent';

describe('MyComponent', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should render correctly', () => {
    render(<MyComponent />);
    expect(screen.getByText(/expected text/i)).toBeInTheDocument();
  });

  it('should handle user interaction', async () => {
    render(<MyComponent />);
    
    const button = screen.getByRole('button', { name: /click me/i });
    fireEvent.click(button);
    
    await waitFor(() => {
      expect(screen.getByText(/success/i)).toBeInTheDocument();
    });
  });
});
```

## Utilitários disponíveis

### render()
Renderiza um componente com todos os providers necessários (QueryClient, Router, Theme, etc.)

```typescript
import { render } from '../utils';
render(<MyComponent />);
```

### createMockUser()
Cria um objeto de usuário mockado para testes

```typescript
import { createMockUser } from '../utils';
const mockUser = createMockUser({ semestre: 5 });
```

### createMockStudyContent()
Cria um objeto de conteúdo de estudo mockado

```typescript
import { createMockStudyContent } from '../utils';
const mockContent = createMockStudyContent({ completed: true });
```

### waitForLoadingToFinish()
Aguarda operações assíncronas terminarem

```typescript
import { waitForLoadingToFinish } from '../utils';
await waitForLoadingToFinish();
```

## Mocks globais

Os seguintes mocks estão configurados globalmente em `setup.ts`:

- **Supabase**: Todas as operações do Supabase são mockadas
- **React Router**: `useNavigate`, `useLocation`, `useParams` são mockados
- **localStorage**: Operações de localStorage são mockadas
- **fetch**: API fetch global é mockada
- **ResizeObserver**: Necessário para testes de componentes UI
- **IntersectionObserver**: Necessário para testes de lazy loading

## Boas práticas

### 1. Use queries semânticas
```typescript
// ✅ Bom - usa role e nome acessível
screen.getByRole('button', { name: /salvar/i })

// ❌ Ruim - usa classe CSS
screen.getByClassName('save-button')
```

### 2. Aguarde mudanças assíncronas
```typescript
// ✅ Bom
await waitFor(() => {
  expect(screen.getByText(/sucesso/i)).toBeInTheDocument();
});

// ❌ Ruim - pode falhar se a operação for assíncrona
expect(screen.getByText(/sucesso/i)).toBeInTheDocument();
```

### 3. Limpe mocks entre testes
```typescript
beforeEach(() => {
  vi.clearAllMocks();
});
```

### 4. Use userEvent para interações mais realistas
```typescript
import { userEvent } from '../utils';

const user = userEvent.setup();
await user.click(button);
await user.type(input, 'texto');
```

### 5. Teste comportamento, não implementação
```typescript
// ✅ Bom - testa o que o usuário vê
expect(screen.getByText(/mensagem de sucesso/i)).toBeInTheDocument();

// ❌ Ruim - testa detalhes de implementação
expect(component.state.showSuccess).toBe(true);
```

## Cobertura de testes

O projeto visa manter uma cobertura de testes superior a 80%. Áreas críticas como:
- Componentes de administração
- Fluxos de autenticação
- Criação e edição de dados
- Validações de formulários

Devem ter cobertura superior a 90%.

## Debugging de testes

### Ver o HTML renderizado
```typescript
import { screen } from '@testing-library/react';
screen.debug(); // Imprime toda a árvore DOM
screen.debug(element); // Imprime um elemento específico
```

### Modo verboso
```bash
npm run test -- --reporter=verbose
```

### UI do Vitest
```bash
npm run test:ui
```

## Recursos adicionais

- [Vitest Documentation](https://vitest.dev/)
- [React Testing Library](https://testing-library.com/react)
- [Testing Library Best Practices](https://kentcdodds.com/blog/common-mistakes-with-react-testing-library)
