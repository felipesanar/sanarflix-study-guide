# Botão de exportar em PDF na Visão Geral

Hoje a exportação existe só no Início, dentro do cartão "Exportar dados". Na Visão Geral não há nenhum caminho para gerar o arquivo — quem está olhando os indicadores precisa voltar uma tela. Vamos colocar o botão direto no cabeçalho da Visão Geral, reaproveitando o mesmo painel de exportação já usado no Início.

## Como fica a experiência

- No cabeçalho da Visão geral, ao lado do filtro de semestre e do glossário, entra o botão **Exportar PDF** (ícone de download).
- Clicar abre o mesmo painel lateral de exportação de sempre: escolha de formato (PDF ou planilha), quais blocos entram, resumo do recorte e o botão de gerar.
- O painel abre já com o **PDF** pré-selecionado e com os blocos essenciais marcados, para o caso de uso principal: baixar um documento pronto para mandar para o gestor da faculdade.
- O recorte atual da tela (instituição e semestre) é o recorte do arquivo, sem precisar reconfigurar nada.
- O botão só aparece para quem tem permissão de exportar — mesma regra do Início; para os demais papéis ele simplesmente não existe.
- O painel só é montado depois do clique, então quem não exporta não paga nenhuma consulta extra.
- Em telas pequenas o botão fica junto dos outros controles do cabeçalho, com rótulo curto.

## Detalhes técnicos

- `src/features/gestor/routes/VisaoGeral.tsx`: estado local `exportarAberto`, botão dentro de `acoes` do `CabecalhoTela` (mesma anatomia visual dos controles vizinhos), gate por `contexto?.podeExportar`, e `DialogExportarDados` montado condicionalmente com `iesId` vindo de `useFiltrosGestor`. Telemetria: `exportSolicitado('visao_geral')` já é emitida pelo próprio painel.
- `src/features/gestor/components/DialogExportarDados.tsx`: nova prop opcional `formatoInicial?: FormatoExport` (padrão `pdf`, mantendo o comportamento atual para o Início) para a Visão Geral abrir já em PDF.
- Nenhuma mudança de RPC, migration ou motor de PDF: `exportarRecorte.ts` e `relatorioPdf.ts` seguem intactos.
- Teste: em `VisaoGeral.test.tsx`, o botão aparece com `podeExportar: true` e não aparece com `false`.
