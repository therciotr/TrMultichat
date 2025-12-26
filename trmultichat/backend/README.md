# Backend – TrMultichat

## Ambiente local (Postgres)

### 1. Configurar `.env` de desenvolvimento

O backend usa variáveis `DB_*` para se conectar ao banco. Para ambiente local, já existe um modelo pronto em `.env-example` apontando para **Postgres** via forwarder (`127.0.0.1:65432 -> postgres:5432`).

Na primeira vez, rode:

```bash
cd trmultichat/backend
bash ./scripts/setup-local-env.sh
```

Esse script cria um `.env` a partir de `.env-example` (o próprio `.env` fica fora do Git).
> Dica: se preferir executar direto (`./scripts/setup-local-env.sh`), garanta permissão:
> `chmod +x ./scripts/setup-local-env.sh`

### 2. Subir stack completo (Postgres + Redis + backend + frontend)

Na raiz do projeto:

```bash
cd infrastructure
./start-local.sh
```

Esse script:

- Sobe Postgres e Redis em Docker
- Cria um forwarder local `127.0.0.1:65432 -> postgres:5432`
- Roda migrations e seed no banco Postgres
- Faz build do backend e sobe a API em `http://localhost:4004`
- Sobe o frontend em `http://localhost:9089`

### 3. Rodar apenas o backend com o mesmo Postgres

Se quiser rodar só o backend (por exemplo, para debugar com `ts-node-dev`):

1. Garanta que o Postgres está rodando via `./infrastructure/start-local.sh` (ele já cria o forwarder 127.0.0.1:65432).
2. No backend:

```bash
cd trmultichat/backend
bash ./scripts/setup-local-env.sh    # apenas na primeira vez
npm install
npm run dev:server
```

O backend usará as variáveis `DB_*` do `.env` para conectar em Postgres, sem cair em MySQL.

## VPS (produção) – corrigir login (Postgres + JWT) rapidamente

Se na VPS o backend estiver caindo em MySQL (ex.: `Access denied for user ''@'localhost'`) ou reclamando de `JWT_SECRET`, rode o script idempotente:

```bash
cd /home/deploy/trmultichat/trmultichat
sudo bash infrastructure/fix-vps-backend-env.sh
```

Ele:
- cria/garante o usuário do Postgres (default `wtsaas`)
- escreve `backend/.env` com `DB_*` (Postgres) + `JWT_*`
- reinicia `pm2` (`trmultichat-backend`)
- faz um `curl` no `/health` e no `/auth/login`

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

