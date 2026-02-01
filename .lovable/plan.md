
# Refatoracao do Sistema de Status de Simulados e Remocao de Valores Fixos

## Objetivo

1. Remover o campo de selecao manual de status do formulario de configuracao
2. Calcular o status automaticamente com base nas datas (Aguardando, Ativo, Encerrado)
3. Adicionar opcao "Liberar Imediatamente" no campo de data de liberacao
4. Substituir botao "Tornar Indisponivel" por "Encerrar Simulado" (somente para ativos)
5. Remover valores hardcoded de duracao (120, 180 minutos como padrao)
6. Garantir que a duracao configurada seja utilizada corretamente

---

## Analise do Estado Atual

### Problemas Identificados

| Problema | Localizacao | Impacto |
|----------|-------------|---------|
| Status setado manualmente | SimuladosTab.tsx linha 1198-1213 | Usuario pode setar status incorreto |
| Status "rascunho" no banco | simulados_admin.status default | Nao deveria existir |
| Duracao hardcoded 120 | SimuladosTab.tsx linha 103 | Valor padrao inicial |
| Duracao hardcoded 180 | SimuladosTab.tsx linhas 341, 528, 1228 | Reset de formulario |
| Campo duracao_minutos nao usado | ModoProva.tsx | Usa apenas data_encerramento |
| Botao "Tornar Indisponivel" sempre visivel | SimuladosTab.tsx linha 938-946 | Aparece para todos status |

### Nova Logica de Status (Computada)

```text
                              +------------------------+
                              |  Simulado Configurado  |
                              +------------------------+
                                         |
                      +------------------+------------------+
                      |                                     |
              data_liberacao              imediatamente=true (sem data_liberacao)
              no futuro                               |
                      |                               v
                      v                       +-------------+
              +---------------+               |    ATIVO    |
              |  AGUARDANDO   |               +-------------+
              +---------------+                      |
                      |                              |
              data_liberacao                  data_encerramento atingida
              atingida                        OU encerramento manual
                      |                              |
                      v                              v
              +---------------+               +--------------+
              |     ATIVO     |-------------->|  ENCERRADO   |
              +---------------+               +--------------+
```

---

## Implementacao

### 1. Modificar Interface e Estado do Formulario

**Arquivo:** `src/components/admin/SimuladosTab.tsx`

**Alteracoes:**

1. Remover campo `status` do `configForm` e do tipo `PreviewData`
2. Adicionar campo `liberarImediatamente: boolean` ao formulario
3. Remover opcoes de duracao hardcoded e usar primeiro valor como inicial

**Antes:**
```typescript
const [configForm, setConfigForm] = useState({
  nome: '',
  descricao: '',
  data_liberacao: '',
  data_encerramento: '',
  duracao_minutos: 120, // Padrao 2 horas
  status: 'rascunho' as 'ativo' | 'rascunho' | 'encerrado'
});
```

**Depois:**
```typescript
const [configForm, setConfigForm] = useState({
  nome: '',
  descricao: '',
  data_liberacao: '',
  data_encerramento: '',
  duracao_minutos: duracaoOpcoes[0].value, // Primeiro valor das opcoes
  liberarImediatamente: false
});
```

### 2. Adicionar Funcao de Calculo de Status

**Adicionar funcao utilitaria:**

```typescript
const calcularStatusSimulado = (
  dataLiberacao: string | null, 
  dataEncerramento: string | null,
  statusBanco: string
): 'aguardando' | 'ativo' | 'encerrado' => {
  const agora = new Date();
  
  // Se foi manualmente encerrado
  if (statusBanco === 'encerrado') return 'encerrado';
  
  // Se tem data de encerramento e ja passou
  if (dataEncerramento && new Date(dataEncerramento) < agora) {
    return 'encerrado';
  }
  
  // Se tem data de liberacao e ainda nao chegou
  if (dataLiberacao && new Date(dataLiberacao) > agora) {
    return 'aguardando';
  }
  
  // Caso contrario, esta ativo
  return 'ativo';
};
```

### 3. Modificar UI do Modal de Configuracao

**Remover campo de Status manual e adicionar checkbox "Liberar Imediatamente":**

**Antes (linhas 1198-1213):**
```tsx
<div>
  <Label>Status</Label>
  <Select ...>
    <SelectItem value="rascunho">Rascunho</SelectItem>
    <SelectItem value="ativo">Ativo</SelectItem>
    <SelectItem value="encerrado">Encerrado</SelectItem>
  </Select>
</div>
```

**Depois:**
```tsx
{/* Campo Data de Liberacao */}
<div>
  <Label>Data de Liberacao</Label>
  <Input
    type="datetime-local"
    value={configForm.data_liberacao}
    onChange={(e) => setConfigForm({ 
      ...configForm, 
      data_liberacao: e.target.value,
      liberarImediatamente: false 
    })}
    disabled={configForm.liberarImediatamente}
  />
  <div className="flex items-center gap-2 mt-2">
    <Checkbox
      id="liberar-imediatamente"
      checked={configForm.liberarImediatamente}
      onCheckedChange={(checked) => setConfigForm({
        ...configForm,
        liberarImediatamente: !!checked,
        data_liberacao: '' // Limpa data ao marcar
      })}
    />
    <label htmlFor="liberar-imediatamente" className="text-sm">
      Liberar imediatamente ao salvar
    </label>
  </div>
</div>
```

### 4. Modificar Logica de Salvamento

**Arquivo:** `src/components/admin/SimuladosTab.tsx`

**Alteracoes em `handleSaveSimulado`:**

