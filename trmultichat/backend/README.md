# Backend – TrMultichat

## E-mail de recuperação de senha

O fluxo de **esqueci minha senha** usa o endpoint:

- `POST /auth/forgot-password`

Comportamento:

- Sempre retorna `200` com:
  - Em **produção** (`NODE_ENV=production`):
    - `{"ok": true}`
  - Em outros ambientes (dev/stage):
    - `{"ok": true, "link": "...", "expiresInMinutes": 30}`
    - O campo `link` é apenas para debug/local – no frontend ele **não** é exibido.

### Variáveis de ambiente necessárias

Para envio de e-mails, configure:

- `MAIL_HOST` – host do servidor SMTP
- `MAIL_PORT` – porta (ex.: `587` ou `465`)
- `MAIL_USER` – usuário SMTP (se aplicável)
- `MAIL_PASS` – senha SMTP (se aplicável)
- `MAIL_FROM` – e-mail que aparecerá como remetente
- `MAIL_SECURE` – opcional (`"true"` ou `"false"`)
  - Se não definido:
    - Porta `465` → `secure: true`
    - Portas `587/25` → `secure: false`

Em **produção**, se `MAIL_HOST` ou `MAIL_FROM` não estiverem definidos, o backend retornará erro para o fluxo de recuperação de senha.

### Testando na VPS

Com o backend rodando na porta interna `4004`:

```bash
cd /home/deploy/trmultichat/backend
BACKEND_URL="http://127.0.0.1:4004" TEST_EMAIL="seuemail@dominio.com" npm run test:forgot
BACKEND_URL="http://127.0.0.1:4004" TEST_EMAIL="seuemail@dominio.com" npm run test:mail
```

Ambos os scripts devem retornar código de saída `0`. Em caso de falha, eles saem com `process.exit(1)` e imprimem a causa no console.


