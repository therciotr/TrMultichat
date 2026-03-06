# Guardrails: entrega de mensagens WhatsApp

Este documento registra o incidente de entrega e a forma oficial de prevenir recorrência.

## Incidente registrado

- Sintoma: mensagem aparecia como enviada no sistema, mas nao chegava ao cliente.
- Causa raiz: roteamento para `remoteJid` divergente do JID real inbound do contato (caso comum em BR: variacao com/sem nono digito).
- Impacto: envio para destino incorreto e aparente "envio fantasma".

## Correcoes aplicadas (2026-03)

### 1) Roteamento outbound com prioridade no JID inbound real

Arquivos:

- `src/modules/messages/messages.routes.ts`
- `src/modules/tickets/tickets.routes.ts`

Regra atual:

1. Usa o ultimo `remoteJid` inbound do contato (`fromMe = false`).
2. Depois usa ultimo `remoteJid` inbound do ticket.
3. Fallback para numero canonicamente normalizado.

### 2) Normalizacao canonica de numero (BR)

- Numero BR com 10 digitos locais e normalizado para incluir o `9`.
- Objetivo: evitar duplicacao de contatos/tickets por variacoes de formato.

### 3) Ingest com deduplicacao de ticket ativo

Arquivo:

- `src/libs/ticketIngest.ts`

Regra:

- Ao receber nova mensagem, reaproveita ticket ativo (`open`/`pending`) e evita criar ticket duplicado por variacao de numero.

## Operacao segura (runbook)

### Verificar sessao WhatsApp da conexao

Conferencia rapida:

- endpoint `GET /whatsapp?companyId=<id>&session=0`
- conexao precisa estar `CONNECTED`

### Limpeza de legado (quando houver duplicidade historica)

Comando:

```bash
cd trmultichat/backend
npm run ops:cleanup-duplicate-tickets
```

Esse script:

- normaliza numeros legados em `Contacts`
- fecha tickets ativos duplicados para o mesmo contato/conexao

Arquivo:

- `scripts/cleanupDuplicateTickets.js`

## Checklist de validacao apos deploy

1. Enviar mensagem outbound em ticket com historico antigo.
2. Confirmar recebimento no WhatsApp do cliente.
3. Responder do cliente e validar que continua no mesmo ticket.
4. Conferir `remoteJid` das ultimas mensagens do ticket e do contato.
5. Confirmar ausencia de novo ticket duplicado.

## Regra para futuras alteracoes

- Nao alterar prioridade de roteamento outbound sem validar contra historico inbound.
- Evitar usar apenas numero formatado como fonte de destino quando houver `remoteJid` inbound valido.
- Sempre validar cenarios BR com/sem nono digito em testes de regressao.
