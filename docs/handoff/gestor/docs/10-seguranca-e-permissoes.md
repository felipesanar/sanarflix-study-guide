# 10 · Segurança, permissões e privacidade

Esta tela expõe **dados educacionais identificáveis de estudantes**. Tratar como dado pessoal sob LGPD.

## 1. Papéis

| Papel | Vê | Seletor de IES |
|---|---|---|
| `admin_b2b` (colaborador Sanar) | Todas as IES | Dropdown com todas |
| `gestor_grupo` | Todas as IES do seu grupo | Dropdown com as do grupo |
| `gestor_ies` | Apenas a própria IES | **Rótulo estático**, sem dropdown |

Regra: o seletor **só é clicável** para `admin_b2b` e `gestor_grupo`. Para `gestor_ies` não deve existir afordância de clique (nem desabilitada — simplesmente não é um controle).

## 2. Autorização (backend é a fronteira)

1. Toda query é escopada pela IES **derivada do token**, com verificação de pertencimento ao grupo quando `gestor_grupo`.
2. `iesId` recebido do cliente é *hint*: se não estiver na lista permitida → **403**, sem revelar existência (`404` genérico é aceitável).
3. IDs de aluno são **opacos** (UUID), nunca CPF, matrícula ou e-mail na URL.
4. Endpoint por aluno valida que o aluno pertence à IES em escopo.
5. Rate limit por usuário nos endpoints de export e busca.

## 3. Frontend

- Nunca esconder dado sensível só com CSS: se o papel não pode ver, o payload não vem.
- Não guardar payload de alunos em `localStorage`. Cache em memória (React Query) apenas.
- Sem PII em URL além do id opaco. Sem PII em telemetria, log de erro, breadcrumb ou nome de evento.
- Sanitizar qualquer texto vindo da API (enunciado de questão, nome) antes de renderizar. **Nunca** `dangerouslySetInnerHTML`.
- CSP restritiva; sem CDN de terceiros para script; sem `eval`.
- Timeout de sessão com aviso e recuperação do recorte pela URL após novo login.

## 4. Export e compartilhamento

- Exporta **sempre um recorte**, nunca a base inteira; o backend valida escopo e permissão.
- Todo export é auditado (`quem · quando · escopo · formato`) e carrega cabeçalho de confidencialidade com a IES e a data.
- "Copiar resumo" copia texto agregado — nunca lista nominal completa de alunos.

## 5. LGPD

- Base legal e finalidade documentadas no contrato com a IES (gestão acadêmica).
- Minimização: a tela mostra o necessário para decisão pedagógica; nada de dado de saúde, financeiro ou contato.
- Retenção conforme contrato; export tem prazo de expiração de link.
- Trilha de auditoria para acesso a dados nominais (visão detalhada do aluno).

## 6. Checklist de segurança do PR

- [ ] Nenhum endpoint novo aceita `iesId` sem validação de escopo
- [ ] Nenhum log/telemetria com nome, e-mail ou matrícula
- [ ] Nenhum dado de aluno em storage persistente
- [ ] Textos de API renderizados como texto, nunca HTML
- [ ] Export passa por permissão + auditoria
- [ ] Erros não vazam detalhe de infraestrutura para a UI
