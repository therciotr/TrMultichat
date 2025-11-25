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

# Caminho canônico do frontend dentro do repositório trmultichat
cd /home/deploy/trmultichat/trmultichat/frontend

if [ -d .git ]; then
  echo ">> git pull (frontend)"
  git pull origin main
fi

echo ">> npm install (frontend)"
NODE_OPTIONS=--openssl-legacy-provider npm install --legacy-peer-deps

echo ">> npm run build (frontend)"
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




