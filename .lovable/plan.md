# Reformulação da exportação institucional

## Objetivo
Tornar a exportação previsível, completa e fácil de usar no desktop e no mobile, mantendo o acesso atual no Portal do Gestor.

## Experiência
- Reorganizar o drawer em três etapas verticais: **1. Simulados**, **2. Conteúdo do arquivo**, **3. Formato e geração**.
- Aplicar a direção escolhida: vinho institucional para identidade, azul para seleção/progresso, títulos em Sora e textos em Manrope.
- Aumentar contraste e área de toque dos checkboxes; tornar marcado, desmarcado, indisponível e foco de teclado visualmente inequívocos.
- Substituir o rodapé flutuante por uma área final no fluxo do documento, com botões compactos para PDF e XLSX, responsivos e sem cobrir conteúdo.
- Exibir um resumo antes da geração: recorte, simulados, blocos, presença de dados pessoais e quantidade de alunos carregados.
- Manter aviso LGPD junto da opção “Lista de alunos” e reforçá-lo no arquivo.

## Integridade dos dados
- Criar uma consulta de exportação que percorra todas as páginas da RPC de alunos, respeitando o limite atual de 100 registros por chamada.
- Validar a soma carregada contra o `total` retornado pela RPC; não habilitar a geração enquanto houver páginas pendentes ou resultado incompleto.
- Tratar separadamente erros de visão geral, detalhamento, questões, cronograma e alunos, com nova tentativa contextual.
- Impedir que um bloco selecionado seja exportado vazio por falha de carregamento; a UI explicará qual dado falta em vez de gerar um documento silenciosamente incompleto.

## PDF e planilha
- Garantir que a seção/aba de alunos receba a lista completa e informe a quantidade exportada.
- Melhorar contraste do PDF com vinho na identidade, azul em elementos funcionais, superfícies alternadas e hierarquia mais clara entre capa, seções, KPIs e tabelas.
- Preservar paginação, repetição de cabeçalhos, aviso LGPD e a regra de mostrar “—” quando não houver dado.
- Manter PDF e XLSX com os mesmos blocos e o mesmo recorte.

## Validação
- Cobrir paginação completa, falha em página intermediária, bloqueio de arquivo parcial e inclusão da lista nominal em PDF/XLSX.
- Atualizar testes do seletor para contraste, teclado e estados selecionado/desabilitado.
- Verificar visualmente o drawer em desktop e mobile, incluindo rolagem, foco, textos longos e ações finais sem sobreposição.
- Gerar arquivos de teste, renderizar todas as páginas do PDF e inspecionar cortes, tabelas, cabeçalhos e nomes de alunos.

## Limites
- Não alterar regras de autorização, escopo multi-tenant ou a RPC existente.
- Não mover o botão para outras páginas nesta etapa: o acesso atual é coerente; os problemas confirmados estão no carregamento e na experiência interna do drawer.
