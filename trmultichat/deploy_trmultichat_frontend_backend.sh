#!/usr/bin/env bash

set -e

echo "==== TrMultichat deploy: backend ===="

# Caminho canônico do backend dentro do repositório trmultichat
cd /home/deploy/trmultichat/trmultichat/backend

if [ -d .git ]; then
  echo ">> git pull (backend)"
  git pull origin main
fi

echo ">> npm install (backend)"
npm install

echo ">> npm run build (backend)"
npm run build

echo ">> pm2 restart trmultichat-backend"
pm2 restart trmultichat-backend || pm2 start dist/server.js --name trmultichat-backend

echo
echo "==== TrMultichat deploy: frontend ===="

# Caminho do frontend em producao (estrutura atual na VPS)
cd /home/deploy/trmultichat/trmultichat/frontend

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
pm2 restart trmultichat-frontend || pm2 start server.js --name trmultichat-frontend

echo ">> pm2 save"
pm2 save || true

echo
echo "==== PM2 status ===="
pm2 ls

echo
echo "Deploy finalizado. Lembre de testar com:"
echo "  - master:  thercio@trtecnologias.com.br"
echo "  - cliente: renilda@trtecnologias.com.br"




