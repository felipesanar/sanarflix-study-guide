

## Correcao do Cache e Carregamento do Guia de Estudos

### Problemas Identificados

**1. Cache localStorage de 2 HORAS bloqueia atualizacoes (PRINCIPAL)**

Linha 83 do `StudyGuide.tsx`:
```
const CACHE_TTL = 2 * 60 * 60 * 1000; // 2 hours
```
Ctrl+Shift+R limpa o cache do NAVEGADOR, mas NAO limpa localStorage. Entao o usuario ve dados de ate 2 horas atras, mesmo com hard reload.

**2. `loadedSemestres` impede re-fetch**

Linha 386: `if (loadedSemestres.has(semestre)) return;`
Uma vez que um semestre e carregado (mesmo do cache stale), ele nunca mais e buscado novamente durante a sessao. Se o admin atualiza o guia, o usuario so vera os dados novos se fechar e reabrir o navegador E esperar o TTL de 2 horas expirar.

**3. `hasLoadedData.current` bloqueia re-fetches**

Linha 319: `if (hasLoadedData.current) return;`
O efeito principal so roda UMA vez. Se o cache foi encontrado, `hasLoadedData.current = true` e setado imediatamente (linha 330), e o background fetch roda uma unica vez. Porem, se o usuario navega para outra pagina e volta, nada e re-buscado.

**4. Cache-first mostra dados stale sem indicacao visual**

O usuario nao tem como saber se os dados que esta vendo sao do cache ou do servidor. Nao ha botao de atualizar nem indicacao de "ultima atualizacao".

---

### Plano de Correcao

#### 1. Reduzir TTL do cache para 15 minutos

**Arquivo: `src/pages/StudyGuide.tsx`**

Mudar de 2 horas para 15 minutos:
```
const CACHE_TTL = 15 * 60 * 1000; // 15 minutos
```
Cache continua util para carregamento instantaneo, mas dados stale expiram muito mais rapido.

#### 2. SEMPRE fazer background fetch, mesmo com cache valido

**Arquivo: `src/pages/StudyGuide.tsx`**

Refatorar o efeito principal (linhas 313-381) para:
- Mostrar cache imediatamente (mantendo experiencia instantanea)
- SEMPRE buscar dados frescos do servidor em background
- Quando dados frescos chegam, comparar com o cache: se forem diferentes, atualizar a UI e o cache
- Remover o guard `hasLoadedData.current` que bloqueia re-fetches
- Usar um ref `isMounted` para evitar atualizacoes apos desmontagem

#### 3. Permitir re-fetch ao trocar de semestre

**Arquivo: `src/pages/StudyGuide.tsx`**

Refatorar `fetchSemestreData` (linhas 384-426) para:
- Remover o guard `if (loadedSemestres.has(semestre)) return;`
- Se dados do cache existem, mostrar imediatamente
- SEMPRE buscar dados frescos do servidor em background (mesmo se o semestre ja foi "carregado")
- Atualizar silenciosamente quando dados frescos chegam

#### 4. Adicionar botao de refresh manual + indicador de atualizacao

**Arquivo: `src/pages/StudyGuide.tsx`**

Adicionar:
- Um botao "Atualizar" no header do guia (icone RefreshCw) que limpa o cache do semestre atual e forca um re-fetch
- Estado `lastUpdated` que mostra quando os dados foram buscados pela ultima vez
- Indicador discreto "Atualizando..." durante background fetches (sem bloquear a UI)

#### 5. Invalidar cache apos import do admin

**Arquivo: `src/components/admin/study-guide-import/StudyGuideImportWizard.tsx`**

Apos importacao bem-sucedida, limpar todos os caches do study guide no localStorage:
```
// Limpar todos os caches de study guide
Object.keys(localStorage).forEach(key => {
  if (key.startsWith('perf_study_contents_')) {
    localStorage.removeItem(key);
  }
});
```
Isso garante que se o admin importar dados e depois acessar o guia, vera os dados novos imediatamente.

---

### Resumo das Mudancas

| Arquivo | Mudanca |
|---------|---------|
| `src/pages/StudyGuide.tsx` | TTL de 2h para 15min; sempre fazer background fetch; botao refresh; indicador de atualizacao |
| `src/components/admin/study-guide-import/StudyGuideImportWizard.tsx` | Limpar cache localStorage apos import bem-sucedido |

### Resultado Esperado

- Ao carregar a pagina: dados do cache aparecem instantaneamente, background fetch atualiza silenciosamente em ~1-2s
- Apos admin importar novos dados: cache antigo invalidado; proxima visita mostra dados frescos
- Botao "Atualizar" permite refresh manual a qualquer momento
- Troca de semestre sempre busca dados frescos (sem ficar preso a dados stale)
- Ctrl+Shift+R + esperar 1-2s = dados atualizados (background fetch roda automaticamente)

