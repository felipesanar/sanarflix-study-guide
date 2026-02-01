
# Plano: Botao "Como usar o Modo Simulado" + Modal Tutorial Interativo

## Objetivo
Criar um botao destacado na pagina de Simulados que abre um modal bonito, interativo e educativo explicando todas as funcionalidades do Modo Prova para que o usuario possa fazer a melhor prova possivel.

---

## Componentes a Serem Criados

### 1. Novo Componente: `HowToUseSimuladoModal.tsx`
**Localizacao:** `src/components/simulados/HowToUseSimuladoModal.tsx`

Modal interativo com design premium contendo:

**Estrutura Visual:**
- Header com gradiente e icone chamativo
- Navegacao em steps/tabs para organizar o conteudo
- Animacoes suaves com Framer Motion
- Cards com icones ilustrativos para cada funcionalidade

**Secoes do Tutorial (Steps):**

1. **Bem-vindo ao Modo Prova**
   - Introducao ao ambiente de prova
   - Dicas de preparacao (ambiente silencioso, tela cheia, etc.)
   
2. **Navegacao e Interface**
   - Barra de progresso no topo
   - Cronometro regressivo
   - Navegacao lateral com codigo de cores (verde=respondida, azul=revisao, cinza=nao respondida)
   - Botoes Anterior/Proxima

3. **Respondendo Questoes**
   - Como selecionar alternativas (clique ou teclas 1-4)
   - Como eliminar alternativas (icone de lixeira)
   - Como restaurar alternativas eliminadas
   
4. **Marcacao para Revisao**
   - Botao "Revisar" para marcar questoes
   - Identificacao na navegacao lateral (cor azul)
   - Tecla F como atalho

5. **Atalhos de Teclado**
   - Grid visual com todos os atalhos:
     - 1/2/3/4: Alternativas A/B/C/D
     - Setas: Navegacao
     - F: Marcar para revisao
     - Esc: Finalizar

6. **Finalizacao**
   - Resumo de questoes respondidas
   - Questoes marcadas para revisao
   - Confirmacao de envio
   - O que acontece apos finalizar

**Elementos de UI:**
- Indicador de progresso no modal (dots ou steps)
- Botoes "Anterior" e "Proximo" para navegar
- Botao "Entendi, vamos comecar!" no final
- Icones do Lucide para cada funcionalidade
- Badges e cards com bordas suaves

---

### 2. Atualizacao: Pagina `Simulados.tsx`
**Localizacao:** `src/pages/Simulados.tsx`

**Alteracoes:**
- Adicionar botao "Como usar o Modo Simulado" no header
- Posicionamento responsivo:
  - **Desktop:** Lado direito do titulo
  - **Mobile:** Abaixo do subtitulo, largura total
- Estado para controlar abertura do modal
- Import do novo componente

**Estilo do Botao:**
- Gradiente de fundo (primary para accent)
- Icone HelpCircle ou Lightbulb
- Hover com elevacao e glow sutil
- Bordas arredondadas
- Texto: "Como usar o Modo Simulado"

---

## Detalhes Tecnicos

### Dependencias Utilizadas
- `framer-motion`: Animacoes de entrada/transicao entre steps
- `lucide-react`: Icones (HelpCircle, Keyboard, Flag, ArrowLeft, ArrowRight, Trash2, Check, Timer, etc.)
- `@radix-ui/react-dialog`: Base do modal (via componente Dialog existente)
- Componentes UI existentes: Button, Badge, Card, Dialog

### Responsividade
- Modal com `max-w-2xl` em desktop
- Steps empilhados verticalmente em mobile
- Botao do header adaptativo (flex row em desktop, column em mobile)
- Scroll interno no modal se necessario

### Animacoes
```text
Entrada do modal: fade-in + scale-in
Transicao entre steps: slide horizontal com fade
Cards: hover com elevacao sutil
Icones: pulse sutil em destaque
```

### Acessibilidade
- Focus trap no modal
- Navegacao por teclado entre steps
- Aria labels descritivos
- Contraste adequado

---

## Estrutura de Arquivos

```text
src/components/simulados/
  HowToUseSimuladoModal.tsx  (NOVO)
  
src/pages/
  Simulados.tsx              (ATUALIZADO)
```

---

## Fluxo de Usuario

1. Usuario acessa `/simulados`
2. Ve o botao destacado "Como usar o Modo Simulado"
3. Clica no botao
4. Modal abre com animacao suave
5. Navega pelos steps do tutorial
6. Finaliza clicando em "Entendi!" ou fechando o modal
7. Continua para escolher e iniciar um simulado

---

## Exemplo Visual do Modal

```text
+--------------------------------------------------+
|  [X]                                             |
|                                                  |
|  [icone] Como usar o Modo Simulado               |
|                                                  |
|  [1] [2] [3] [4] [5] [6]  <- indicador de steps  |
|                                                  |
|  +--------------------------------------------+  |
|  |  [icone grande]                            |  |
|  |                                            |  |
|  |  Titulo do Step                            |  |
|  |                                            |  |
|  |  Descricao detalhada com cards             |  |
|  |  ilustrativos e exemplos visuais           |  |
|  |                                            |  |
|  +--------------------------------------------+  |
|                                                  |
|  [<- Anterior]            [Proximo ->]          |
+--------------------------------------------------+
```

---

## Estimativa

- Criacao do componente modal: principal entrega
- Atualizacao da pagina Simulados: ajuste simples
- Testes visuais em desktop e mobile: validacao final
