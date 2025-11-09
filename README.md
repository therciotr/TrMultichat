# TR Multichat

- API/servidor: `trmultichat/backend`
- Painel web: `trmultichat/frontend`
- Mobile: `trmultichat/mobile`

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

## Mobile

```
cd trmultichat/mobile
```
