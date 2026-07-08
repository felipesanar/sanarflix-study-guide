## Confirmação do canal Slack

O canal `#suporte-sanarflix-academy` já é o default no edge function `notify-feedback-slack` (via `SLACK_FEEDBACK_CHANNEL`, com fallback hardcoded). Como você confirmou o nome e adicionou o app ao canal, **nenhuma alteração de código é necessária**.

### Verificação (build mode)

1. Confirmar que o edge function `notify-feedback-slack` está deployado e o trigger AFTER INSERT em `user_feedback` está ativo.
2. Enviar um feedback de teste pela UI (aluno) e conferir a mensagem em `#suporte-sanarflix-academy`.
3. Se aparecer erro `not_in_channel` nos logs, tratar (aqui não deve, já que você adicionou o bot).

Sem novos arquivos, sem migrações. Só validar o fluxo end-to-end.