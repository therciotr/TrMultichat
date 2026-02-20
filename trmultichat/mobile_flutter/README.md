## TR Multichat Mobile (Flutter)

App mobile **Flutter (Android/iOS)** compatível com o backend existente do TR Multichat (`https://api.trmultichat.com.br`).

### Politica de privacidade

- URL de producao: `https://politicadeprivacidade.trmultichat.com.br`

### Stack
- Flutter + Clean Architecture + MVVM
- Riverpod (estado)
- Dio (REST)
- Socket.IO (`socket_io_client`)
- JWT Bearer (session persistida em `flutter_secure_storage`)
- Tema dinâmico (branding) via `GET /branding`
- Anexos: preview interno (imagem/PDF) + cache offline
- Notificações: local (infra pronta para push)

### Como rodar (build/execução)
1. Instale Flutter (stable) e configure Android Studio/Xcode.
2. Entre na pasta do app:

```bash
cd trmultichat/mobile_flutter
flutter create .
flutter pub get
flutter run
```

### Configuração de API
Por padrão:
- **Dev**: `http://localhost:4004`
- **Prod**: `https://api.trmultichat.com.br`

Arquivo:
- `lib/src/core/env/app_env.dart`

Em device físico (dev), troque `localhost` pelo IP local no `app_env.dart`.

### Estrutura (resumo)
- **Código ativo do app**: `lib/src/**`
  - Router ativo: `lib/src/router/app_router.dart`
  - Core ativo: `lib/src/core/di/core_providers.dart`, `lib/src/core/socket/socket_client.dart`, `lib/src/core/storage/secure_store.dart`, `lib/src/core/env/app_env.dart`
- **Código legado (não usado pelo app atual)**: `lib/legacy/**`
  - Foi movido para reduzir duplicações, sem apagar (ver `lib/legacy/README.md`)

### Endpoints usados (backend existente)
- Auth: `POST /auth/login`, `POST /auth/forgot-password`, `POST /auth/reset-password`, `GET /auth/me`
- Branding: `GET /branding`
- Dashboard: `GET /dashboard`
- Tickets: `GET /tickets`, `GET /tickets/:id`, `PUT /tickets/:id`
- Contatos: `GET /contacts`, `GET /contacts/:id`
- Mensagens: `GET /messages/:ticketId`, `POST /messages/:ticketId` (texto e/ou multipart)
- Comunicados: `GET /announcements`, `GET /announcements/:id`, `GET /announcements/:id/replies`, `POST /announcements/:id/replies`
- Agenda: `GET /agenda/events`, `GET /agenda/events/:id/attachments`, `POST /agenda/events/:id/attachments`

### Tempo real (Socket.IO)
Rooms:
- `joinChatBox(companyId)` → `company-{companyId}-chat`
- `joinTicket(ticketId)` → `ticket-{ticketId}`
- `joinNotification(companyId)` → `company-{companyId}-notification`

Eventos (listen):
- `company-{companyId}-appMessage` (mensagens)
- `company-{companyId}-ticket` (atualizações de ticket)


