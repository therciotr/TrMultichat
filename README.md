# TR Multichat

- API/servidor: `trmultichat/backend`
- Painel web: `trmultichat/frontend`
- Mobile: `trmultichat/mobile`

## Politica de privacidade

- URL oficial: `https://politicadeprivacidade.trmultichat.com.br`
- Fonte versionada no repositório: `trmultichat/frontend/public/privacy-policy/index.html`

⚠️ Padrão de Design System TR

Não use `<Button>` do Material-UI diretamente. Use sempre `<TrButton>` para garantir integração com o tema dinâmico configurado em `/admin/branding`.

Para criar novos componentes visuais, utilize a pasta `src/components/ui/` e siga o padrão de estilização baseado nas variáveis CSS (`--tr-primary`, `--tr-secondary`, `--tr-button`, `--tr-text`, `--tr-bg`, `--tr-font`, `--tr-radius`).

Importe a partir do index do UI quando possível:

```js
import { TrButton, TrCard, TrTableHeader } from "../../components/ui";
```

🔧 Componentes oficiais do Design System TR

- `TrButton` → botão temático (cores, radius e fonte vindos do /admin/branding)
- `TrCard` → container com borda lateral, radius dinâmico e título opcional
- `TrTableHeader` → cabeçalho de tabela padronizado na cor da empresa
- `TrSectionTitle` → título de seção para páginas internas

Importe sempre via barrel:

```js
import { TrButton, TrCard, TrTableHeader, TrSectionTitle } from "../../components/ui";
```

## Desenvolvimento local

Use os scripts em `infrastructure/`.

```
cd infrastructure && ./start-local.sh
```

## Integrações de IA (ChatGPT e Cursor)

O TR Multichat permite configurar **credenciais globais** de IA para uso em funcionalidades de *prompts* e testes de conectividade.

### Onde configurar

No painel web:

- **Configurações → Opções gerais → Integrações → Credenciais dos serviços externos**

Você verá duas seções:

- **ChatGPT (OpenAI)**
- **Cursor (OpenAI-compatible)**

### ChatGPT (OpenAI)

1. Preencha:
   - **OpenAI API Key**: sua chave `sk-...`
   - **Modelo**: ex. `gpt-3.5-turbo`
   - **Base URL**: padrão `https://api.openai.com/v1`
2. Clique em **Salvar**
3. Clique em **Testar** (deve retornar `OK`)

As chaves salvas ficam em `/settings/:key` com:

- `openaiApiKey`
- `openaiModel`
- `openaiBaseUrl`

### Cursor (OpenAI-compatible)

Esta integração funciona com **qualquer endpoint compatível com OpenAI**.

1. Preencha:
   - **Base URL**: ex. `https://SEU-ENDPOINT/v1`
   - **API Key**
   - **Modelo**
2. Clique em **Salvar**
3. Clique em **Testar**

As chaves salvas ficam em `/settings/:key` com:

- `cursorBaseUrl`
- `cursorApiKey`
- `cursorModel`

### Teste via API (opcional)

O backend expõe um endpoint de teste (requer JWT):

- `POST /ai/test`

Body:

```json
{ "provider": "openai", "message": "Responda apenas: OK" }
```

ou:

```json
{ "provider": "cursor", "message": "Responda apenas: OK" }
```

## Mobile

```
cd trmultichat/mobile
```
