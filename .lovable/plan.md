

# Correção: Botão "Continuar estudos" cortado

## Problema
O botão "Continuar estudos" no WelcomeCard está sendo cortado em telas de tamanho intermediário. O layout muda para row (`xl:flex-row`) mas o conteúdo pode transbordar o card.

## Solução

### Arquivo: `src/components/home/WelcomeCard.tsx`

1. **Adicionar `overflow-hidden` ao container principal** (linha 107) para evitar que conteúdo vaze visualmente do card.

2. **Ajustar o breakpoint de row layout** de `xl` para `lg` na linha 108, garantindo que em telas médias o botão tenha espaço suficiente ao lado do nome.

3. **Limitar o tamanho do nome do usuário** (linha 129) para que o texto do nome não empurre o botão para fora, ajustando o `max-w` em tamanhos intermediários.

4. **Garantir `min-w-fit` no container do botão** (linha 150) para que o botão nunca seja comprimido abaixo do seu tamanho natural.

### Mudanças específicas:

- Linha 108: `flex-col xl:flex-row xl:items-center xl:justify-between` -> `flex-col lg:flex-row lg:items-center lg:justify-between`
- Linha 150: adicionar `min-w-fit` ao container do botão para impedir compressão
- Linha 129: ajustar `max-w` do h1 para não empurrar o botão em telas `lg`

