TR MultiChat – Mobile (Expo)

Desenvolvimento

1. Requer Node LTS e Expo CLI
2. Inicie o app:

```
npx expo start
```

Em desenvolvimento, a API usa `http://localhost:4004`. Para testar no dispositivo físico na mesma rede Wi‑Fi, ajuste o endereço (ex.: `http://SEU_IP_LOCAL:4004`).

Produção

- Em produção, a API é `https://api.trmultichat.com.br`.

Telas

- Login: autenticação `POST /auth/login`
- Conversations: lista de tickets (placeholder)
- Chat: mensagens (placeholder com envio local)
- Settings: status online/offline e logout