```typescript
// Calcular status baseado nas condicoes
let statusCalculado: 'aguardando' | 'ativo' | 'encerrado';
const agora = new Date();

if (configForm.liberarImediatamente) {
  // Liberacao imediata = ativo agora, sem data de liberacao
  statusCalculado = 'ativo';
  dataLiberacaoISO = agora.toISOString(); // Marca como "agora"
} else if (dataLiberacaoISO && new Date(dataLiberacaoISO) > agora) {
  statusCalculado = 'aguardando';
} else {
  statusCalculado = 'ativo';
}

// Insert/Update com status calculado
await supabase.from('simulados_admin')
  .insert/update({
    ...outros_campos,
    data_liberacao: dataLiberacaoISO,
    data_encerramento: dataEncerramentoISO || null,
    status: statusCalculado
  });
```

### 5. Modificar Exibicao de Status na Tabela

**Alterar `getStatusBadge` para usar status calculado:**

```typescript
const getStatusBadge = (simulado: Simulado) => {
  const statusAtual = calcularStatusSimulado(
    simulado.data_liberacao,
    simulado.data_encerramento,
    simulado.status
  );
  
  const variants = {
    aguardando: { variant: 'secondary', label: 'Aguardando', icon: '🟡' },
    ativo: { variant: 'default', label: 'Ativo', icon: '🟢' },
    encerrado: { variant: 'destructive', label: 'Encerrado', icon: '🔴' }
  };
  
  const config = variants[statusAtual];
  return <Badge variant={config.variant}>{config.icon} {config.label}</Badge>;
};
```

### 6. Modificar Botao de Encerramento

**Substituir "Tornar Indisponivel" por "Encerrar Simulado":**

```tsx
{calcularStatusSimulado(simulado.data_liberacao, simulado.data_encerramento, simulado.status) === 'ativo' && (
  <Button
    variant="ghost"
    size="sm"
    onClick={() => handleEncerrarSimulado(simulado)}
    title="Encerrar simulado"
  >
    <StopCircle className="h-4 w-4 text-red-500" />
  </Button>
)}
```

**Renomear handler:**

```typescript
const handleEncerrarSimulado = async (simulado: Simulado) => {
  try {
    const { error } = await supabase
      .from('simulados_admin')
      .update({ status: 'encerrado' })
      .eq('id', simulado.id);

    if (error) throw error;

    toast({
      title: 'Simulado encerrado',
      description: 'O simulado foi encerrado e nao esta mais disponivel.'
    });

    fetchSimulados();
  } catch (error: any) {
    toast({
      title: 'Erro ao encerrar simulado',
      description: error.message,
      variant: 'destructive'
    });
  }
};
```

### 7. Atualizar Filtro de Status

**Modificar opcoes do filtro:**

```tsx
<Select value={statusFilter} onValueChange={setStatusFilter}>
  <SelectTrigger className="w-[180px]">
    <Filter className="h-4 w-4 mr-2" />
    <SelectValue placeholder="Filtrar por status" />
  </SelectTrigger>
  <SelectContent>
    <SelectItem value="todos">Todos</SelectItem>
    <SelectItem value="aguardando">Aguardando</SelectItem>
    <SelectItem value="ativo">Ativos</SelectItem>
    <SelectItem value="encerrado">Encerrados</SelectItem>
  </SelectContent>
</Select>
```

**Modificar logica de filtragem:**

```typescript
const filteredSimulados = simulados.filter(s => {
  const matchesSearch = s.nome.toLowerCase().includes(searchTerm.toLowerCase());
  const statusCalculado = calcularStatusSimulado(s.data_liberacao, s.data_encerramento, s.status);
  const matchesStatus = statusFilter === 'todos' || statusCalculado === statusFilter;
  return matchesSearch && matchesStatus;
});
```

### 8. Atualizar Default do Banco de Dados

**Migracao SQL necessaria:**

```sql
ALTER TABLE simulados_admin 
ALTER COLUMN status SET DEFAULT 'aguardando';
```

---

## Secao Tecnica

### Arquivos Modificados

| Arquivo | Alteracoes |
|---------|------------|
| `src/components/admin/SimuladosTab.tsx` | Remover campo status manual, adicionar checkbox imediatamente, calcular status, trocar botao |
| `simulados_admin` (banco) | Alterar default de 'rascunho' para 'aguardando' |

### Tipos Atualizados

```typescript
// Interface Simulado atualizada
interface Simulado {
  id: string;
  nome: string;
  descricao: string | null;
  data_liberacao: string | null;
  data_encerramento: string | null;
  duracao_minutos: number;
  status: 'aguardando' | 'ativo' | 'encerrado'; // Removido 'rascunho'
  created_at: string;
  questoes_count?: number;
}
```

### Fluxo de Status

| Acao do Usuario | Status Resultante |
|-----------------|-------------------|
| Salvar com data futura | aguardando |
| Salvar com "Imediatamente" | ativo |
| Data de liberacao atingida (automatico) | ativo |
| Clicar "Encerrar Simulado" | encerrado |
| Data de encerramento atingida (automatico) | encerrado |

### Impacto em Outros Componentes

- `simuladosApi.listarSimulados()`: Continua funcionando (ja filtra por `status = 'ativo'`)
- `SimuladosDisponiveis.tsx`: Nao precisa alteracao (calcula status localmente)
- `SimuladoCard.tsx`: Nao precisa alteracao (recebe status calculado)

---

## Validacao

1. Criar simulado com data de liberacao futura - deve aparecer como "Aguardando"
2. Criar simulado com "Liberar Imediatamente" marcado - deve aparecer como "Ativo"
3. Verificar que botao "Encerrar" so aparece para simulados ativos
4. Clicar em "Encerrar" e confirmar que status muda para "Encerrado"
5. Verificar que filtros funcionam corretamente com novos status
6. Confirmar que nao ha mais campo de status manual no modal de configuracao
7. Testar edicao de simulado existente - checkbox deve refletir estado atual
