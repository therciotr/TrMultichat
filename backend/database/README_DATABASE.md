# Banco de Dados – TR MultiChat (Sequelize)

Este backend usa Sequelize + sequelize-typescript. O schema base já existe no projeto (migrations em `dist/database/migrations`). Abaixo um resumo funcional das entidades críticas para o modo SaaS multi-tenant.

## Entidades principais

- Tenant (Company)
  - Campos: `id`, `name`, `status`, `dueDate`, etc.
  - Observação: representa a empresa (tenant). Todas as entidades críticas se relacionam com `companyId`.

- User
  - Campos: `id`, `name`, `email` (UNIQUE), `passwordHash`, `companyId`, `admin`, `online`, `whatsappId`, timestamps
  - Hooks: hash de senha em `password` virtual cria `passwordHash`.
  - Relacionamentos: `BelongsTo(Company)`, tickets, queues, etc.

- Ticket
  - Campos: `id`, `status` (open/closed/etc.), `companyId`, `contactId`, `whatsappId`, `userId`, `updatedAt`, etc.
  - Índices sugeridos: `(status, updatedAt)` para consultas do dashboard.

- Message
  - Campos: `id`, `ticketId`, `companyId`, `fromMe`, `body`, `createdAt`, etc.
  - Índices sugeridos: `(ticketId, createdAt)` para buscas por conversa.

- Whatsapp
  - Campos: `id`, `name`, `companyId`, `phoneNumber`, `status`, etc.
  - Índice sugerido: `phoneNumber` UNIQUE.

- Plan/Subscriptions/Invoices (já existentes)
  - Usados para limites e billing. Utilize `companyId` como referência ao tenant.

## Multi-tenant

- Todas as tabelas críticas possuem `companyId` (tenantId).
- Consultas privadas devem sempre filtrar por `companyId` (carregado do JWT).
- O `tenantId` viaja no JWT para o frontend/mobile e volta em cada request autenticada.

## Índices recomendados

- `users(email)` UNIQUE
- `tickets(status, updatedAt)`
- `messages(ticketId, createdAt)`
- `whatsapp(phoneNumber)` UNIQUE

## Arquivamento/Limpeza

- Mensagens muito antigas podem ser removidas/arquivadas periodicamente (ex.: > 90 dias) para reduzir custos e manter performance.
- Estratégia sugerida: job agendado (cron) que exporta mensagens antigas para cold storage (S3/backup), seguido de `DELETE` paginado por `companyId`.

## Observações

- O projeto atual mantém migrations em JS (Sequelize). Caso desejar evoluir o schema, crie novas migrations mantendo compatibilidade.
- O acesso ao Sequelize está disponível em `dist/database/index.js`.



