## Alterações no banner "Sanção regulatória"

Objetivo: deixar o banner totalmente dinâmico em relação ao recorte de semestre, sem o selo "Institucional" e exibindo também o conceito previsto da IES com base no % de proficientes do recorte.

### 1. Remover o selo "Institucional" do banner
Arquivo: `src/components/analytics/v2/shell/InstitutionalAlertBanner.tsx`
- Remover a prop `showInstitutionalBadge` e o `<span>` que renderiza o selo.
- Limpar passagem da prop em `src/pages/DesempenhoInstitucionalV2.tsx` (apenas a do banner; o selo dos cards Conceito/Distância permanece, pois esses ainda são fixos por IES).

### 2. Tornar a sanção do banner reativa ao recorte de semestre
Arquivo: `src/utils/mapInstitutionalData.ts`
- Hoje a sanção do `headerSummary` é derivada de `instPercentProficientes` (IES inteira), enquanto o `%` mostrado no banner já é o do recorte. Isso produz uma combinação inconsistente quando o pcp do semestre difere do institucional.
- Passar a derivar `sancao` a partir de `percentProficientes` (scoped). Em "Todos os semestres" o valor coincide com o institucional, então nada muda visualmente nesse caso.

### 3. Exibir o conceito previsto (com base no % de proficientes do recorte) no banner
Arquivo: `src/utils/mapInstitutionalData.ts` + `src/types/desempenhoV2.ts`
- Adicionar `conceitoScoped: string | null` e `notaScoped: number | null` ao `HeaderSummary`, calculados via a função `getConceito(percentProficientes)` já existente no arquivo (mapeia 90/75/60/40 → Conceito 5..1).

Arquivo: `src/components/analytics/v2/shell/InstitutionalAlertBanner.tsx`
- Aceitar `conceitoScoped` como prop e renderizar inline no texto, por exemplo:
  
  "Sanção regulatória: Com 0% de proficientes — Conceito 1 previsto — Redução de 50% das vagas autorizadas do curso."

- Quando `sancao` for `null` (pcp ≥ 60), o banner continua oculto como hoje.

Arquivo: `src/pages/DesempenhoInstitucionalV2.tsx`
- Passar `conceitoScoped={data.headerSummary.conceitoScoped}` ao `InstitutionalAlertBanner`.

### Fora de escopo
- Cards "Nota Prevista da IES" e "Distância Próxima Faixa" continuam refletindo a IES inteira e mantêm o selo "Institucional" (eles não foram alvo do pedido).
- Nenhuma alteração no backend/RPC — toda a lógica adicional usa dados que o `triScoped` já retorna.
