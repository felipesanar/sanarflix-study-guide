# 📚 SanarFlix – Guia de Estudos

Este repositório abriga o projeto **Guia de Estudos da SanarFlix**, uma aplicação desenvolvida para oferecer uma experiência personalizada de estudos para alunos de instituições de ensino superior parceiras da Sanar.

A proposta é simples: ajudar o aluno a navegar pelos conteúdos da SanarFlix de acordo com o semestre em que ele está, destacando os materiais mais relevantes e organizando-os de forma clara e didática.

---

## 🚀 Objetivo do Projeto

A plataforma foi criada para:

- Organizar os conteúdos da SanarFlix conforme o semestre de cada curso
- Oferecer uma trilha de estudos clara e objetiva
- Aumentar o engajamento dos alunos com os materiais disponíveis
- Apoiar as instituições de ensino na jornada de aprendizagem dos alunos
- Fornecer analytics e insights sobre o progresso dos estudantes

---

## 🧰 Tecnologias Utilizadas

### Frontend
- [React 18](https://reactjs.org/) – biblioteca principal para construção da interface
- [TypeScript](https://www.typescriptlang.org/) – tipagem estática para JavaScript
- [Vite](https://vitejs.dev/) – bundler moderno para desenvolvimento rápido
- [Tailwind CSS](https://tailwindcss.com/) – framework utilitário de estilos
- [shadcn/ui](https://ui.shadcn.dev/) – componentes acessíveis e com design moderno
- [React Query](https://tanstack.com/query) – gerenciamento de estado servidor
- [React Router](https://reactrouter.com/) – roteamento client-side
- [Framer Motion](https://www.framer.com/motion/) – animações fluidas

### Backend
- [Supabase](https://supabase.com/) – backend-as-a-service
- [PostgreSQL](https://www.postgresql.org/) – banco de dados relacional
- [Edge Functions](https://supabase.com/docs/guides/functions) – serverless functions
- [Row Level Security](https://supabase.com/docs/guides/auth/row-level-security) – segurança de dados

### Qualidade & Testes
- [Vitest](https://vitest.dev/) – framework de testes
- [Testing Library](https://testing-library.com/) – utilitários de teste
- [ESLint](https://eslint.org/) – linting de código
- [TypeScript Strict Mode](https://www.typescriptlang.org/tsconfig#strict) – verificação rigorosa de tipos

---

## 🔧 Como rodar o projeto localmente

### Pré-requisitos
- [Node.js](https://nodejs.org/) v18+ (recomendado usar [nvm](https://github.com/nvm-sh/nvm))
- [npm](https://www.npmjs.com/) ou [yarn](https://yarnpkg.com/)

### Passo a passo:

```bash
# 1. Clone o repositório
git clone https://github.com/felipesanar/sanarflix-study-guide.git

# 2. Acesse o diretório do projeto
cd sanarflix-study-guide

# 3. Instale as dependências
npm install

# 4. Configure as variáveis de ambiente
cp .env.example .env.local
# Edite o arquivo .env.local com suas configurações

# 5. Inicie o servidor de desenvolvimento
npm run dev

# 6. Acesse a aplicação
# http://localhost:8080
```

### Scripts Disponíveis

```bash
# Desenvolvimento
npm run dev              # Inicia servidor de desenvolvimento
npm run build           # Build para produção
npm run preview         # Preview do build de produção

# Qualidade de Código
npm run lint            # Executa linting
npm run lint:fix        # Corrige problemas de linting automaticamente
npm run type-check      # Verifica tipos TypeScript

# Testes
npm run test            # Executa testes em modo watch
npm run test:run        # Executa testes uma vez
npm run test:coverage   # Executa testes com coverage
npm run test:ui         # Interface visual para testes

# Análise
npm run analyze         # Analisa o bundle size
```

---

## 🏗️ Arquitetura do Projeto

```
src/
├── components/          # Componentes reutilizáveis
│   ├── ui/             # Componentes base (shadcn/ui)
│   └── analytics/      # Componentes específicos de analytics
├── contexts/           # Context providers (Auth, Study)
├── hooks/              # Custom hooks
├── pages/              # Páginas da aplicação
├── services/           # Serviços de API
├── types/              # Definições de tipos TypeScript
├── utils/              # Utilitários e helpers
└── test/               # Configuração e utilitários de teste
```

---

## 🔒 Segurança

### Medidas Implementadas
- ✅ Autenticação JWT com Supabase Auth
- ✅ Row Level Security (RLS) no banco de dados
- ✅ Validação de dados com Zod
- ✅ Sanitização de inputs
- ✅ Logging seguro (sem dados sensíveis em produção)
- ✅ CORS configurado adequadamente
- ✅ Rate limiting nas Edge Functions

### Controle de Acesso
- **B2B**: Acesso completo (guia de estudos, dashboard, gestão de usuários)
- **B2C**: Acesso limitado (apenas cronograma dos últimos 30 dias)
- **USCS**: Acesso à página exclusiva do intensivo

---

## 📊 Performance

### Otimizações Implementadas
- ✅ Code splitting com React.lazy()
- ✅ Memoização de componentes com React.memo()
- ✅ Cache inteligente com React Query
- ✅ Lazy loading de imagens
- ✅ Bundle optimization
- ✅ Web Vitals monitoring

### Métricas Alvo
- **LCP**: < 2.5s
- **FID**: < 100ms
- **CLS**: < 0.1
- **Bundle Size**: < 500KB (gzipped)

---

## 🧪 Testes

### Estratégia de Testes
- **Unit Tests**: Componentes e utilitários
- **Integration Tests**: Fluxos completos
- **E2E Tests**: Cenários críticos (planejado)

### Coverage Alvo
- **Branches**: 80%+
- **Functions**: 80%+
- **Lines**: 80%+
- **Statements**: 80%+

```bash
# Executar todos os testes
npm run test:run

# Executar com coverage
npm run test:coverage

# Interface visual
npm run test:ui
```

---

## 🚀 Deploy

### Ambientes
- **Desenvolvimento**: Automático via Vercel/Netlify
- **Staging**: Deploy manual para testes
- **Produção**: Deploy via CI/CD após aprovação

### Variáveis de Ambiente
```bash
VITE_SUPABASE_URL=your_supabase_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
VITE_APP_ENV=production
```

---

## 📈 Monitoramento

### Ferramentas
- **Error Tracking**: Sentry (planejado)
- **Performance**: Web Vitals + Custom metrics
- **Analytics**: Google Analytics (planejado)
- **Uptime**: Pingdom/UptimeRobot (planejado)

---

## 🤝 Contribuição

### Fluxo de Desenvolvimento
1. Fork o projeto
2. Crie uma branch para sua feature (`git checkout -b feature/AmazingFeature`)
3. Commit suas mudanças (`git commit -m 'Add some AmazingFeature'`)
4. Push para a branch (`git push origin feature/AmazingFeature`)
5. Abra um Pull Request

### Padrões de Código
- Use TypeScript strict mode
- Siga as regras do ESLint
- Escreva testes para novas funcionalidades
- Documente APIs e componentes complexos
- Use conventional commits

---

## 📝 Changelog

### v2.0.0 (Atual)
- ✅ Implementação de sistema de logging seguro
- ✅ Error Boundary para captura de erros
- ✅ Validação rigorosa com Zod
- ✅ Configuração TypeScript strict
- ✅ Testes automatizados com Vitest
- ✅ Monitoramento de performance
- ✅ Otimizações de bundle

### v1.0.0
- ✅ Implementação inicial
- ✅ Autenticação com Supabase
- ✅ Guia de estudos por semestre
- ✅ Dashboard de progresso
- ✅ Gestão de usuários B2B

---

## 📄 Licença

Este projeto está sob a licença MIT. Veja o arquivo [LICENSE](LICENSE) para mais detalhes.

---

## 📞 Suporte

Para dúvidas ou suporte:
- 📧 Email: suporte@sanar.com.br
- 📱 WhatsApp: (71) 99999-9999
- 🌐 Site: [sanar.com.br](https://sanar.com.br)

---

**Desenvolvido com ❤️ pela equipe Sanar**
