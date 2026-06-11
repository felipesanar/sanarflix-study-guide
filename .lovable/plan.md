# Correção: download do template CSV cai na tela "Sign in to continue" do preview

## Causa
O botão de download usa um `<a href="/templates/template_atualizacao_emails.csv">`. No preview do Lovable, qualquer navegação para um caminho que não é uma rota do app (como o arquivo estático em `/public/templates/...`) é interceptada pelo gateway de preview e redirecionada para a tela "Sign in to continue" — daí o loop, mesmo após clicar em "Open sign-in". Em produção o arquivo serviria normalmente, mas o fluxo via preview fica quebrado.

## Correção
Gerar o CSV diretamente no cliente, com um `Blob`, e disparar o download via `URL.createObjectURL`. Mesmo padrão já usado por `downloadReport` no próprio arquivo. Não depende de arquivo estático, funciona idêntico em preview e em produção.

Mudança única em `src/components/admin/BulkEmailUpdateTab.tsx`, função `downloadTemplate`:

```ts
function downloadTemplate() {
  const content =
    'email_antigo,email_novo\n' +
    'aluno.antigo@faculdade.edu.br,aluno.novo@faculdade.edu.br\n';
  const blob = new Blob([content], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'template_atualizacao_emails.csv';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
```

O arquivo `public/templates/template_atualizacao_emails.csv` pode ficar como está (ou ser removido depois) — não é mais referenciado.

## Validação
1. No preview, abrir Portal do Admin → aba de atualização em lote de emails.
2. Clicar em "Baixar template" → o arquivo `template_atualizacao_emails.csv` deve ser baixado diretamente, sem redirecionamento para "Sign in to continue".
3. Abrir o CSV e conferir cabeçalho `email_antigo,email_novo` + linha de exemplo.

## Fora de escopo
- Nenhuma mudança na edge function, no fluxo de upload, validação, ou permissões.
- A correção do CORS (`lovableproject.com` na allowlist) discutida antes continua pendente e independente desta — sem ela o upload em si segue falhando no preview.
