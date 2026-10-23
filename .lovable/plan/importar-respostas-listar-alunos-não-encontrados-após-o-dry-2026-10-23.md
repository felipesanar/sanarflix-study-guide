# Importar respostas: listar alunos não encontrados após o dry-run

## O que muda
Na etapa de pré-visualização, abaixo dos 4 cartões, aparece a seção "Alunos não encontrados (N)" quando houver erros:
- Tabela com: Linha da planilha, Matrícula/RA ou e-mail, Motivo (texto amigável, ex.: "Matrícula/RA não encontrada nas IES do simulado", "E-mail não cadastrado", "Matrícula/RA duplicada na planilha").
- Busca rápida por identificador e filtro por motivo.
- Rolagem interna limitada (~10 linhas visíveis) para não alongar a página.
- Botão "Baixar lista (.xlsx)" com as mesmas colunas, para tratar fora do app (ex.: cadastrar RA/e-mail faltante e reimportar).
- Opcional na mesma seção: aba "Avisos" listando linhas com warning (ex.: respostas parciais), se houver.

## Detalhes técnicos
- Fonte: `previewResults` (já retornado pelo dry-run da edge function, com `matricula_ra`, `status`, `reason`); filtrar `status === 'preview_error'`. Sem mudança no banco nem na edge function.
- Número da linha: mapear pelo identificador normalizado (`normRa`) contra `parsedRows[].rowIndex`.
- Passar `naoEncontradosLista` como nova prop para `ImportarDryRunStep`; motivo via `REASON_LABEL` (fallback: código cru).
- Export com `xlsx` (já usado no projeto), arquivo `nao-encontrados-<simulado>.xlsx`.
- Teste unitário pequeno da função que monta a lista (filtra só erros, resolve linha e motivo).
