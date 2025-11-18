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

## Pagamentos e Assinatura – Mercado Pago

O fluxo de pagamento da tela **Financeiro** utiliza:

- `POST /subscription`

Comportamento:

- Espera um corpo JSON compatível com o frontend atual, por exemplo:

  ```json
  {
    "firstName": "Renilda",
    "lastName": "",
    "address2": "",
    "city": "",
    "state": "",
    "zipcode": "",
    "country": "",
    "useAddressForPaymentDetails": false,
    "nameOnCard": "",
    "cardNumber": "",
    "cvv": "",
    "plan": "{\"title\":\"Plano - Stander\",\"planId\":1,\"price\":250,\"description\":[\"20 Usuários\",\"20 Conexão\",\"10 Filas\"],\"users\":20,\"connections\":20,\"queues\":10,\"buttonText\":\"SELECIONAR\",\"buttonVariant\":\"outlined\"}",
    "price": 250,
    "users": 20,
    "connections": 20,
    "invoiceId": 1
  }
  ```

- O backend extrai `price`, `users`, `connections`, `invoiceId` e o `companyId` do token JWT.
- É criada uma *preference* no Mercado Pago (checkout) e a resposta é convertida para um formato compatível com o legado (similar ao retorno do PIX):

  ```json
  {
    "valor": { "original": "250.00" },
    "qrcode": { "qrcode": "https://www.mercadopago.com/..." }
  }
  ```

  - `valor.original` – valor em BRL
  - `qrcode.qrcode` – URL `init_point` do Mercado Pago, usada pelo frontend para gerar o QR Code.

### Webhook Mercado Pago

- Endpoint: `POST /payments/mercadopago/webhook`
- Quando o Mercado Pago envia um evento `payment` com `status = "approved"`:
  - Atualiza o status da fatura em `Invoices` para `"paid"` (via `metadata.invoiceId`).
  - Atualiza `dueDate` da empresa (`Company`) somando 30 dias (via `metadata.companyId`).
  - Emite o evento de socket `company-{companyId}-payment` com `action: "CONCLUIDA"`, que é consumido pelo frontend para atualizar a tela de sucesso.

### Variáveis de ambiente necessárias – Mercado Pago

Configure no ambiente de produção:

- `MERCADOPAGO_ACCESS_TOKEN` – access token privado da conta Mercado Pago.
- `MERCADOPAGO_PUBLIC_KEY` – public key usada pelo frontend (quando aplicável).
- `MERCADOPAGO_WEBHOOK_URL` – URL pública do webhook configurada no painel do Mercado Pago (se não definida, o backend usa `${BACKEND_URL}/payments/mercadopago/webhook`).

As variáveis legadas `MP_ACCESS_TOKEN` e `MP_WEBHOOK_URL` ainda são aceitas como *fallback*, mas a configuração recomendada é via `MERCADOPAGO_*`.

