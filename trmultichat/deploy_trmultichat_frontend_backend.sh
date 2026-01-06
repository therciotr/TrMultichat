#!/usr/bin/env bash

set -e

# Descobre diretório do script e raiz do repo
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

echo "==== TrMultichat deploy: backend ===="

# Caminho canônico do backend dentro do repositório trmultichat
cd "$REPO_ROOT/trmultichat/backend"

if [ -d .git ]; then
  echo ">> git pull (backend)"
  git pull origin main
fi

echo ">> npm install (backend)"
npm install

echo ">> npm run build (backend)"
npm run build

NODE20="/root/.nvm/versions/node/v20.18.3/bin/node"
if [ -x "$NODE20" ]; then
  NODE_BIN="$NODE20"
else
  NODE_BIN="$(command -v node)"
fi

echo ">> pm2 restart trmultichat-backend (node: $NODE_BIN)"
# Always ensure correct cwd + interpreter (avoids Node 22/20 alternation)
pm2 delete trmultichat-backend >/dev/null 2>&1 || true
pm2 start dist/server.js --name trmultichat-backend --cwd "$REPO_ROOT/trmultichat/backend" --interpreter "$NODE_BIN" --update-env

echo
echo "==== TrMultichat deploy: frontend ===="

# Caminho do frontend em producao (estrutura atual na VPS)
cd "$REPO_ROOT/trmultichat/frontend"

if [ -d .git ]; then
  echo ">> git pull (frontend)"
  git pull origin main
fi

# Garantir que exista public/index.html (alguns ambientes antigos podem ter perdido esse arquivo)
if [ ! -f public/index.html ]; then
  echo ">> Criando public/index.html padrao (fallback)..."
  mkdir -p public
  cat > public/index.html << 'HTML'
<!DOCTYPE html>
<html lang="en">
  <head>
    <script type="text/javascript">
      document.title = "%REACT_APP_TITLE%"
    </script>
    <title></title>
    <meta charset="utf-8" />
    <meta name="viewport" content="minimum-scale=1, initial-scale=1, width=device-width" />
  </head>
  <body>
    <noscript>You need to enable JavaScript to run this app.</noscript>
    <div id="root"></div>
  </body>
</html>
HTML
fi

echo ">> npm install (frontend)"
NODE_OPTIONS=--openssl-legacy-provider npm install --legacy-peer-deps

echo ">> npm run build (frontend)"
export NODE_ENV=production
export REACT_APP_API_BASE_URL="https://api.trmultichat.com.br"
export REACT_APP_BACKEND_URL="https://api.trmultichat.com.br"
NODE_OPTIONS=--openssl-legacy-provider npm run build

echo ">> pm2 restart trmultichat-frontend"
# Ensure the frontend server entry exists (some VPS setups were missing it)
if [ ! -f server.js ]; then
  echo ">> ERRO: server.js não encontrado em $PWD (frontend)."
  exit 1
fi

# Always ensure correct cwd + interpreter (avoids PM2 trying /home/deploy/trmultichat/frontend/server.js)
pm2 delete trmultichat-frontend >/dev/null 2>&1 || true
pm2 start server.js --name trmultichat-frontend --cwd "$REPO_ROOT/trmultichat/frontend" --interpreter "$NODE_BIN" --update-env

echo ">> pm2 save"
echo ">> pm2 update (best-effort)"
pm2 update || true
pm2 save || true

echo
echo "==== PM2 status ===="
pm2 ls

echo
echo "Deploy finalizado. Lembre de testar com:"
echo "  - master:  thercio@trtecnologias.com.br"
echo "  - cliente: renilda@trtecnologias.com.br"




