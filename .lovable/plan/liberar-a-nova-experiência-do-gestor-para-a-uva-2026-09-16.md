# Liberar a nova experiência do gestor para a UVA

## Como a liberação funciona hoje

A nova experiência do gestor é ligada **por instituição**, através de uma chave de liberação chamada `gestao.portal_v2` na tabela de features por IES.

- Existe linha com a chave ligada → os gestores daquela faculdade entram no painel novo.
- Não existe linha (ou está desligada) → continuam no painel antigo.

Quem tem perfil de administrador sempre vê o painel novo, independente da instituição — por isso o time interno não percebe que uma faculdade ficou para trás.

## Situação verificada agora

| Instituição | Painel novo |
|---|---|
| PARACATU | ligado |
| USCS (e Bela Vista, São Caetano, Itapetininga) | ligado |
| UVA | **sem liberação** (por isso o painel antigo) |

UVA: `5f720bd4-9ad9-4cc4-a41a-3be321033db4`.

## O que será feito

Uma alteração de banco, aditiva: criar a liberação `gestao.portal_v2` ligada para a UVA (se a linha já existir, apenas ligar). Nada de código muda.

Depois de aplicado, os gestores da UVA passam a ver o painel novo no próximo carregamento da página (a decisão fica em cache por cerca de 1 minuto).

## Detalhes técnicos

```sql
insert into public.ies_features (ies_id, feature_key, enabled)
values ('5f720bd4-9ad9-4cc4-a41a-3be321033db4', 'gestao.portal_v2', true)
on conflict (ies_id, feature_key) do update set enabled = true, updated_at = now();
```

- Nenhum `DELETE`/`TRUNCATE`; nenhuma outra IES é afetada.
- A decisão em runtime vem de `get_gestor_portal_versao()`, consumida por `useGestorPortalVersao` (cache de 60s).
- Verificação após aplicar: reconsultar a linha da UVA e confirmar `enabled = true`.
