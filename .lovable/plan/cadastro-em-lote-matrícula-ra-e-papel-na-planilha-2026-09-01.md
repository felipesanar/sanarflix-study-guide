# Cadastro em lote: Matrícula/RA e Papel na planilha

Adicionar duas colunas à importação em lote de usuários (Admin → Usuários → "Cadastro em lote"): `matricula_ra` (opcional) e `papel` (com default Aluno e validação estrita).

## Comportamento

Planilha modelo passa a ter 5 colunas: `nome`, `email`, `semestre`, `matricula_ra`, `papel`. Apenas `nome` e `email` continuam obrigatórios.

**Matrícula/RA (opcional)**
- Valor é normalizado (trim) e limitado a 50 caracteres; acima disso a linha é marcada como erro na pré-visualização.
- Em branco = não altera nada em usuários existentes e fica vazio nos novos.

**Papel (obrigatório com default)**
- Em branco = `aluno`.
- Valores aceitos, exatamente como no Academy (case-insensitive, acento e espaço tolerados): `aluno`, `admin`, `professor`, `gestor`, `gestor_grupo`, `atendimento`. Também aceita os rótulos da tela ("Gestor de Grupo", "Atendimento").
- Papel inválido/inexistente → a linha entra como **erro** na pré-visualização com a mensagem listando os valores válidos, e não é cadastrada. Nenhum papel novo pode ser criado por essa via.
- O operador do Atendimento (CX) só pode importar linhas com papel `aluno`; qualquer outro papel na planilha vira erro de linha para ele.

**Pré-visualização e relatório**
- A tela de conferência já mostra novos/atualizar/conflitos/erros; as novas validações apenas aparecem como erros de linha com mensagem clara.
- O relatório XLSX final passa a incluir as colunas Matrícula/RA e Papel por linha.

## Detalhes técnicos

Só frontend — a Edge Function `b2b-create-user` já aceita `matricula_ra` (máx. 50, ausência = não altera) e `role` (enum `admin|professor|gestor|atendimento|gestor_grupo`, ausência = aluno), e já registra ambos na auditoria. Nenhuma migration.

- `src/components/admin/usuarios/BulkCreateUsersDialog.tsx`
  - `Row` ganha `matricula_ra: string | null` e `role: 'aluno' | ...`.
  - `parseUsersFile`: lê as colunas `matricula_ra` (aliases `matricula`, `ra`) e `papel` (aliases `role`, `perfil`); normaliza o papel via mapa rótulo→valor e devolve erro de linha quando não casa; valida o tamanho do RA.
  - `execute`: passa `matricula_ra` e `role` (omitindo `role` quando `aluno`) para `usersService.createUser`, inclusive no retry de RATE_LIMITED.
  - `downloadExampleXlsx`: modelo com as 5 colunas e exemplos preenchidos; texto de ajuda abaixo do input atualizado com os valores válidos de papel.
  - `downloadFailuresReport`: novas colunas no XLSX de resultados.
  - Novo prop `canManageRoles` para o recorte do Atendimento.
- `src/experiences/admin/pages/UsuariosPage.tsx`: passa `canManageRoles={canManage}` ao diálogo (mesma capability usada em `CreateUserDialog`).
- Mapa de papéis e normalização extraídos para um módulo compartilhado com `CreateUserDialog` (evita duas listas divergentes de `ROLE_OPTIONS`).
- `src/services/usersService.ts`: `CreateUserPayload` ganha `matricula_ra?: string | null`.
- Teste unitário do parser cobrindo: papel em branco → aluno, papel inválido → erro, rótulo com espaço/maiúscula aceito, RA longo → erro.
