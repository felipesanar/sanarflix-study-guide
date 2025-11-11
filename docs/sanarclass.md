# SanarClass - Documentação Técnica

## Visão Geral
SanarClass é uma funcionalidade que permite que professores das IES parceiras criem e compartilhem aulas em colaboração com o Sanarflix. Os alunos podem acessar, visualizar e baixar essas aulas diretamente pela plataforma.

## Estrutura do Banco de Dados

### Tabela: `sanarclass_lessons`

**Colunas:**
- `id` (UUID) - Identificador único da aula
- `titulo` (TEXT) - Título da aula
- `professor` (TEXT) - Nome do professor
- `disciplina` (TEXT) - Nome da disciplina
- `semestre` (INTEGER) - Semestre da aula (1-12)
- `formato` (TEXT) - Formato do arquivo ('pdf' ou 'pptx')
- `data_publicacao` (TIMESTAMP WITH TIME ZONE) - Data de publicação
- `arquivo_url` (TEXT) - URL do arquivo da aula
- `preview_url` (TEXT, nullable) - URL da imagem de preview
- `ies_id` (UUID) - ID da instituição (FK para `ies`)
- `created_at` (TIMESTAMP WITH TIME ZONE) - Data de criação
- `updated_at` (TIMESTAMP WITH TIME ZONE) - Data da última atualização

**Índices:**
- `idx_sanarclass_lessons_ies_id` - Performance em queries por IES
- `idx_sanarclass_lessons_professor` - Filtragem por professor
- `idx_sanarclass_lessons_disciplina` - Filtragem por disciplina
- `idx_sanarclass_lessons_semestre` - Filtragem por semestre

**RLS Policies:**
1. **Leitura (SELECT)**: Usuários podem ver apenas aulas da sua IES
   - Usa função `get_current_user_ies_id()`
2. **Gerenciamento (ALL)**: Apenas admins podem criar, editar e excluir
   - Usa função `has_role(auth.uid(), 'admin'::app_role)`

## Componentes Frontend

### 1. Página do Usuário: `src/pages/SanarClass.tsx`

**Seções:**
- **Hero Section**: Apresentação com CTA para solicitar novas aulas
- **Filtros Dinâmicos**: Busca e filtros por professor, disciplina, semestre e formato
- **Grade de Aulas**: Cards responsivos (3→2→1 colunas)
- **Modal de Visualização**: Preview com iframe do documento
- **Seção de Incentivo**: CTA para alunos solicitarem aulas

**Funcionalidades:**
- Filtros em tempo real conectados ao Supabase
- Preview de documentos em modal
- Download direto de arquivos
- Filtragem por professor ao clicar em "Ver outras aulas do professor"
- Estados vazios com mensagens motivacionais

### 2. Portal Admin: `src/components/admin/SanarClassTab.tsx`

**Funcionalidades:**
- Listagem de todas as aulas (admins veem todas as IES)
- Adicionar nova aula via modal
- Editar aula existente
- Excluir aula com confirmação
- Validação de campos obrigatórios
- Feedback visual (loading, toasts)

**Campos do Formulário:**
- Título da aula *
- Professor *
- Disciplina *
- Semestre * (1-12)
- Formato * (PDF ou PPTX)
- Instituição * (select de IES cadastradas)
- Link do documento *
- Link do preview (opcional)

## Rotas

- **Página do usuário**: `/sanarclass`
- **Portal admin**: `/gestao-usuarios` → Tab "SanarClass"

## Integração com Sistema

### Sidebar
- Item "SanarClass" adicionado com ícone `Sparkles`
- Disponível para todos os usuários autenticados
- Descrição: "Aulas da sua IES com o Sanarflix"

### Portal do Admin
- Nova tab "SanarClass" com ícone `FileText`
- Acessível apenas para usuários com role `admin`

## Fluxo de Uso

### Para Alunos:
1. Acessar "SanarClass" na sidebar
2. Visualizar aulas da sua IES
3. Usar filtros para encontrar aulas específicas
4. Clicar em "Visualizar" para preview em modal
5. Baixar arquivo diretamente
6. Solicitar novas aulas via CTA

### Para Admins:
1. Acessar "Portal do Admin" → Tab "SanarClass"
2. Ver todas as aulas cadastradas
3. Adicionar nova aula preenchendo formulário
4. Editar ou excluir aulas existentes
5. Aulas aparecem automaticamente para alunos da IES

## Melhorias Futuras Planejadas
- Upload direto de arquivos (ao invés de URLs)
- Geração automática de preview
- Sistema de favoritos
- Histórico de visualizações
- Comentários e avaliações
- Notificações de novas aulas

## Segurança
- RLS garante que alunos vejam apenas aulas da sua IES
- Apenas admins podem gerenciar conteúdo
- Validação de formato de arquivo (pdf/pptx)
- URLs validadas no frontend